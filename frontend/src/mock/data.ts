/**
 * Mock Data - Frontend
 * Bu fayl barcha mock ma'lumotlarni o'z ichiga oladi
 * Serverga ulanish shart emas
 */

import type { School, Class, Student, Device, User, Holiday, DailyAttendance, DashboardStats, AttendanceEvent } from '../types';

// ============ Helpers ============
const randomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// ============ O'zbek ismlari ============
const MALE_FIRST_NAMES = [
  'Akmal', 'Aziz', 'Bobur', 'Jasur', 'Doston', 'Diyor', 'Sanjarbek', 'Farxod',
  'Umid', 'Otabek', 'Shoxrux', 'Jamshid', 'Norbek', 'Temur', 'Komil', 'Anvar',
  'Sherzod', 'Farrux', 'Erkin', 'Bahrom', 'Nodir', 'Sardor', 'Jahongir', 'Muhammad'
];

const FEMALE_FIRST_NAMES = [
  'Gulnora', 'Nilufar', 'Shahnoza', 'Mohira', 'Dilnoza', 'Nigora', 'Zulfiya',
  'Malika', 'Dildora', 'Farangiz', 'Sevara', 'Gulbahor', 'Ozoda', 'Madina',
  'Sabina', 'Dilafruz', 'Gulchehra', 'Nozima', 'Sarvinoz', 'Yulduz'
];

const LAST_NAMES = [
  'Toshev', 'Aliev', 'Karimov', 'Rahimov', 'Usmanov', 'Yusupov', 'Mirzayev',
  'Ahmedov', 'Xolmatov', 'Abdullayev', 'Ismoilov', 'Saidov', 'Sharipov',
  'Hasanov', 'Azimov', 'Boboyev', 'Norov', 'Qosimov', 'Aminov', 'Valiyev'
];

const FATHER_NAMES = [
  'Abdulla', 'Akbar', 'Alisher', 'Anvar', 'Aziz', 'Bahrom', 'Jasur', 'Kamol',
  'Latif', 'Mansur', 'Nodir', 'Otabek', 'Rashid', 'Salim', 'Temur', 'Umid'
];

const now = new Date().toISOString();

// ============ Mock User (Admin) ============
export const mockUsers: Record<string, { user: User; password: string }> = {
  'admin@system.com': {
    password: 'admin123',
    user: {
      id: 'user-admin',
      email: 'admin@system.com',
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
      createdAt: now,
      updatedAt: now,
    },
  },
  'school1@admin.com': {
    password: 'admin123',
    user: {
      id: 'user-school1',
      email: 'school1@admin.com',
      name: '1-Maktab Admin',
      role: 'SCHOOL_ADMIN',
      schoolId: 'school-1',
      createdAt: now,
      updatedAt: now,
    },
  },
  'teacher@school1.uz': {
    password: 'teacher123',
    user: {
      id: 'user-teacher1',
      email: 'teacher@school1.uz',
      name: 'Kambarova D A',
      role: 'TEACHER',
      schoolId: 'school-1',
      createdAt: now,
      updatedAt: now,
    },
  },
};

// ============ Mock Schools ============
export const mockSchools: School[] = Array.from({ length: 10 }, (_, i) => ({
  id: `school-${i + 1}`,
  name: `Namangan ${i + 1}-maktab`,
  address: `Namangan shahri, ${i + 1}-mavze`,
  phone: `+998 69 221 00 ${String(i + 1).padStart(2, '0')}`,
  email: `namangan${i + 1}@maktab.uz`,
  lateThresholdMinutes: 15,
  absenceCutoffMinutes: 180,
  timezone: 'Asia/Tashkent',
  createdAt: now,
  updatedAt: now,
  _count: {
    students: randomInt(200, 500),
    classes: 6 + i,
    devices: 2,
  },
  todayStats: {
    present: randomInt(150, 400),
    late: randomInt(10, 30),
    absent: randomInt(5, 20),
    excused: randomInt(2, 10),
    attendancePercent: randomInt(85, 98),
  },
}));

// ============ Mock Classes ============
const CLASS_SECTIONS = ['A', 'B', 'V', 'G', 'D', 'E'];

export const mockClasses: Class[] = [];
mockSchools.forEach((school) => {
  for (let grade = 1; grade <= 11; grade++) {
    const sectionsCount = grade <= 4 ? 4 : grade <= 7 ? 3 : 2;
    for (let s = 0; s < sectionsCount; s++) {
      mockClasses.push({
        id: `class-${school.id}-${grade}${CLASS_SECTIONS[s]}`,
        name: `${grade}${CLASS_SECTIONS[s]}`,
        gradeLevel: grade,
        schoolId: school.id,
        startTime: '08:00',
        endTime: '14:00',
        createdAt: now,
        updatedAt: now,
        _count: { students: randomInt(25, 45) },
        todayPresent: randomInt(20, 40),
        todayLate: randomInt(1, 5),
        todayAbsent: randomInt(0, 3),
        totalStudents: randomInt(30, 45),
      });
    }
  }
});

// ============ Mock Students ============
export const mockStudents: Student[] = [];
let studentCounter = 0;

mockClasses.forEach((cls) => {
  const studentCount = cls._count?.students || 30;
  for (let i = 0; i < studentCount; i++) {
    studentCounter++;
    const gender = Math.random() > 0.5 ? 'MALE' : 'FEMALE';
    const firstName = gender === 'MALE' ? randomItem(MALE_FIRST_NAMES) : randomItem(FEMALE_FIRST_NAMES);
    const lastName = randomItem(LAST_NAMES);
    const fatherName = randomItem(FATHER_NAMES);
    
    const statuses: Array<'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED'> = ['PRESENT', 'PRESENT', 'PRESENT', 'PRESENT', 'LATE', 'ABSENT', 'EXCUSED'];
    const todayStatus = randomItem(statuses);
    
    mockStudents.push({
      id: `student-${studentCounter}`,
      deviceStudentId: String(studentCounter),
      name: `${lastName} ${firstName}`,
      firstName,
      lastName,
      fatherName,
      gender,
      schoolId: cls.schoolId,
      classId: cls.id,
      class: cls,
      parentPhone: `+998 9${randomInt(0, 9)} ${randomInt(100, 999)} ${randomInt(10, 99)} ${randomInt(10, 99)}`,
      photoUrl: undefined,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      todayStatus,
      todayEffectiveStatus: todayStatus,
      todayFirstScan: todayStatus === 'PRESENT' || todayStatus === 'LATE' 
        ? new Date(new Date().setHours(8, randomInt(0, 30), 0, 0)).toISOString()
        : null,
    });
  }
});

// ============ Mock Devices ============
export const mockDevices: Device[] = [];
mockSchools.forEach((school) => {
  mockDevices.push(
    {
      id: `device-${school.id}-entrance`,
      name: `${school.name} Asosiy Kirish`,
      deviceId: `${school.id}-entrance`,
      schoolId: school.id,
      type: 'ENTRANCE',
      location: 'Asosiy darvoza',
      isActive: true,
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `device-${school.id}-exit`,
      name: `${school.name} Chiqish`,
      deviceId: `${school.id}-exit`,
      schoolId: school.id,
      type: 'EXIT',
      location: 'Orqa darvoza',
      isActive: true,
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    }
  );
});

// ============ Mock Holidays ============
export const mockHolidays: Holiday[] = [
  { id: 'holiday-1', schoolId: 'school-1', date: '2026-01-01', name: "Yangi yil", createdAt: now },
  { id: 'holiday-2', schoolId: 'school-1', date: '2026-03-08', name: "Xotin-qizlar kuni", createdAt: now },
  { id: 'holiday-3', schoolId: 'school-1', date: '2026-03-21', name: "Navro'z", createdAt: now },
  { id: 'holiday-4', schoolId: 'school-1', date: '2026-05-09', name: "Xotira va qadrlash kuni", createdAt: now },
  { id: 'holiday-5', schoolId: 'school-1', date: '2026-09-01', name: "Mustaqillik kuni", createdAt: now },
];

// ============ Generate Today's Attendance ============
export function generateMockAttendance(schoolId: string, classId?: string): DailyAttendance[] {
  const today = new Date().toISOString().split('T')[0];
  const students = mockStudents.filter(
    (s) => s.schoolId === schoolId && (!classId || s.classId === classId)
  );
  
  return students.map((student) => ({
    id: `attendance-${student.id}-${today}`,
    studentId: student.id,
    student,
    schoolId,
    date: today,
    status: student.todayEffectiveStatus || 'PRESENT',
    firstScanTime: student.todayFirstScan || undefined,
    lastScanTime: student.todayFirstScan || undefined,
    lateMinutes: student.todayStatus === 'LATE' ? randomInt(1, 30) : undefined,
    currentlyInSchool: student.todayStatus === 'PRESENT' || student.todayStatus === 'LATE',
    scanCount: student.todayStatus === 'PRESENT' || student.todayStatus === 'LATE' ? randomInt(1, 4) : 0,
    createdAt: now,
    updatedAt: now,
  }));
}

// ============ Generate Dashboard Stats ============
export function generateMockDashboardStats(schoolId: string, classId?: string): DashboardStats {
  const students = mockStudents.filter(
    (s) => s.schoolId === schoolId && (!classId || s.classId === classId)
  );
  
  const total = students.length;
  const present = students.filter((s) => s.todayStatus === 'PRESENT').length;
  const late = students.filter((s) => s.todayStatus === 'LATE').length;
  const absent = students.filter((s) => s.todayStatus === 'ABSENT').length;
  const excused = students.filter((s) => s.todayStatus === 'EXCUSED').length;
  
  const classes = mockClasses.filter((c) => c.schoolId === schoolId);
  
  return {
    period: 'today',
    periodLabel: 'Bugun',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    daysCount: 1,
    totalStudents: total,
    presentToday: present,
    lateToday: late,
    absentToday: absent,
    excusedToday: excused,
    presentPercentage: total > 0 ? Math.round(((present + late) / total) * 100) : 0,
    currentlyInSchool: present + late,
    classBreakdown: classes.slice(0, 10).map((c) => ({
      classId: c.id,
      className: c.name,
      total: c.totalStudents || 30,
      present: c.todayPresent || 25,
      late: c.todayLate || 2,
    })),
    weeklyStats: Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayNames = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
      return {
        date: d.toISOString().split('T')[0],
        dayName: dayNames[d.getDay()],
        present: randomInt(180, 220),
        late: randomInt(10, 25),
        absent: randomInt(5, 15),
      };
    }).reverse(),
    notYetArrived: students
      .filter((s) => !s.todayFirstScan)
      .slice(0, 5)
      .map((s) => ({
        id: s.id,
        name: s.name,
        className: s.class?.name || '',
        pendingStatus: 'PENDING_EARLY' as const,
      })),
    notYetArrivedCount: students.filter((s) => !s.todayFirstScan).length,
  };
}

// ============ Generate Recent Events ============
export function generateMockEvents(schoolId: string, limit = 10): AttendanceEvent[] {
  const students = mockStudents.filter((s) => s.schoolId === schoolId).slice(0, limit);
  const devices = mockDevices.filter((d) => d.schoolId === schoolId);
  
  return students.map((student, i) => ({
    id: `event-${student.id}-${Date.now()}-${i}`,
    studentId: student.id,
    student,
    schoolId,
    deviceId: devices[0]?.id,
    device: devices[0],
    eventType: i % 2 === 0 ? 'IN' : 'OUT',
    timestamp: new Date(Date.now() - i * 60000 * randomInt(1, 10)).toISOString(),
    rawPayload: {},
    createdAt: now,
  }));
}

// ============ School Users ============
export function getMockSchoolUsers(_schoolId: string) {
  return [
    { id: 'user-t1', name: 'Kambarova D A', email: 'kambarova@school.uz', role: 'TEACHER' as const, createdAt: now },
    { id: 'user-t2', name: 'Alisheva X M', email: 'alisheva@school.uz', role: 'TEACHER' as const, createdAt: now },
    { id: 'user-g1', name: 'Sodiqov B', email: 'sodiqov@school.uz', role: 'GUARD' as const, createdAt: now },
  ];
}
