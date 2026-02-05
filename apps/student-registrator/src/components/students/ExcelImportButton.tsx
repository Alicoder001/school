import { useRef } from 'react';
import { Icons } from '../ui/Icons';

interface ExcelImportButtonProps {
  onImport: (file: File) => void;
  disabled?: boolean;
}

export function ExcelImportButton({ onImport, disabled }: ExcelImportButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      onImport(file);
      // Reset input
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    } else if (file) {
      alert('Iltimos, Excel fayl (.xlsx yoki .xls) tanlang');
    }
  };

  return (
    <>
      <button 
        className="button button-secondary" 
        onClick={handleClick}
        disabled={disabled}
      >
        <Icons.Upload /> Excel Import
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
    </>
  );
}
