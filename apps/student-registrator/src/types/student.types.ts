// Student related types

export interface StudentRow {
  id: string; // Local unique ID
  name: string;
  gender: string;
  className?: string;
  classId?: string;
  parentName?: string;
  parentPhone?: string;
  imageBase64?: string;
  status: "pending" | "success" | "error";
  error?: string;
  source: "manual" | "import"; // Qayerdan kelgani
  isEditing?: boolean; // Inline edit uchun
}

export interface ExcelImportMapping {
  sheet: string;
  classId: string;
  className: string;
  rowCount: number;
}
