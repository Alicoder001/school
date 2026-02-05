import { useState, useCallback } from 'react';
import { registerStudent } from '../api';
import type { StudentRow } from '../types';

interface UseStudentTableReturn {
  students: StudentRow[];
  addStudent: (student: Omit<StudentRow, 'id' | 'source' | 'status'>) => void;
  updateStudent: (id: string, updates: Partial<StudentRow>) => void;
  deleteStudent: (id: string) => void;
  importStudents: (rows: Omit<StudentRow, 'id' | 'source' | 'status'>[]) => void;
  saveStudent: (id: string) => Promise<void>;
  saveAllPending: () => Promise<void>;
  clearTable: () => void;
  isSaving: boolean;
}

export function useStudentTable(): UseStudentTableReturn {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Qo'lda bitta qo'shish
  const addStudent = useCallback((student: Omit<StudentRow, 'id' | 'source' | 'status'>) => {
    const newStudent: StudentRow = {
      ...student,
      id: `manual-${Date.now()}-${Math.random()}`,
      source: 'manual',
      status: 'pending',
    };
    setStudents(prev => [...prev, newStudent]);
  }, []);

  // Excel import (bulk)
  const importStudents = useCallback((rows: Omit<StudentRow, 'id' | 'source' | 'status'>[]) => {
    const imported: StudentRow[] = rows.map((row, idx) => ({
      ...row,
      id: `import-${Date.now()}-${idx}`,
      source: 'import',
      status: 'pending',
    }));
    setStudents(prev => [...prev, ...imported]);
  }, []);

  // Update student
  const updateStudent = useCallback((id: string, updates: Partial<StudentRow>) => {
    setStudents(prev => prev.map(s => 
      s.id === id ? { ...s, ...updates } : s
    ));
  }, []);

  // Delete student
  const deleteStudent = useCallback((id: string) => {
    setStudents(prev => prev.filter(s => s.id !== id));
  }, []);

  // Bitta studentni saqlash
  const saveStudent = useCallback(async (id: string) => {
    const student = students.find(s => s.id === id);
    if (!student) return;

    // Validation
    if (!student.name || !student.name.trim()) {
      setStudents(prev => prev.map(s => 
        s.id === id ? { 
          ...s, 
          status: 'error' as const, 
          error: 'Ism majburiy' 
        } : s
      ));
      throw new Error('Ism majburiy');
    }

    if (!student.classId) {
      setStudents(prev => prev.map(s => 
        s.id === id ? { 
          ...s, 
          status: 'error' as const, 
          error: 'Sinf tanlanmagan' 
        } : s
      ));
      throw new Error('Sinf tanlanmagan');
    }

    // Set to pending
    setStudents(prev => prev.map(s => 
      s.id === id ? { ...s, status: 'pending' as const, error: undefined } : s
    ));

    console.log(`[Save Student] Saving "${student.name}":`, {
      name: student.name,
      gender: student.gender,
      className: student.className,
      classId: student.classId,
      hasImage: !!student.imageBase64,
    });

    try {
      await registerStudent(
        student.name.trim(),
        student.gender,
        student.imageBase64 || '',
        {
          parentName: student.parentName,
          parentPhone: student.parentPhone,
          classId: student.classId,
        }
      );
      
      setStudents(prev => prev.map(s => 
        s.id === id ? { ...s, status: 'success' as const } : s
      ));
    } catch (err) {
      setStudents(prev => prev.map(s => 
        s.id === id ? { 
          ...s, 
          status: 'error' as const, 
          error: String(err) 
        } : s
      ));
      throw err;
    }
  }, [students]);

  // Barcha pending larni saqlash
  const saveAllPending = useCallback(async () => {
    const pending = students.filter(s => s.status === 'pending');
    if (pending.length === 0) return;

    setIsSaving(true);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const student of pending) {
      try {
        await saveStudent(student.id);
        successCount++;
      } catch (err) {
        errorCount++;
        // Error already handled in saveStudent
        console.error(`Failed to save student ${student.name}:`, err);
      }
    }
    
    setIsSaving(false);
    
    console.log(`[Save All] Success: ${successCount}, Errors: ${errorCount}`);
    
    // Throw error if any failed
    if (errorCount > 0) {
      throw new Error(`${errorCount} ta o'quvchini saqlashda xato`);
    }
  }, [students, saveStudent]);

  // Clear table
  const clearTable = useCallback(() => {
    setStudents([]);
  }, []);

  return {
    students,
    addStudent,
    updateStudent,
    deleteStudent,
    importStudents,
    saveStudent,
    saveAllPending,
    clearTable,
    isSaving,
  };
}
