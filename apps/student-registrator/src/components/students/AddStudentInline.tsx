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
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('male');
  const [classId, setClassId] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      alert("Ism va familiya majburiy!");
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
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        fatherName: fatherName.trim() || undefined,
        gender,
        classId: classId || undefined,
        className: selectedClass?.name,
        parentPhone: parentPhone.trim() || undefined,
        imageBase64,
      });

      // Reset form
      setFirstName('');
      setLastName('');
      setGender('male');
      setClassId('');
      setFatherName('');
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
          <label>Familiya *</label>
          <input
            className="input"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Familiya"
          />
        </div>

        <div className="form-group">
          <label>Ism *</label>
          <input
            className="input"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Ism"
          />
        </div>

        <div className="form-group">
          <label>Jinsi</label>
          <select className="input" value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="male">Erkak</option>
            <option value="female">Ayol</option>
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
          <label>Otasining ismi</label>
          <input
            className="input"
            value={fatherName}
            onChange={(e) => setFatherName(e.target.value)}
            placeholder="Otasining ismi"
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
