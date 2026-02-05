import ExcelJS from "exceljs";
import type { StudentRow } from '../types';

// Excel parse qilish (App.tsx dan ko'chirilgan)
export async function parseExcelFile(file: File): Promise<Omit<StudentRow, 'id' | 'source' | 'status'>[]> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  
  // Get images from workbook
  const media = (workbook.model as { media?: Array<{ type: string; name: string; buffer: ArrayBuffer }> }).media || [];
  console.log(`[Parse] Workbook media count: ${media.length}`);
  
  const allRows: Omit<StudentRow, 'id' | 'source' | 'status'>[] = [];
  
  // Process each worksheet (each represents a class)
  for (const worksheet of workbook.worksheets) {
    const sheetName = worksheet.name;
    console.log(`[Parse] Processing sheet: "${sheetName}"`);
    
    // Create image map by row for this worksheet
    const worksheetImages = worksheet.getImages();
    console.log(`[Parse] Sheet "${sheetName}" has ${worksheetImages.length} images`);
    const imageByRow: Record<number, string> = {};
    
    for (const img of worksheetImages) {
      const rowNum = img.range.tl.nativeRow + 1; // 1-indexed
      const mediaIndex = typeof img.imageId === 'number' ? img.imageId : parseInt(img.imageId, 10);
      console.log(`[Parse] Image at row ${rowNum}, mediaIndex: ${mediaIndex}`);
      
      const mediaItem = media[mediaIndex];
      if (mediaItem && mediaItem.buffer) {
        const uint8Array = new Uint8Array(mediaItem.buffer);
        console.log(`[Parse] Image buffer size: ${uint8Array.length} bytes`);
        let binary = '';
        for (let i = 0; i < uint8Array.length; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }
        const base64 = btoa(binary);
        imageByRow[rowNum] = base64;
        console.log(`[Parse] Image added to row ${rowNum}, base64 length: ${base64.length}`);
      } else {
        console.log(`[Parse] No media found for index ${mediaIndex}`);
      }
    }
    
    // Find data start row
    let dataStartRow = 2;
    
    worksheet.eachRow((row, rowNumber) => {
      const firstCell = String(row.getCell(1).value || "").trim();
      if (firstCell === "#" || firstCell.toLowerCase() === "name" || firstCell.toLowerCase() === "full name") {
        dataStartRow = rowNumber + 1;
      }
    });
    
    // Parse data rows
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber < dataStartRow) return;
      
      const hasNumberColumn = String(row.getCell(1).value || "").trim().match(/^\d+$/);
      
      let name: string, gender: string, parentName: string, parentPhone: string;
      
      if (hasNumberColumn) {
        name = String(row.getCell(2).value || "").trim();
        gender = String(row.getCell(3).value || "unknown").toLowerCase();
        parentName = String(row.getCell(4).value || "").trim();
        parentPhone = String(row.getCell(5).value || "").trim();
      } else {
        name = String(row.getCell(1).value || "").trim();
        gender = String(row.getCell(2).value || "unknown").toLowerCase();
        parentName = String(row.getCell(4).value || "").trim();
        parentPhone = String(row.getCell(5).value || "").trim();
      }
      
      if (name && !name.startsWith("📚") && !name.startsWith("📖") && !name.startsWith("💡")) {
        console.log(`[Parse] Row ${rowNumber}: name="${name}", gender="${gender}", class="${sheetName}"`);
        allRows.push({
          name,
          gender,
          className: sheetName,
          parentName: parentName || undefined,
          parentPhone: parentPhone || undefined,
          imageBase64: imageByRow[rowNumber],
        });
      }
    });
  }
  
  console.log(`[Parse] Total rows parsed: ${allRows.length}`);
  return allRows;
}
