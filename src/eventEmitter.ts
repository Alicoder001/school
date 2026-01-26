import { EventEmitter } from 'events';

// Global event emitter for real-time attendance events
export const attendanceEmitter = new EventEmitter();

// Allow multiple SSE connections (one per dashboard client)
attendanceEmitter.setMaxListeners(100);

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
