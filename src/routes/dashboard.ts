import { FastifyInstance } from "fastify";
import prisma from "../prisma";
import { getLocalDateKey, getLocalDateOnly } from "../utils/date";

// ✅ OPTIMIZED: SuperAdmin uchun barcha maktablar statistikasi
export async function adminDashboardRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/admin/dashboard",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any) => {
      // Faqat SUPER_ADMIN uchun
      if (request.user.role !== "SUPER_ADMIN") {
        throw { statusCode: 403, message: "Forbidden" };
      }

      const now = new Date();
      const today = getLocalDateOnly(now);

      // ✅ OPTIMIZATION 1: Bitta query bilan barcha maktablar + counts
      const schools = await prisma.school.findMany({
        include: {
          _count: { select: { students: true, classes: true, devices: true } },
        },
      });

      // ✅ OPTIMIZATION 2: Bitta aggregation query bilan barcha maktablarning bugungi statistikasi
      const [attendanceStats, studentCounts, currentlyInSchoolStats] = await Promise.all([
        // Barcha maktablar uchun attendance statistikasi - bitta query
        prisma.dailyAttendance.groupBy({
          by: ['schoolId', 'status'],
          where: { date: today },
          _count: true,
        }),
        // Barcha maktablar uchun active student count - bitta query
        prisma.student.groupBy({
          by: ['schoolId'],
          where: { isActive: true },
          _count: true,
        }),
        // Hozir maktabda bo'lganlar - bitta query
        prisma.dailyAttendance.groupBy({
          by: ['schoolId'],
          where: { date: today, currentlyInSchool: true },
          _count: true,
        }),
      ]);

      // Ma'lumotlarni map qilish - O(n) vaqt
      const statsMap = new Map<string, { present: number; late: number; absent: number }>();
      attendanceStats.forEach((stat) => {
        if (!statsMap.has(stat.schoolId)) {
          statsMap.set(stat.schoolId, { present: 0, late: 0, absent: 0 });
        }
        const entry = statsMap.get(stat.schoolId)!;
        if (stat.status === 'PRESENT') entry.present = stat._count;
        else if (stat.status === 'LATE') entry.late = stat._count;
        else if (stat.status === 'ABSENT') entry.absent = stat._count;
      });

      const studentCountMap = new Map<string, number>();
      studentCounts.forEach((s) => studentCountMap.set(s.schoolId, s._count));

      const currentlyInSchoolMap = new Map<string, number>();
      currentlyInSchoolStats.forEach((s) => currentlyInSchoolMap.set(s.schoolId, s._count));

      // Maktablar statistikasini yig'ish - O(n) vaqt, database query YO'Q
      const schoolsWithStats = schools.map((school) => {
        const stats = statsMap.get(school.id) || { present: 0, late: 0, absent: 0 };
        const totalStudents = studentCountMap.get(school.id) || 0;
        const currentlyInSchool = currentlyInSchoolMap.get(school.id) || 0;
        const totalPresent = stats.present + stats.late;
        const attendancePercent = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0;

        return {
          id: school.id,
          name: school.name,
          address: school.address,
          totalStudents,
          totalClasses: school._count.classes,
          totalDevices: school._count.devices,
          presentToday: totalPresent,
          lateToday: stats.late,
          absentToday: stats.absent,
          currentlyInSchool,
          attendancePercent,
        };
      });

      // Umumiy statistika - faqat JavaScript hisoblash
      const totals = schoolsWithStats.reduce(
        (acc, s) => ({
          totalSchools: acc.totalSchools + 1,
          totalStudents: acc.totalStudents + s.totalStudents,
          presentToday: acc.presentToday + s.presentToday,
          lateToday: acc.lateToday + s.lateToday,
          absentToday: acc.absentToday + s.absentToday,
          currentlyInSchool: acc.currentlyInSchool + s.currentlyInSchool,
        }),
        { totalSchools: 0, totalStudents: 0, presentToday: 0, lateToday: 0, absentToday: 0, currentlyInSchool: 0 }
      );

      const overallPercent = totals.totalStudents > 0 
        ? Math.round((totals.presentToday / totals.totalStudents) * 100) 
        : 0;

      // ✅ OPTIMIZATION 3: Haftalik trend va recent events parallel
      const weekDates: Date[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        weekDates.push(date);
      }

      const [recentEvents, weeklyAttendance] = await Promise.all([
        // Oxirgi eventlar
        prisma.attendanceEvent.findMany({
          orderBy: { timestamp: "desc" },
          take: 15,
          include: {
            student: { include: { class: true } },
            device: true,
            school: true,
          },
        }),
        // ✅ OPTIMIZATION 4: Haftalik statistika bitta query bilan
        prisma.dailyAttendance.groupBy({
          by: ['date', 'status'],
          where: {
            date: {
              gte: getLocalDateOnly(weekDates[0]),
              lte: getLocalDateOnly(weekDates[6]),
            },
          },
          _count: true,
        }),
      ]);

      // Haftalik statistikani map qilish
      const weeklyMap = new Map<string, { present: number; late: number; absent: number }>();
      weeklyAttendance.forEach((stat) => {
        const dateKey = stat.date.toISOString().split('T')[0];
        if (!weeklyMap.has(dateKey)) {
          weeklyMap.set(dateKey, { present: 0, late: 0, absent: 0 });
        }
        const entry = weeklyMap.get(dateKey)!;
        if (stat.status === 'PRESENT') entry.present = stat._count;
        else if (stat.status === 'LATE') entry.late = stat._count;
        else if (stat.status === 'ABSENT') entry.absent = stat._count;
      });

      const weeklyStats = weekDates.map((date) => {
        const dateKey = getLocalDateOnly(date).toISOString().split('T')[0];
        const stats = weeklyMap.get(dateKey) || { present: 0, late: 0, absent: 0 };
        return {
          date: getLocalDateKey(date),
          dayName: ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"][date.getDay()],
          present: stats.present + stats.late,
          late: stats.late,
          absent: stats.absent,
        };
      });

      return {
        totals: { ...totals, attendancePercent: overallPercent },
        schools: schoolsWithStats,
        recentEvents,
        weeklyStats,
      };
    }
  );
}

// ✅ OPTIMIZED: School Dashboard
export default async function (fastify: FastifyInstance) {
  fastify.get(
    "/schools/:schoolId/dashboard",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any) => {
      const { schoolId } = request.params;
      const { classId } = request.query as { classId?: string };
      const now = new Date();
      const today = getLocalDateOnly(now);

      // ✅ OPTIMIZATION 1: School va asosiy ma'lumotlarni parallel olish
      const studentFilter: any = { schoolId, isActive: true };
      if (classId) {
        studentFilter.classId = classId;
      }

      // Haftalik sanalar tayyorlash
      const weekDates: Date[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        weekDates.push(d);
      }

      // ✅ OPTIMIZATION 2: Barcha asosiy ma'lumotlarni parallel olish
      const [
        school,
        totalStudents,
        todayAttendanceStats,
        currentlyInSchoolCount,
        classes,
        classAttendanceStats,
        weeklyAttendance,
        arrivedStudentIds,
      ] = await Promise.all([
        // School timezone
        prisma.school.findUnique({ 
          where: { id: schoolId },
          select: { timezone: true }
        }),
        // Total students
        prisma.student.count({ where: studentFilter }),
        // ✅ Bugungi attendance - bitta groupBy query
        prisma.dailyAttendance.groupBy({
          by: ['status'],
          where: { 
            schoolId, 
            date: today,
            ...(classId ? { student: { classId } } : {})
          },
          _count: true,
        }),
        // Hozir maktabda
        prisma.dailyAttendance.count({
          where: { 
            schoolId, 
            date: today, 
            currentlyInSchool: true,
            ...(classId ? { student: { classId } } : {})
          },
        }),
        // Classes with counts
        prisma.class.findMany({
          where: { schoolId },
          include: { _count: { select: { students: true } } },
        }),
        // ✅ Class breakdown - bitta query bilan barcha classlar
        prisma.dailyAttendance.groupBy({
          by: ['status'],
          where: { schoolId, date: today },
          _count: true,
          // Prisma raw query kerak class bo'yicha groupBy uchun
        }),
        // ✅ Haftalik statistika - bitta query
        prisma.dailyAttendance.groupBy({
          by: ['date', 'status'],
          where: {
            schoolId,
            date: {
              gte: getLocalDateOnly(weekDates[0]),
              lte: getLocalDateOnly(weekDates[6]),
            },
          },
          _count: true,
        }),
        // Kelgan studentlar ID lari
        prisma.dailyAttendance.findMany({
          where: { schoolId, date: today },
          select: { studentId: true },
        }),
      ]);

      const tz = school?.timezone || "UTC";

      // Today stats parsing
      let presentToday = 0, lateToday = 0, absentToday = 0, excusedToday = 0;
      todayAttendanceStats.forEach((stat) => {
        if (stat.status === 'PRESENT') presentToday = stat._count;
        else if (stat.status === 'LATE') lateToday = stat._count;
        else if (stat.status === 'ABSENT') absentToday = stat._count;
        else if (stat.status === 'EXCUSED') excusedToday = stat._count;
      });

      // ✅ OPTIMIZATION 3: Class breakdown - parallel emas, raw query bilan
      // Avval student classId map yaratish
      const classBreakdownQuery = await prisma.$queryRaw<Array<{
        classId: string;
        status: string;
        count: bigint;
      }>>`
        SELECT s."classId", da."status", COUNT(*)::bigint as count
        FROM "DailyAttendance" da
        JOIN "Student" s ON da."studentId" = s.id
        WHERE da."schoolId" = ${schoolId} AND da."date" = ${today}
        GROUP BY s."classId", da."status"
      `;

      // Class stats map
      const classStatsMap = new Map<string, { present: number; late: number }>();
      classBreakdownQuery.forEach((row) => {
        if (!row.classId) return;
        if (!classStatsMap.has(row.classId)) {
          classStatsMap.set(row.classId, { present: 0, late: 0 });
        }
        const entry = classStatsMap.get(row.classId)!;
        const count = Number(row.count);
        if (row.status === 'PRESENT') entry.present += count;
        else if (row.status === 'LATE') {
          entry.present += count;
          entry.late = count;
        }
      });

      const classBreakdown = classes.map((cls) => {
        const stats = classStatsMap.get(cls.id) || { present: 0, late: 0 };
        return {
          classId: cls.id,
          className: cls.name,
          total: cls._count.students,
          present: stats.present,
          late: stats.late,
        };
      });

      // ✅ OPTIMIZATION 4: Haftalik statistikani map qilish
      const weeklyMap = new Map<string, { present: number; late: number; absent: number }>();
      weeklyAttendance.forEach((stat) => {
        const dateKey = stat.date.toISOString().split('T')[0];
        if (!weeklyMap.has(dateKey)) {
          weeklyMap.set(dateKey, { present: 0, late: 0, absent: 0 });
        }
        const entry = weeklyMap.get(dateKey)!;
        if (stat.status === 'PRESENT') entry.present = stat._count;
        else if (stat.status === 'LATE') entry.late = stat._count;
        else if (stat.status === 'ABSENT') entry.absent = stat._count;
      });

      const weeklyStats = weekDates.map((date) => {
        const dateKey = getLocalDateOnly(date).toISOString().split('T')[0];
        const stats = weeklyMap.get(dateKey) || { present: 0, late: 0, absent: 0 };
        return {
          date: getLocalDateKey(date),
          dayName: ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"][date.getDay()],
          present: stats.present + stats.late,
          late: stats.late,
          absent: stats.absent,
        };
      });

      // ✅ OPTIMIZATION 5: Not yet arrived - parallel query
      const arrivedIds = arrivedStudentIds.map((a) => a.studentId);
      
      const [notYetArrived, notYetArrivedCount] = await Promise.all([
        prisma.student.findMany({
          where: {
            schoolId,
            isActive: true,
            id: { notIn: arrivedIds.length > 0 ? arrivedIds : ['none'] },
          },
          take: 20,
          include: { class: true },
          orderBy: { name: "asc" },
        }),
        prisma.student.count({
          where: {
            schoolId,
            isActive: true,
            id: { notIn: arrivedIds.length > 0 ? arrivedIds : ['none'] },
          },
        }),
      ]);

      return {
        totalStudents,
        presentToday,
        lateToday,
        absentToday,
        excusedToday,
        currentlyInSchool: currentlyInSchoolCount,
        timezone: tz,
        presentPercentage:
          totalStudents > 0
            ? Math.round(((presentToday + lateToday) / totalStudents) * 100)
            : 0,
        currentTime: new Date().toISOString(),
        classBreakdown,
        weeklyStats,
        notYetArrived: notYetArrived.map((s) => ({
          id: s.id,
          name: s.name,
          className: s.class?.name || "-",
        })),
        notYetArrivedCount,
      };
    },
  );

  // ✅ Events endpoint - allaqachon optimallashtirilgan
  fastify.get(
    "/schools/:schoolId/events",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any) => {
      const { schoolId } = request.params;
      const { limit = 10 } = request.query;

      const events = await prisma.attendanceEvent.findMany({
        where: { schoolId },
        take: Number(limit),
        orderBy: { timestamp: "desc" },
        include: {
          student: {
            include: {
              class: true,
            },
          },
          device: true,
        },
      });

      return events;
    },
  );
}
