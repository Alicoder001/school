import { useState, useRef } from 'react';
import { Icons } from '../ui/Icons';
import { fileToFaceBase64 } from '../../api';
import type { StudentRow, ClassInfo } from '../../types';

interface StudentTableRowProps {
  index: number;
  student: StudentRow;
  availableClasses: ClassInfo[];
  onEdit: (id: string, updates: Partial<StudentRow>) => void;
  onDelete: (id: string) => void;
  onSave: (id: string) => Promise<void>;
}

export function StudentTableRow({ index, student, availableClasses, onEdit, onDelete, onSave }: StudentTableRowProps) {
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (field: keyof StudentRow, value: any) => {
    console.log(`[Table Row] Editing ${field}:`, value);
    onEdit(student.id, { [field]: value });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const imageBase64 = await fileToFaceBase64(file);
      onEdit(student.id, { imageBase64 });
    } catch (err) {
      console.error('Image upload error:', err);
      alert('Rasm yuklashda xato');
    }
  };

  const handleSaveClick = async () => {
    setIsSaving(true);
    try {
      await onSave(student.id);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const rowClass = student.status === 'success' ? 'status-success' : 
                   student.status === 'error' ? 'status-error' : '';

  return (
    <tr className={rowClass}>
      <td>{index}</td>
      <td>
        <input
          className="input input-sm table-input"
          value={student.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="Ism va familiya"
          disabled={student.status === 'success'}
        />
      </td>
      <td>
        <select
          className="input input-sm table-input"
          value={student.gender}
          onChange={(e) => handleChange('gender', e.target.value)}
          disabled={student.status === 'success'}
        >
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="unknown">Unknown</option>
        </select>
      </td>
      <td>
        <select
          className="input input-sm table-input"
          value={student.classId || ''}
          onChange={(e) => {
            const classId = e.target.value;
            const className = availableClasses.find(c => c.id === classId)?.name;
            handleChange('classId', classId);
            if (className) handleChange('className', className);
          }}
          disabled={student.status === 'success'}
        >
          <option value="">Tanlang</option>
          {availableClasses.map(cls => (
            <option key={cls.id} value={cls.id}>{cls.name}</option>
          ))}
        </select>
      </td>
      <td>
        <input
          className="input input-sm table-input"
          value={student.parentName || ''}
          onChange={(e) => handleChange('parentName', e.target.value)}
          placeholder="Ota-ona"
          disabled={student.status === 'success'}
        />
      </td>
      <td>
        <input
          className="input input-sm table-input"
          value={student.parentPhone || ''}
          onChange={(e) => handleChange('parentPhone', e.target.value)}
          placeholder="+998..."
          disabled={student.status === 'success'}
        />
      </td>
      <td>
        <div className="image-cell">
          {student.imageBase64 ? (
            <div className="image-preview-wrapper">
              <img 
                src={`data:image/jpeg;base64,${student.imageBase64}`}
                alt={student.name}
                className="image-preview"
                title="Rasm ko'rish"
              />
              {student.status !== 'success' && (
                <button
                  className="btn-change-image"
                  onClick={() => fileInputRef.current?.click()}
                  title="Rasmni o'zgartirish"
                >
                  <Icons.Edit />
                </button>
              )}
            </div>
          ) : (
            <button
              className="btn-upload"
              onClick={() => fileInputRef.current?.click()}
              disabled={student.status === 'success'}
              title="Rasm yuklash"
            >
              <Icons.Upload />
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageUpload}
          />
        </div>
      </td>
      <td>
        {student.status === 'pending' && (
          <span className="badge badge-warning">Pending</span>
        )}
        {student.status === 'success' && (
          <span className="badge badge-success">Saved</span>
        )}
        {student.status === 'error' && (
          <span className="badge badge-danger" title={student.error}>
            {student.error && student.error.length < 20 ? student.error : 'Error'}
          </span>
        )}
      </td>
      <td>
        <div className="action-buttons">
          {student.status !== 'success' && (
            <button
              className="btn-icon btn-success"
              onClick={handleSaveClick}
              disabled={isSaving}
              title="Saqlash"
            >
              {isSaving ? <span className="spinner" /> : <Icons.Save />}
            </button>
          )}
          <button
            className="btn-icon btn-danger"
            onClick={() => onDelete(student.id)}
            title="O'chirish"
          >
            <Icons.Trash />
          </button>
        </div>
      </td>
    </tr>
  );
}
