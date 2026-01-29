import { EventEmitter } from "events";
import type {
  ClassSnapshotPayload,
  SchoolSnapshotPayload,
} from "./snapshot.service";

const schoolEmitters = new Map<string, EventEmitter>();
const classEmitters = new Map<string, EventEmitter>();
const classSubscriberCounts = new Map<string, number>();
const adminEmitter = new EventEmitter();

adminEmitter.setMaxListeners(0);

const getSchoolEmitter = (schoolId: string) => {
  let emitter = schoolEmitters.get(schoolId);
  if (!emitter) {
    emitter = new EventEmitter();
    emitter.setMaxListeners(0);
    schoolEmitters.set(schoolId, emitter);
  }
  return emitter;
};

const getClassEmitter = (key: string) => {
  let emitter = classEmitters.get(key);
  if (!emitter) {
    emitter = new EventEmitter();
    emitter.setMaxListeners(0);
    classEmitters.set(key, emitter);
  }
  return emitter;
};

export function emitSchoolSnapshot(snapshot: SchoolSnapshotPayload) {
  const emitter = getSchoolEmitter(snapshot.schoolId);
  emitter.emit("snapshot", snapshot);
  adminEmitter.emit("snapshot", snapshot);
}

export function emitClassSnapshot(snapshot: ClassSnapshotPayload) {
  const key = `${snapshot.schoolId}:${snapshot.classId}`;
  const emitter = getClassEmitter(key);
  emitter.emit("snapshot", snapshot);
}

export function onSchoolSnapshot(
  schoolId: string,
  handler: (snapshot: SchoolSnapshotPayload) => void,
) {
  const emitter = getSchoolEmitter(schoolId);
  emitter.on("snapshot", handler);
  return () => emitter.off("snapshot", handler);
}

export function onClassSnapshot(
  schoolId: string,
  classId: string,
  handler: (snapshot: ClassSnapshotPayload) => void,
) {
  const key = `${schoolId}:${classId}`;
  const emitter = getClassEmitter(key);
  emitter.on("snapshot", handler);
  classSubscriberCounts.set(key, (classSubscriberCounts.get(key) || 0) + 1);
  return () => {
    emitter.off("snapshot", handler);
    const next = (classSubscriberCounts.get(key) || 1) - 1;
    if (next <= 0) {
      classSubscriberCounts.delete(key);
    } else {
      classSubscriberCounts.set(key, next);
    }
  };
}

export function onAdminSnapshot(
  handler: (snapshot: SchoolSnapshotPayload) => void,
) {
  adminEmitter.on("snapshot", handler);
  return () => adminEmitter.off("snapshot", handler);
}

export function getActiveClassKeys(): string[] {
  return Array.from(classSubscriberCounts.keys());
}
