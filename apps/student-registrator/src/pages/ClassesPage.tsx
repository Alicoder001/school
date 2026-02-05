import { useState, useEffect } from 'react';
import { fetchSchools, fetchClasses, createClass, getAuthUser } from '../api';
import { useGlobalToast } from '../hooks/useToast';
import { Icons } from '../components/ui/Icons';
import type { ClassInfo } from '../types';

export function ClassesPage() {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [newClassName, setNewClassName] = useState('');
  const [loading, setLoading] = useState(false);
  const { addToast } = useGlobalToast();

  useEffect(() => {
    const loadSchool = async () => {
      const user = getAuthUser();
      if (!user) return;

      try {
        const schools = await fetchSchools();
        const schoolId = user.schoolId || schools[0]?.id;
        if (schoolId) {
          setSelectedSchool(schoolId);
        }
      } catch (err) {
        console.error('Failed to load school:', err);
      }
    };

    loadSchool();
  }, []);

  useEffect(() => {
    if (!selectedSchool) {
      setClasses([]);
      return;
    }

    const loadClasses = async () => {
      try {
        const data = await fetchClasses(selectedSchool);
        setClasses(data);
      } catch (err) {
        console.error('Failed to load classes:', err);
        addToast('Sinflarni yuklashda xato', 'error');
      }
    };

    loadClasses();
  }, [selectedSchool, addToast]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) {
      addToast('Sinf nomini kiriting', 'error');
      return;
    }

    const gradeLevel = parseInt(newClassName) || 0;
    setLoading(true);

    try {
      await createClass(selectedSchool, newClassName, gradeLevel);
      addToast('Sinf yaratildi', 'success');
      setNewClassName('');
      
      // Reload classes
      const data = await fetchClasses(selectedSchool);
      setClasses(data);
    } catch (err: any) {
      addToast(err.message || 'Sinf yaratishda xato', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Sinflar</h1>
          <p className="page-description">Sinflarni boshqarish</p>
        </div>
      </div>

      <div className="page-content">
        <div className="two-column-layout">
          {/* Create Form */}
          <div className="card">
            <h2>Yangi sinf yaratish</h2>
            <form onSubmit={handleCreateClass}>
              <div className="form-group">
                <label>Sinf nomi *</label>
                <input
                  className="input"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="5-A, 6-B, ..."
                  required
                />
              </div>

              <button 
                type="submit" 
                className="button button-primary"
                disabled={loading}
              >
                <Icons.Plus /> Yaratish
              </button>
            </form>
          </div>

          {/* Classes List */}
          <div className="card">
            <h2>Sinflar ro'yxati</h2>
            {classes.length === 0 ? (
              <div className="empty-state">
                <Icons.School />
                <p>Sinflar yo'q</p>
              </div>
            ) : (
              <div className="class-list">
                {classes.map(cls => (
                  <div key={cls.id} className="class-item">
                    <div className="class-item-header">
                      <strong>{cls.name}</strong>
                      <span className="badge">{cls.totalStudents || 0} ta o'quvchi</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
