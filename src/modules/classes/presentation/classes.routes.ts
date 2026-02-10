import { FastifyInstance } from "fastify";
import prisma from "../../../prisma";
import { addDaysUtc, dateKeyToUtcDate, getDateKeyInZone } from "../../../utils/date";
import {
  requireClassSchoolScope,
  requireRoles,
  requireSchoolScope,
} from "../../../utils/authz";
import { sendHttpError } from "../../../utils/httpErrors";
import { buildUserContext, logAudit } from "../../../utils/audit";

export default async function (fastify: FastifyInstance) {
  fastify.get(
    "/schools/:schoolId/classes",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN", "TEACHER", "GUARD"]);
        requireSchoolScope(user, schoolId);

        let where: any = { schoolId };
        if (user.role === "TEACHER") {
          const rows = await prisma.teacherClass.findMany({
            where: { teacherId: user.sub },
            select: { classId: true },
          });
          const classIds = rows.map((r) => r.classId);
          where = { ...where, id: { in: classIds.length ? classIds : ["__none__"] } };
        }

        const [school, classes] = await Promise.all([
          prisma.school.findUnique({ where: { id: schoolId }, select: { timezone: true } }),
          prisma.class.findMany({
            where,
            include: {
              _count: { select: { students: true } },
            },
            orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
          }),
        ]);

        const tz = school?.timezone || "Asia/Tashkent";
        const now = new Date();
        const todayKey = getDateKeyInZone(now, tz);
        const today = dateKeyToUtcDate(todayKey);
        const tomorrow = addDaysUtc(today, 1);

        const classesWithAttendance = await Promise.all(
          classes.map(async (cls) => {
            const [presentCount, lateCount, absentCount] = await Promise.all([
              prisma.dailyAttendance.count({
                where: { date: { gte: today, lt: tomorrow }, status: "PRESENT", student: { classId: cls.id } },
              }),
              prisma.dailyAttendance.count({
                where: { date: { gte: today, lt: tomorrow }, status: "LATE", student: { classId: cls.id } },
              }),
              prisma.dailyAttendance.count({
                where: { date: { gte: today, lt: tomorrow }, status: "ABSENT", student: { classId: cls.id } },
              }),
            ]);
            return {
              ...cls,
              todayPresent: presentCount,
              todayLate: lateCount,
              todayAbsent: absentCount,
              totalStudents: cls._count.students,
            };
          }),
        );

        return classesWithAttendance;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.post(
    "/schools/:schoolId/classes",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const { name, gradeLevel, startTime, endTime } = request.body;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN"]);
        requireSchoolScope(user, schoolId);

        const resolvedStartTime = startTime || "08:00";
        const cls = await prisma.class.create({
          data: {
            name,
            gradeLevel,
            schoolId,
            startTime: resolvedStartTime,
            endTime,
          },
        });
        logAudit(fastify, {
          action: "class.create",
          eventType: "CLASS_CREATE",
          level: "info",
          status: "SUCCESS",
          message: "Class created",
          schoolId,
          ...buildUserContext(request),
          extra: {
            classId: cls.id,
            name: cls.name,
            gradeLevel: cls.gradeLevel,
            startTime: cls.startTime,
            endTime: cls.endTime,
          },
        });
        return cls;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.put(
    "/classes/:id",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const data = request.body;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN"]);
        await requireClassSchoolScope(user, id);

        const existing = await prisma.class.findUnique({ where: { id } });
        if (!existing) {
          return reply.status(404).send({ error: "not found" });
        }

        const cls = await prisma.class.update({ where: { id }, data });
        logAudit(fastify, {
          action: "class.update",
          eventType: "CLASS_UPDATE",
          level: "info",
          status: "SUCCESS",
          message: "Class updated",
          schoolId: existing.schoolId,
          ...buildUserContext(request),
          extra: {
            classId: id,
            oldStartTime: existing.startTime,
            newStartTime: cls.startTime,
            oldEndTime: existing.endTime,
            newEndTime: cls.endTime,
          },
        });
        return cls;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.delete(
    "/classes/:id",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN"]);
        await requireClassSchoolScope(user, id);

        const existing = await prisma.class.findUnique({ where: { id } });
        await prisma.class.delete({ where: { id } });
        if (existing) {
          logAudit(fastify, {
            action: "class.delete",
            eventType: "CLASS_DELETE",
            level: "warn",
            status: "SUCCESS",
            message: "Class deleted",
            schoolId: existing.schoolId,
            ...buildUserContext(request),
            extra: {
              classId: existing.id,
              name: existing.name,
              gradeLevel: existing.gradeLevel,
            },
          });
        }
        return { ok: true };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );
}
