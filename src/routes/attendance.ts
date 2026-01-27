import { FastifyInstance } from "fastify";
import prisma from "../prisma";
import ExcelJS from "exceljs";
import { getDateOnlyInZone } from "../utils/date";
import { requireRoles, requireSchoolScope, requireAttendanceTeacherScope } from "../utils/authz";
import { sendHttpError } from "../utils/httpErrors";

export default async function (fastify: FastifyInstance) {
  fastify.get(
    "/schools/:schoolId/attendance/today",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const user = request.user;
        const school = await prisma.school.findUnique({
          where: { id: schoolId },
          select: { timezone: true },
        });
        const tz = school?.timezone || 'Asia/Tashkent';
        const today = getDateOnlyInZone(new Date(), tz);

        requireRoles(user, ['SCHOOL_ADMIN', 'TEACHER', 'GUARD']);
        requireSchoolScope(user, schoolId);

        const where: any = { schoolId, date: today };
        // Teacher: only assigned classes
        if (user.role === 'TEACHER') {
          const rows = await prisma.teacherClass.findMany({ where: { teacherId: user.sub }, select: { classId: true } });
          const classIds = rows.map((r) => r.classId);
          where.student = { classId: { in: classIds.length ? classIds : ['__none__'] } };
        }

        const records = await prisma.dailyAttendance.findMany({
          where,
          include: {
            student: { include: { class: true } },
          },
        });
        return records;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.get(
    "/schools/:schoolId/attendance/report",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const user = request.user;
        const { startDate, endDate, classId } = request.query as any;

        requireRoles(user, ['SCHOOL_ADMIN', 'TEACHER', 'GUARD']);
        requireSchoolScope(user, schoolId);

        const fromDate = new Date(`${startDate}T00:00:00Z`);
        const toDate = new Date(`${endDate}T23:59:59Z`);

        const where: any = {
          schoolId,
          date: { gte: fromDate, lte: toDate },
        };

        if (classId) {
          // Teacher must not request another class
          if (user.role === 'TEACHER') {
            const allowed = await prisma.teacherClass.findUnique({
              where: { teacherId_classId: { teacherId: user.sub, classId } } as any,
              select: { classId: true },
            });
            if (!allowed) return reply.status(403).send({ error: 'forbidden' });
          }
          where.student = { classId };
        } else if (user.role === 'TEACHER') {
          const rows = await prisma.teacherClass.findMany({ where: { teacherId: user.sub }, select: { classId: true } });
          const classIds = rows.map((r) => r.classId);
          where.student = { classId: { in: classIds.length ? classIds : ['__none__'] } };
        }

        const records = await prisma.dailyAttendance.findMany({
          where,
          include: {
            student: { include: { class: true } },
          },
          orderBy: { date: 'desc' },
        });
        return records;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.post(
    "/schools/:schoolId/attendance/export",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const user = request.user;
        const { startDate, endDate, classId } = request.body as any;

        requireRoles(user, ['SCHOOL_ADMIN', 'TEACHER', 'GUARD']);
        requireSchoolScope(user, schoolId);

        const fromDate = new Date(`${startDate}T00:00:00Z`);
        const toDate = new Date(`${endDate}T23:59:59Z`);

        const where: any = { schoolId, date: { gte: fromDate, lte: toDate } };
        if (classId) {
          if (user.role === 'TEACHER') {
            const allowed = await prisma.teacherClass.findUnique({
              where: { teacherId_classId: { teacherId: user.sub, classId } } as any,
              select: { classId: true },
            });
            if (!allowed) return reply.status(403).send({ error: 'forbidden' });
          }
          where.student = { classId };
        } else if (user.role === 'TEACHER') {
          const rows = await prisma.teacherClass.findMany({ where: { teacherId: user.sub }, select: { classId: true } });
          const classIds = rows.map((r) => r.classId);
          where.student = { classId: { in: classIds.length ? classIds : ['__none__'] } };
        }

        const records = await prisma.dailyAttendance.findMany({
          where,
          include: { student: true },
          orderBy: { date: 'desc' },
        });

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("Attendance");
        ws.columns = [
          { header: "Student", key: "student" },
          { header: "Date", key: "date" },
          { header: "Status", key: "status" },
          { header: "Notes", key: "notes" },
        ];
        records.forEach((r) => {
          ws.addRow({
            student: r.student.name,
            date: r.date.toISOString().slice(0, 10),
            status: r.status,
            notes: (r as any).notes || '',
          });
        });

        reply.header(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        reply.header(
          "Content-Disposition",
          'attachment; filename="attendance.xlsx"',
        );

        const buffer = await wb.xlsx.writeBuffer();
        return reply.send(buffer);
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  // Limited edit:
  // - SCHOOL_ADMIN: can update status/notes
  // - TEACHER: only notes and status=EXCUSED for own assigned classes
  fastify.put(
    "/attendance/:id",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;
        const data = request.body as any;

        requireRoles(user, ['SCHOOL_ADMIN', 'TEACHER']);
        await requireAttendanceTeacherScope(user, id);

        if (user.role === 'TEACHER') {
          const safe: any = {};
          if (data.notes !== undefined) safe.notes = data.notes;
          if (data.status !== undefined) {
            if (data.status !== 'EXCUSED') {
              return reply.status(403).send({ error: 'forbidden' });
            }
            safe.status = 'EXCUSED';
          }
          return prisma.dailyAttendance.update({ where: { id }, data: safe });
        }

        // SCHOOL_ADMIN
        return prisma.dailyAttendance.update({ where: { id }, data });
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  // Bulk update: only SCHOOL_ADMIN
  fastify.put(
    "/attendance/bulk",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const user = request.user;
        const { ids, status, notes } = request.body as {
          ids: string[];
          status: string;
          notes?: string;
        };

        requireRoles(user, ['SCHOOL_ADMIN']);

        const updateData: any = { status };
        if (notes !== undefined) updateData.notes = notes;

        const where: any = { id: { in: ids } };
        if (user.role !== 'SUPER_ADMIN') {
          where.schoolId = user.schoolId;
        }

        const result = await prisma.dailyAttendance.updateMany({ where, data: updateData });
        return { updated: result.count };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );
}

