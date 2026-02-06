import type { ClassInfo } from '../../types';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedClassId: string;
  classes: ClassInfo[];
  onClassChange: (classId: string) => void;
  selectedStatus?: string;
  onStatusChange?: (status: string) => void;
}

export function FilterBar({
  searchQuery,
  onSearchChange,
  selectedClassId,
  classes,
  onClassChange,
  selectedStatus = '',
  onStatusChange,
}: FilterBarProps) {
  return (
    <div className="filter-bar">
      <div className="form-group">
        <label>Sinf:</label>
        <select
          className="input"
          value={selectedClassId}
          onChange={(e) => onClassChange(e.target.value)}
          aria-label="Sinf bo'yicha filter"
        >
          <option value="">Barcha sinflar</option>
          {classes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Qidirish:</label>
        <input
          className="input"
          placeholder="Ism yoki Device ID..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="O'quvchini qidirish"
        />
      </div>

      {onStatusChange && (
        <div className="form-group">
          <label>Holat:</label>
          <select
            className="input"
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            aria-label="Holat bo'yicha filter"
          >
            <option value="">Barchasi</option>
            <option value="ok">OK</option>
            <option value="issue">Muammo</option>
          </select>
        </div>
      )}
    </div>
  );
}
