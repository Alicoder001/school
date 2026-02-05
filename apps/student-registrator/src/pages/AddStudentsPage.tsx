import { useState, useEffect } from 'react';
import { fetchSchools, fetchClasses, getAuthUser } from '../api';
import { useStudentTable } from '../hooks/useStudentTable';
import { useExcelImport } from '../hooks/useExcelImport';
import { useGlobalToast } from '../hooks/useToast';
import { StudentTable } from '../components/students/StudentTable';
import { ExcelImportButton } from '../components/students/ExcelImportButton';
import { ImportMappingPanel } from '../components/students/ImportMappingPanel';
import { ProvisioningPanel } from '../components/students/ProvisioningPanel';
import { downloadStudentsTemplate } from '../services/excel.service';
import { Icons } from '../components/ui/Icons';
import type { ClassInfo } from '../types';

export function AddStudentsPage() {
  const [availableClasses, setAvailableClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const {
    students,
    addStudent,
    updateStudent,
    deleteStudent,
    importStudents,
    applyClassMapping,
    saveStudent,
    saveAllPending,
    isSaving,
    lastRegisterResult,
    lastProvisioningId,
  } = useStudentTable();
  const { parseExcel, resizeImages } = useExcelImport();
  const { addToast } = useGlobalToast();

  // Load school and classes
  useEffect(() => {
    const loadData = async () => {
      const user = getAuthUser();
      if (!user) return;

      try {
        const schools = await fetchSchools();
        const schoolId = user.schoolId || schools[0]?.id;
        
        if (schoolId) {
          const classes = await fetchClasses(schoolId);
          console.log('[AddStudents] Loaded classes from backend:', classes);
          setAvailableClasses(classes);
        }
      } catch (err) {
        console.error('Failed to load data:', err);
        addToast('Ma\'lumotlarni yuklashda xato', 'error');
      }
    };

    loadData();
  }, [addToast]);

  // Handle Excel import
  const handleExcelImport = async (file: File) => {
    console.log('[Excel Import] Starting with availableClasses:', availableClasses);
    
    if (availableClasses.length === 0) {
      addToast('Sinflar yuklanmagan! Sahifani yangilang.', 'error');
      return;
    }
    
    setLoading(true);
    try {
      const rows = await parseExcel(file, availableClasses);
      const resized = await resizeImages(rows);
      
      // Check if all rows have classId
      const withoutClass = resized.filter(r => !r.classId);
      if (withoutClass.length > 0) {
        console.warn('[Excel Import] Rows without classId:', withoutClass.map(r => r.name));
        addToast(`${withoutClass.length} ta o'quvchining sinfi topilmadi!`, 'error');
      }
      
      importStudents(resized);
      addToast(`${resized.length} ta o'quvchi yuklandi`, 'success');
    } catch (err) {
      console.error('Excel import error:', err);
      addToast('Excel yuklashda xato', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    if (availableClasses.length === 0) {
      addToast('Sinflar yuklanmagan!', 'error');
      return;
    }
    try {
      await downloadStudentsTemplate(availableClasses.map((cls) => cls.name));
      addToast('Shablon yuklandi', 'success');
    } catch (err) {
      console.error('Template download error:', err);
      addToast('Shablon yuklashda xato', 'error');
    }
  };

  // Handle save student
  const handleSaveStudent = async (id: string) => {
    try {
      await saveStudent(id);
      addToast('O\'quvchi saqlandi', 'success');
    } catch (err: any) {
      // Check if it's validation error
      const errorMsg = err?.message || 'Saqlashda xato';
      addToast(errorMsg, 'error');
    }
  };

  // Handle save all
  const handleSaveAll = async () => {
    const pendingCount = students.filter(s => s.status === 'pending').length;
    if (pendingCount === 0) {
      addToast('Saqlanishi kerak bo\'lgan o\'quvchilar yo\'q', 'error');
      return;
    }

    try {
      const { successCount, errorCount } = await saveAllPending();
      if (errorCount > 0) {
        addToast(`${errorCount} ta xato, ${successCount} ta saqlandi`, 'error');
        return;
      }
      addToast(`${successCount} ta o'quvchi saqlandi`, 'success');
    } catch (err) {
      addToast('Ba\'zi o\'quvchilarni saqlashda xato', 'error');
    }
  };

  const pendingCount = students.filter(s => s.status === 'pending').length;
  const successCount = students.filter(s => s.status === 'success').length;
  const errorCount = students.filter(s => s.status === 'error').length;

  // Add empty row handler
  const handleAddRow = () => {
    addStudent({
      name: '',
      gender: 'male',
      classId: undefined,
      className: undefined,
      parentName: undefined,
      parentPhone: undefined,
      imageBase64: undefined,
    });
  };

  const handleApplyMapping = (className: string, classId: string) => {
    if (!classId) return;
    const selectedClass = availableClasses.find((cls) => cls.id === classId);
    applyClassMapping(className, classId, selectedClass?.name);
  };

  return (
    <div className="page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">O'quvchilar qo'shish</h1>
          <p className="page-description">
            Jadvalni to'ldiring yoki Excel yuklang
          </p>
        </div>

        <div className="page-actions">
          <ExcelImportButton 
            onImport={handleExcelImport} 
            disabled={loading}
          />
          <button
            type="button"
            className="button button-secondary"
            onClick={handleDownloadTemplate}
            disabled={loading}
          >
            <Icons.Download /> Shablon yuklash
          </button>

          {pendingCount > 0 && (
            <button 
              className="button button-success" 
              onClick={handleSaveAll}
              disabled={isSaving}
            >
              <Icons.Save /> Barchasini Saqlash ({pendingCount})
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      {students.length > 0 && (
        <div className="stats-bar">
          <div className="stat-item">
            <span className="stat-label">Jami:</span>
            <span className="stat-value">{students.length}</span>
          </div>
          <div className="stat-item stat-warning">
            <span className="stat-label">Kutilmoqda:</span>
            <span className="stat-value">{pendingCount}</span>
          </div>
          <div className="stat-item stat-success">
            <span className="stat-label">Saqlandi:</span>
            <span className="stat-value">{successCount}</span>
          </div>
          {errorCount > 0 && (
            <div className="stat-item stat-danger">
              <span className="stat-label">Xato:</span>
              <span className="stat-value">{errorCount}</span>
            </div>
          )}
        </div>
      )}

      <ImportMappingPanel
        students={students}
        availableClasses={availableClasses}
        onApplyMapping={handleApplyMapping}
      />

      <ProvisioningPanel
        provisioningId={lastProvisioningId}
        registerResult={lastRegisterResult}
      />

      {/* Table */}
      <div className="page-content">
        <StudentTable
          students={students}
          availableClasses={availableClasses}
          onEdit={updateStudent}
          onDelete={(id) => {
            deleteStudent(id);
            addToast('O\'quvchi o\'chirildi', 'success');
          }}
          onSave={handleSaveStudent}
          onAddRow={handleAddRow}
        />
      </div>
    </div>
  );
}
