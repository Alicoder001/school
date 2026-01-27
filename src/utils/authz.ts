import prisma from '../prisma';

export type AppRole = 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER' | 'GUARD';

export class ForbiddenError extends Error {
  statusCode = 403;
  constructor(message = 'forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error {
  statusCode = 404;
  constructor(message = 'not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export function isSuperAdmin(user: any): boolean {
  return user?.role === 'SUPER_ADMIN';
}

export function requireRoles(user: any, roles: AppRole[]) {
  if (isSuperAdmin(user)) return;
  if (!user?.role || !roles.includes(user.role)) {
    throw new ForbiddenError('forbidden');
  }
}

export function requireSchoolScope(user: any, schoolId: string) {
  if (isSuperAdmin(user)) return;
  if (!user?.schoolId || user.schoolId !== schoolId) {
    throw new ForbiddenError('forbidden');
  }
}

// For endpoints that only have :id, we must load the resource and validate its schoolId
export async function requireClassSchoolScope(user: any, classId: string) {
  const cls = await prisma.class.findUnique({ where: { id: classId }, select: { id: true, schoolId: true } });
  if (!cls) throw new NotFoundError('not found');
  requireSchoolScope(user, cls.schoolId);
  return cls;
}

export async function requireStudentSchoolScope(user: any, studentId: string) {
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, schoolId: true, classId: true } });
  if (!student) throw new NotFoundError('not found');
  requireSchoolScope(user, student.schoolId);
  return student;
}

export async function requireDeviceSchoolScope(user: any, deviceId: string) {
  const device = await prisma.device.findUnique({ where: { id: deviceId }, select: { id: true, schoolId: true } });
  if (!device) throw new NotFoundError('not found');
  requireSchoolScope(user, device.schoolId);
  return device;
}

export async function requireHolidaySchoolScope(user: any, holidayId: string) {
  const holiday = await prisma.holiday.findUnique({ where: { id: holidayId }, select: { id: true, schoolId: true } });
  if (!holiday) throw new NotFoundError('not found');
  requireSchoolScope(user, holiday.schoolId);
  return holiday;
}

export async function requireAttendanceSchoolScope(user: any, attendanceId: string) {
  const att = await prisma.dailyAttendance.findUnique({
    where: { id: attendanceId },
    select: { id: true, schoolId: true, studentId: true },
  });
  if (!att) throw new NotFoundError('not found');
  requireSchoolScope(user, att.schoolId);
  return att;
}

export async function requireAttendanceTeacherScope(user: any, attendanceId: string) {
  // Applies only to TEACHER; SUPER_ADMIN bypass inside other helpers
  const att = await prisma.dailyAttendance.findUnique({
    where: { id: attendanceId },
    select: { id: true, schoolId: true, student: { select: { classId: true } } },
  });
  if (!att) throw new NotFoundError('not found');
  requireSchoolScope(user, att.schoolId);

  if (user?.role === 'TEACHER') {
    const classId = att.student?.classId;
    if (!classId) throw new ForbiddenError('forbidden');
    await requireTeacherClassScope(user, classId);
  }

  return att;
}

export async function getTeacherAllowedClassIds(userId: string): Promise<string[]> {
  const rows = await prisma.teacherClass.findMany({ where: { teacherId: userId }, select: { classId: true } });
  return rows.map((r) => r.classId);
}

export async function requireTeacherClassScope(user: any, classId: string) {
  if (isSuperAdmin(user)) return;
  if (user?.role !== 'TEACHER') return; // Only enforce class-scope for teachers

  const allowed = await prisma.teacherClass.findUnique({
    where: { teacherId_classId: { teacherId: user.sub, classId } } as any,
    select: { classId: true },
  });

  if (!allowed) throw new ForbiddenError('forbidden');
}
