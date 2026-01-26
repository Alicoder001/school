import { EventEmitter } from 'events';

// Global event emitter for real-time attendance events
export const attendanceEmitter = new EventEmitter();

// Allow massive concurrent SSE connections for high-load scenarios
// 10,000+ concurrent connections support
attendanceEmitter.setMaxListeners(0); // 0 = unlimited listeners

// SuperAdmin dashboard uchun global event emitter
export const adminEmitter = new EventEmitter();
adminEmitter.setMaxListeners(0); // unlimited for scalability

// Connection tracking for monitoring
let activeConnections = 0;
const connectionsBySchool: Map<string, number> = new Map();

export const trackConnection = (schoolId: string, action: 'connect' | 'disconnect') => {
  if (action === 'connect') {
    activeConnections++;
    connectionsBySchool.set(schoolId, (connectionsBySchool.get(schoolId) || 0) + 1);
  } else {
    activeConnections--;
    const current = connectionsBySchool.get(schoolId) || 1;
    if (current <= 1) {
      connectionsBySchool.delete(schoolId);
    } else {
      connectionsBySchool.set(schoolId, current - 1);
    }
  }
};

export const getConnectionStats = () => ({
  total: activeConnections,
  bySchool: Object.fromEntries(connectionsBySchool),
});

// Event types
export interface AttendanceEventPayload {
  schoolId: string;
  event: {
    id: string;
    studentId: string | null;
    eventType: 'IN' | 'OUT';
    timestamp: string;
    student?: {
      id: string;
      name: string;
      class?: { name: string } | null;
    } | null;
  };
}

// Admin dashboard uchun aggregated event
export interface AdminEventPayload {
  type: 'school_stats_update' | 'attendance_event';
  schoolId: string;
  schoolName?: string;
  data: {
    totalStudents?: number;
    presentToday?: number;
    lateToday?: number;
    absentToday?: number;
    currentlyInSchool?: number;
    event?: AttendanceEventPayload['event'];
  };
}
