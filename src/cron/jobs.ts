import cron from 'node-cron';
import prisma from '../prisma';
import { getLocalDateOnly } from '../utils/date';

export function registerJobs(server: any) {
  // ✅ OPTIMIZED: Device health check every 30 minutes - batch update
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

  // ✅ OPTIMIZED: Mark Absent Job - batch operations
  // Har daqiqada faqat tegishli maktablarni tekshirish
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const today = getLocalDateOnly(now);

    try {
      // ✅ OPTIMIZATION 1: Faqat hozirgi vaqtga to'g'ri keladigan maktablarni olish
      const schoolsAtCutoff = await prisma.school.findMany({
        where: { absenceCutoffTime: currentTime },
        select: { id: true, name: true }
      });

      if (schoolsAtCutoff.length === 0) {
        return; // Hech qanday maktab cutoff vaqtida emas
      }

      server.log.info(`Processing absence marking for ${schoolsAtCutoff.length} schools at ${currentTime}`);

      for (const school of schoolsAtCutoff) {
        try {
          // ✅ OPTIMIZATION 2: Bayram kunini tekshirish
          const holidayCount = await prisma.holiday.count({
            where: { schoolId: school.id, date: today }
          });

          if (holidayCount > 0) {
            server.log.info(`Skipping ${school.name} - holiday`);
            continue;
          }

          // ✅ OPTIMIZATION 3: Bitta raw query bilan kelmaganlarni topish va insert qilish
          // Bu N+1 muammosini to'liq hal qiladi
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
              AND s."isActive" = true
              AND NOT EXISTS (
                SELECT 1 FROM "DailyAttendance" da 
                WHERE da."studentId" = s.id 
                  AND da."date" = ${today}::timestamp
              )
          `;

          server.log.info(`Marked ${result} students as ABSENT for ${school.name}`);
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
