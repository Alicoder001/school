/**
 * Mock Services - Frontend
 * Barcha API so'rovlarini mock qiladi
 */

import {
  mockSchools,
  mockClasses,
  mockStudents,
  mockDevices,
  mockHolidays,
  mockUsers,
  generateMockDashboardStats,
  generateMockAttendance,
  generateMockEvents,
  getMockSchoolUsers,
} from './data';
import type {
  School,
  Class,
  Student,
  Device,
  User,
  Holiday,
  DailyAttendance,
  DashboardStats,
  AttendanceEvent,
  LoginResponse,
  StudentsResponse,
  PeriodType,
} from '../types';

// Delay simulyatsiyasi
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const MOCK_DELAY = 200;

// ============ Auth Service Mock ============
export const mockAuthService = {
  async login(email: string, password: string): Promise<LoginResponse> {
    await delay(MOCK_DELAY);
    
    const userRecord = mockUsers[email];
    if (!userRecord) {
      throw new Error('Foydalanuvchi topilmadi');
    }
    if (userRecord.password !== password) {
      throw new Error('Parol noto\'g\'ri');
    }
    
    const token = `mock-token-${Date.now()}`;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userRecord.user));
    
    return {
      token,
      user: userRecord.user,
    };
  },
  
  async getMe(): Promise<User> {
    await delay(MOCK_DELAY);
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      throw new Error('Not authenticated');
    }
    return JSON.parse(userStr);
  },
  
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
};

// ============ Schools Service Mock ============
export const mockSchoolsService = {
  async getAll(): Promise<School[]> {
    await delay(MOCK_DELAY);
    return [...mockSchools];
  },
  
  async getById(id: string): Promise<School> {
    await delay(MOCK_DELAY);
    const school = mockSchools.find((s) => s.id === id);
    if (!school) throw new Error('School not found');
    return school;
  },
  
  async create(data: Partial<School>): Promise<School> {
    await delay(MOCK_DELAY);
    const newSchool: School = {
      id: `school-${Date.now()}`,
      name: data.name || 'Yangi maktab',
      lateThresholdMinutes: 15,
      absenceCutoffMinutes: 180,
      timezone: 'Asia/Tashkent',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data,
    };
    mockSchools.push(newSchool);
    return newSchool;
  },
  
  async update(id: string, data: Partial<School>): Promise<School> {
    await delay(MOCK_DELAY);
    const index = mockSchools.findIndex((s) => s.id === id);
    if (index === -1) throw new Error('School not found');
    mockSchools[index] = { ...mockSchools[index], ...data, updatedAt: new Date().toISOString() };
    return mockSchools[index];
  },
  
  async delete(id: string): Promise<void> {
    await delay(MOCK_DELAY);
    const index = mockSchools.findIndex((s) => s.id === id);
    if (index !== -1) mockSchools.splice(index, 1);
  },
  
  async getWebhookInfo(id: string) {
    await delay(MOCK_DELAY);
    return {
      enforceSecret: true,
      secretHeaderName: 'X-Webhook-Secret',
      inUrl: `https://api.example.com/webhook/${id}/in`,
      outUrl: `https://api.example.com/webhook/${id}/out`,
      inUrlWithSecret: `https://api.example.com/webhook/${id}/in?secret=xxx`,
      outUrlWithSecret: `https://api.example.com/webhook/${id}/out?secret=xxx`,
      inSecret: 'mock-secret-in',
      outSecret: 'mock-secret-out',
    };
  },
};

// ============ Classes Service Mock ============
export const mockClassesService = {
  async getAll(schoolId: string): Promise<Class[]> {
    await delay(MOCK_DELAY);
    return mockClasses.filter((c) => c.schoolId === schoolId);
  },
  
  async create(schoolId: string, data: Partial<Class>): Promise<Class> {
    await delay(MOCK_DELAY);
    const newClass: Class = {
      id: `class-${Date.now()}`,
      name: data.name || '1A',
      gradeLevel: data.gradeLevel || 1,
      schoolId,
      startTime: data.startTime || '08:00',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockClasses.push(newClass);
    return newClass;
  },
  
  async update(id: string, data: Partial<Class>): Promise<Class> {
    await delay(MOCK_DELAY);
    const index = mockClasses.findIndex((c) => c.id === id);
    if (index === -1) throw new Error('Class not found');
    mockClasses[index] = { ...mockClasses[index], ...data, updatedAt: new Date().toISOString() };
    return mockClasses[index];
  },
  
  async delete(id: string): Promise<void> {
    await delay(MOCK_DELAY);
    const index = mockClasses.findIndex((c) => c.id === id);
    if (index !== -1) mockClasses.splice(index, 1);
  },
};

// ============ Students Service Mock ============
export const mockStudentsService = {
  async getAll(
    schoolId: string,
    params?: { page?: number; search?: string; classId?: string; period?: PeriodType }
  ): Promise<StudentsResponse> {
    await delay(MOCK_DELAY);
    
    let students = mockStudents.filter((s) => s.schoolId === schoolId);
    
    if (params?.classId) {
      students = students.filter((s) => s.classId === params.classId);
    }
    
    if (params?.search) {
      const q = params.search.toLowerCase();
      students = students.filter((s) => s.name.toLowerCase().includes(q));
    }
    
    const page = params?.page || 1;
    const limit = 25;
    const start = (page - 1) * limit;
    const paged = students.slice(start, start + limit);
    
    const stats = {
      total: students.length,
      present: students.filter((s) => s.todayStatus === 'PRESENT').length,
      late: students.filter((s) => s.todayStatus === 'LATE').length,
      absent: students.filter((s) => s.todayStatus === 'ABSENT').length,
      excused: students.filter((s) => s.todayStatus === 'EXCUSED').length,
    };
    
    return {
      data: paged,
      total: students.length,
      page,
      limit,
      period: params?.period || 'today',
      periodLabel: 'Bugun',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      isSingleDay: true,
      stats,
    };
  },
  
  async getById(id: string): Promise<Student> {
    await delay(MOCK_DELAY);
    const student = mockStudents.find((s) => s.id === id);
    if (!student) throw new Error('Student not found');
    return student;
  },
  
  async create(schoolId: string, data: Partial<Student>): Promise<Student> {
    await delay(MOCK_DELAY);
    const newStudent: Student = {
      id: `student-${Date.now()}`,
      name: `${data.lastName || ''} ${data.firstName || ''}`.trim() || 'Yangi o\'quvchi',
      schoolId,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data,
    };
    mockStudents.push(newStudent);
    return newStudent;
  },
  
  async update(id: string, data: Partial<Student>): Promise<Student> {
    await delay(MOCK_DELAY);
    const index = mockStudents.findIndex((s) => s.id === id);
    if (index === -1) throw new Error('Student not found');
    mockStudents[index] = { ...mockStudents[index], ...data, updatedAt: new Date().toISOString() };
    return mockStudents[index];
  },
  
  async delete(id: string): Promise<void> {
    await delay(MOCK_DELAY);
    const index = mockStudents.findIndex((s) => s.id === id);
    if (index !== -1) mockStudents.splice(index, 1);
  },
  
  async getAttendance(id: string, _params?: { month?: string }): Promise<DailyAttendance[]> {
    await delay(MOCK_DELAY);
    const student = mockStudents.find((s) => s.id === id);
    if (!student) return [];
    return generateMockAttendance(student.schoolId).filter((a) => a.studentId === id);
  },
  
  async getEvents(id: string): Promise<AttendanceEvent[]> {
    await delay(MOCK_DELAY);
    const student = mockStudents.find((s) => s.id === id);
    if (!student) return [];
    return generateMockEvents(student.schoolId, 5).filter((e) => e.studentId === id);
  },
  
  async importExcel(): Promise<{ imported: number }> {
    await delay(MOCK_DELAY * 3);
    return { imported: 25 };
  },
  
  async exportExcel(): Promise<Blob> {
    await delay(MOCK_DELAY);
    return new Blob(['Mock Excel Data'], { type: 'application/octet-stream' });
  },
  
  async downloadTemplate(): Promise<Blob> {
    await delay(MOCK_DELAY);
    return new Blob(['Mock Template'], { type: 'application/octet-stream' });
  },
};

// ============ Devices Service Mock ============
export const mockDevicesService = {
  async getAll(schoolId: string): Promise<Device[]> {
    await delay(MOCK_DELAY);
    return mockDevices.filter((d) => d.schoolId === schoolId);
  },
  
  async create(schoolId: string, data: Partial<Device>): Promise<Device> {
    await delay(MOCK_DELAY);
    const newDevice: Device = {
      id: `device-${Date.now()}`,
      name: data.name || 'Yangi qurilma',
      deviceId: data.deviceId || `dev-${Date.now()}`,
      schoolId,
      type: data.type || 'ENTRANCE',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockDevices.push(newDevice);
    return newDevice;
  },
  
  async update(id: string, data: Partial<Device>): Promise<Device> {
    await delay(MOCK_DELAY);
    const index = mockDevices.findIndex((d) => d.id === id);
    if (index === -1) throw new Error('Device not found');
    mockDevices[index] = { ...mockDevices[index], ...data, updatedAt: new Date().toISOString() };
    return mockDevices[index];
  },
  
  async delete(id: string): Promise<void> {
    await delay(MOCK_DELAY);
    const index = mockDevices.findIndex((d) => d.id === id);
    if (index !== -1) mockDevices.splice(index, 1);
  },
};

// ============ Dashboard Service Mock ============
export const mockDashboardService = {
  async getStats(schoolId: string, filters?: { classId?: string }): Promise<DashboardStats> {
    await delay(MOCK_DELAY);
    return generateMockDashboardStats(schoolId, filters?.classId);
  },
  
  async getAdminStats(): Promise<any> {
    await delay(MOCK_DELAY);
    
    // Schools data with all required fields
    const schoolsData = mockSchools.map((s) => {
      const schoolStudents = mockStudents.filter(st => st.schoolId === s.id);
      const present = schoolStudents.filter(st => st.todayStatus === 'PRESENT').length;
      const late = schoolStudents.filter(st => st.todayStatus === 'LATE').length;
      const absent = schoolStudents.filter(st => st.todayStatus === 'ABSENT').length;
      const excused = schoolStudents.filter(st => st.todayStatus === 'EXCUSED').length;
      const total = schoolStudents.length;
      
      return {
        id: s.id,
        name: s.name,
        address: s.address || '',
        totalStudents: total,
        totalClasses: s._count?.classes || 0,
        totalDevices: s._count?.devices || 0,
        presentToday: present,
        lateToday: late,
        absentToday: absent,
        excusedToday: excused,
        pendingEarlyCount: 0,
        latePendingCount: 0,
        currentlyInSchool: present + late,
        attendancePercent: total > 0 ? Math.round(((present + late) / total) * 100) : 0,
      };
    });
    
    // Calculate totals
    const totals = schoolsData.reduce(
      (acc, school) => ({
        totalSchools: acc.totalSchools + 1,
        totalStudents: acc.totalStudents + school.totalStudents,
        presentToday: acc.presentToday + school.presentToday,
        lateToday: acc.lateToday + school.lateToday,
        absentToday: acc.absentToday + school.absentToday,
        excusedToday: acc.excusedToday + school.excusedToday,
        pendingEarlyCount: acc.pendingEarlyCount + school.pendingEarlyCount,
        latePendingCount: acc.latePendingCount + school.latePendingCount,
        currentlyInSchool: acc.currentlyInSchool + school.currentlyInSchool,
        attendancePercent: 0,
      }),
      {
        totalSchools: 0,
        totalStudents: 0,
        presentToday: 0,
        lateToday: 0,
        absentToday: 0,
        excusedToday: 0,
        pendingEarlyCount: 0,
        latePendingCount: 0,
        currentlyInSchool: 0,
        attendancePercent: 0,
      }
    );
    
    totals.attendancePercent = totals.totalStudents > 0
      ? Math.round(((totals.presentToday + totals.lateToday) / totals.totalStudents) * 100)
      : 0;
    
    // Weekly stats
    const weeklyStats = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dayNames = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
      return {
        date: d.toISOString().split('T')[0],
        dayName: dayNames[d.getDay()],
        present: Math.floor(totals.presentToday * (0.9 + Math.random() * 0.2)),
        late: Math.floor(totals.lateToday * (0.8 + Math.random() * 0.4)),
        absent: Math.floor(totals.absentToday * (0.8 + Math.random() * 0.4)),
      };
    });
    
    return {
      totals,
      schools: schoolsData,
      recentEvents: [],
      weeklyStats,
    };
  },
  
  async getRecentEvents(schoolId: string, limit = 10): Promise<AttendanceEvent[]> {
    await delay(MOCK_DELAY);
    return generateMockEvents(schoolId, limit);
  },
  
  async getEventHistory(schoolId: string, params: { startDate: string; endDate: string }) {
    await delay(MOCK_DELAY);
    return {
      data: generateMockEvents(schoolId, 50),
      timezone: 'Asia/Tashkent',
      startDate: params.startDate,
      endDate: params.endDate,
    };
  },
};

// ============ Attendance Service Mock ============
export const mockAttendanceService = {
  async getToday(schoolId: string, params?: { classId?: string }): Promise<DailyAttendance[]> {
    await delay(MOCK_DELAY);
    return generateMockAttendance(schoolId, params?.classId);
  },
  
  async getReport(schoolId: string, params: { classId?: string }): Promise<DailyAttendance[]> {
    await delay(MOCK_DELAY);
    return generateMockAttendance(schoolId, params.classId);
  },
  
  async update(id: string, data: Partial<DailyAttendance>): Promise<DailyAttendance> {
    await delay(MOCK_DELAY);
    const attendance = generateMockAttendance('school-1')[0];
    return { ...attendance, ...data, id };
  },
  
  async exportExcel(): Promise<Blob> {
    await delay(MOCK_DELAY);
    return new Blob(['Mock Attendance Report'], { type: 'application/octet-stream' });
  },
  
  async bulkUpdate(ids: string[], _status: string): Promise<{ updated: number }> {
    await delay(MOCK_DELAY);
    return { updated: ids.length };
  },
  
  async upsert(schoolId: string, data: { studentId: string; date: string; status: string }) {
    await delay(MOCK_DELAY);
    return {
      id: `attendance-${Date.now()}`,
      ...data,
      schoolId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },
};

// ============ Holidays Service Mock ============
export const mockHolidaysService = {
  async getAll(schoolId: string): Promise<Holiday[]> {
    await delay(MOCK_DELAY);
    return mockHolidays.filter((h) => h.schoolId === schoolId || h.schoolId === 'school-1');
  },
  
  async create(schoolId: string, data: Partial<Holiday>): Promise<Holiday> {
    await delay(MOCK_DELAY);
    const newHoliday: Holiday = {
      id: `holiday-${Date.now()}`,
      schoolId,
      date: data.date || new Date().toISOString().split('T')[0],
      name: data.name || 'Yangi bayram',
      createdAt: new Date().toISOString(),
    };
    mockHolidays.push(newHoliday);
    return newHoliday;
  },
  
  async delete(id: string): Promise<void> {
    await delay(MOCK_DELAY);
    const index = mockHolidays.findIndex((h) => h.id === id);
    if (index !== -1) mockHolidays.splice(index, 1);
  },
};

// ============ Users Service Mock ============
export const mockUsersService = {
  async getAll(schoolId: string) {
    await delay(MOCK_DELAY);
    return getMockSchoolUsers(schoolId);
  },
  
  async create(_schoolId: string, data: { name: string; email: string; role: string }) {
    await delay(MOCK_DELAY);
    return {
      id: `user-${Date.now()}`,
      ...data,
      createdAt: new Date().toISOString(),
    };
  },
  
  async delete(): Promise<void> {
    await delay(MOCK_DELAY);
  },
  
  async update(_schoolId: string, userId: string, data: { name?: string }) {
    await delay(MOCK_DELAY);
    return { id: userId, ...data, createdAt: new Date().toISOString() };
  },
  
  async getTeacherClasses(schoolId: string) {
    await delay(MOCK_DELAY);
    return mockClasses.filter((c) => c.schoolId === schoolId).slice(0, 3);
  },
  
  async assignClass(): Promise<void> {
    await delay(MOCK_DELAY);
  },
  
  async unassignClass(): Promise<void> {
    await delay(MOCK_DELAY);
  },
};

// ============ Search Service Mock ============
export const mockSearchService = {
  async search(schoolId: string, query: string) {
    await delay(MOCK_DELAY);
    if (!query) return [];
    
    const q = query.toLowerCase();
    const students = mockStudents
      .filter((s) => s.schoolId === schoolId && s.name.toLowerCase().includes(q))
      .slice(0, 5)
      .map((s) => ({
        id: s.id,
        title: s.name,
        subtitle: s.class?.name,
        route: `/students/${s.id}`,
      }));
    
    const classes = mockClasses
      .filter((c) => c.schoolId === schoolId && c.name.toLowerCase().includes(q))
      .slice(0, 3)
      .map((c) => ({
        id: c.id,
        title: c.name,
        subtitle: `${c.gradeLevel}-sinf`,
        route: `/classes/${c.id}`,
      }));
    
    return [
      { key: 'students', label: "O'quvchilar", items: students },
      { key: 'classes', label: 'Sinflar', items: classes },
    ];
  },
};
