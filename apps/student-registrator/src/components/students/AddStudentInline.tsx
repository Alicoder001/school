import { useState } from 'react';
import { Icons } from '../ui/Icons';
import { fileToFaceBase64 } from '../../api';
import type { StudentRow, ClassInfo } from '../../types';

interface AddStudentInlineProps {
  availableClasses: ClassInfo[];
  onAdd: (student: Omit<StudentRow, 'id' | 'source' | 'status'>) => void;
  onCancel: () => void;
}

export function AddStudentInline({ availableClasses, onAdd, onCancel }: AddStudentInlineProps) {
  const [name, setName] = useState('');
  const [gender, setGender] = useState('male');
  const [classId, setClassId] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert("Ism majburiy!");
      return;
    }

    setLoading(true);
    try {
      let imageBase64 = '';
      if (imageFile) {
        imageBase64 = await fileToFaceBase64(imageFile);
      }

      const selectedClass = availableClasses.find(c => c.id === classId);

      onAdd({
        name: name.trim(),
        gender,
        classId: classId || undefined,
        className: selectedClass?.name,
        parentName: parentName.trim() || undefined,
        parentPhone: parentPhone.trim() || undefined,
        imageBase64,
      });

      // Reset form
      setName('');
      setGender('male');
      setClassId('');
      setParentName('');
      setParentPhone('');
      setImageFile(null);
      onCancel();
    } catch (err) {
      alert(`Xato: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-student-inline">
      <div className="inline-form-header">
        <h3>Yangi o'quvchi qo'shish</h3>
      </div>
      
      <div className="inline-form-grid">
        <div className="form-group">
          <label>Ism *</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ism va familiya"
          />
        </div>

        <div className="form-group">
          <label>Jinsi</label>
          <select className="input" value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>

        <div className="form-group">
          <label>Sinf</label>
          <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Tanlang</option>
            {availableClasses.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Ota-ona</label>
          <input
            className="input"
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
            placeholder="Ota-ona ismi"
          />
        </div>

        <div className="form-group">
          <label>Telefon</label>
          <input
            className="input"
            value={parentPhone}
            onChange={(e) => setParentPhone(e.target.value)}
            placeholder="+998901234567"
          />
        </div>

        <div className="form-group">
          <label>Rasm</label>
          <input
            type="file"
            className="input"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0] || null)}
          />
        </div>
      </div>

      <div className="inline-form-actions">
        <button className="button button-primary" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Qo\'shilmoqda...' : <><Icons.Plus /> Qo'shish</>}
        </button>
        <button className="button button-secondary" onClick={onCancel} disabled={loading}>
          <Icons.X /> Bekor qilish
        </button>
      </div>
    </div>
  );
}
