import cron from 'node-cron';
import prisma from '../prisma';
import { getLocalDateOnly, addMinutesToTime } from '../utils/date';

export function registerJobs(server: any) {
  // ... (device health check qismi o'zgarishsiz qoladi)
  cron.schedule('*/30 * * * *', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    
    try {
      // ✅ OPTIMIZATION: Bitta query bilan inactive qilish
      await prisma.device.updateMany({
        where: {
          OR: [
            { lastSeenAt: null },
            { lastSeenAt: { lt: twoHoursAgo } }
          ],
          isActive: true
        },
        data: { isActive: false }
      });

      // ✅ OPTIMIZATION: Bitta query bilan active qilish
      await prisma.device.updateMany({
        where: {
          lastSeenAt: { gte: twoHoursAgo },
          isActive: false
        },
        data: { isActive: true }
      });

      server.log.info('Device health check completed');
    } catch (err) {
      server.log.error('Device health check error:', err);
    }
  });

  // ✅ OPTIMIZED: Mark Absent Job - sinflar bo'yicha ishlaydi
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const today = getLocalDateOnly(now);

    try {
      // 1. Barcha maktablarni va ularning sinflarini olamiz
      const schools = await prisma.school.findMany({
        include: {
          classes: {
            select: {
              id: true,
              startTime: true,
              name: true
            }
          }
        }
      });

      for (const school of schools) {
        try {
          // 2. Bayram kunini tekshirish
          const holidayCount = await prisma.holiday.count({
            where: { schoolId: school.id, date: today }
          });

          if (holidayCount > 0) continue;

          // 3. Ushbu maktabda aynan hozir cutoff vaqti kelgan sinflarni aniqlaymiz
          const classesToProcess = school.classes.filter(cls => 
            addMinutesToTime(cls.startTime, school.absenceCutoffMinutes) === currentTime
          );

          if (classesToProcess.length === 0) continue;

          const classIds = classesToProcess.map(c => c.id);
          
          server.log.info(`Processing ${classIds.length} classes for ${school.name} at cutoff ${currentTime}`);

          // 4. Bitta query bilan ushbu sinflardagi kelmagan o'quvchilarni belgilash
          // Postgresql 'ANY' operatori orqali classIds arrayini uzatamiz
          const result = await prisma.$executeRaw`
            INSERT INTO "DailyAttendance" ("id", "studentId", "schoolId", "date", "status", "createdAt", "updatedAt", "currentlyInSchool", "scanCount")
            SELECT 
              gen_random_uuid(),
              s.id,
              s."schoolId",
              ${today}::timestamp,
              'ABSENT'::"AttendanceStatus",
              NOW(),
              NOW(),
              false,
              0
            FROM "Student" s
            WHERE s."schoolId" = ${school.id}
              AND s."classId" = ANY(${classIds})
              AND s."isActive" = true
              AND NOT EXISTS (
                SELECT 1 FROM "DailyAttendance" da 
                WHERE da."studentId" = s.id 
                  AND da."date" = ${today}::timestamp
              )
          `;

          if (result > 0) {
            server.log.info(`Marked ${result} students as ABSENT in classes: ${classesToProcess.map(c => c.name).join(', ')}`);
          }
        } catch (schoolErr) {
          server.log.error(`Error processing school ${school.name}:`, schoolErr);
        }
      }
    } catch (err) {
      server.log.error('Mark absent job error:', err);
    }
  });

  // ✅ NEW: End of day cleanup - kunlik statistika yaratish (optional, performance uchun)
  // Har kuni yarim tunda ishga tushadi
  cron.schedule('0 0 * * *', async () => {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayDate = getLocalDateOnly(yesterday);

      // Kechagi kun uchun hali maktabda qolgan studentlarni OUT qilish
      const updatedCount = await prisma.dailyAttendance.updateMany({
        where: {
          date: yesterdayDate,
          currentlyInSchool: true
        },
        data: {
          currentlyInSchool: false,
          notes: 'Auto-closed at end of day'
        }
      });

      if (updatedCount.count > 0) {
        server.log.info(`End of day: closed ${updatedCount.count} open attendance records`);
      }
    } catch (err) {
      server.log.error('End of day cleanup error:', err);
    }
  });

  // ✅ NEW: Weekly cleanup - eski eventlarni arxivlash yoki o'chirish (optional)
  // Har haftaning dushanbasi soat 3:00 da
  cron.schedule('0 3 * * 1', async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // 30 kundan eski raw eventlarni o'chirish (DailyAttendance saqlanadi)
      const deletedEvents = await prisma.attendanceEvent.deleteMany({
        where: {
          timestamp: { lt: thirtyDaysAgo }
        }
      });

      server.log.info(`Weekly cleanup: deleted ${deletedEvents.count} old attendance events`);
    } catch (err) {
      server.log.error('Weekly cleanup error:', err);
    }
  });
}
