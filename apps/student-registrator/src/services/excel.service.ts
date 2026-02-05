import ExcelJS from "exceljs";
import boySampleImg from "../assets/boy_sample.png";
import girlSampleImg from "../assets/girl_sample.png";
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

export async function downloadStudentsTemplate(classNames: string[]): Promise<void> {
  const cleanedNames = classNames.map((name) => name.trim()).filter(Boolean);
  if (cleanedNames.length === 0) {
    throw new Error("Kamida bitta sinf tanlang");
  }

  const colors = {
    headerBg: "FFF1F5F9",
    headerText: "FF334155",
    border: "FFE2E8F0",
  };

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Student Registrator";
  workbook.created = new Date();

  let boyImageId: number | undefined;
  let girlImageId: number | undefined;

  try {
    const boyResponse = await fetch(boySampleImg);
    const boyArrayBuffer = await boyResponse.arrayBuffer();
    boyImageId = workbook.addImage({ buffer: boyArrayBuffer, extension: "png" });

    const girlResponse = await fetch(girlSampleImg);
    const girlArrayBuffer = await girlResponse.arrayBuffer();
    girlImageId = workbook.addImage({ buffer: girlArrayBuffer, extension: "png" });
  } catch (err) {
    console.error("Template images could not be loaded:", err);
  }

  for (const className of cleanedNames) {
    const worksheet = workbook.addWorksheet(className);

    worksheet.getColumn(1).width = 5;
    worksheet.getColumn(2).width = 28;
    worksheet.getColumn(3).width = 10;
    worksheet.getColumn(4).width = 24;
    worksheet.getColumn(5).width = 18;
    worksheet.getColumn(6).width = 14;

    const headers = ["#", "Full Name", "Gender", "Parent Name", "Parent Phone", "Photo"];
    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, size: 10, color: { argb: colors.headerText } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.headerBg } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        bottom: { style: "thin", color: { argb: colors.border } },
      };
    });
    headerRow.height = 24;

    const sampleData = [
      { name: "Aliyev Vali", gender: "male", parent: "Aliyev Sobir", phone: "+998901234567" },
      { name: "Karimova Nodira", gender: "female", parent: "Karimova Malika", phone: "+998907654321" },
    ];

    sampleData.forEach((student, index) => {
      const row = worksheet.addRow([
        index + 1,
        student.name,
        student.gender,
        student.parent,
        student.phone,
        "",
      ]);

      row.height = 65;
      row.eachCell((cell, colNumber) => {
        cell.alignment = { horizontal: colNumber === 1 ? "center" : "left", vertical: "middle" };
        cell.border = {
          bottom: { style: "thin", color: { argb: colors.border } },
        };
      });

      if (boyImageId !== undefined && girlImageId !== undefined) {
        const imageId = student.gender === "male" ? boyImageId : girlImageId;
        const rowIndex = row.number - 1;
        worksheet.addImage(imageId, {
          tl: { col: 5, row: rowIndex },
          ext: { width: 60, height: 60 },
        });
      }
    });

    for (let i = 0; i < 10; i++) {
      const row = worksheet.addRow([sampleData.length + i + 1, "", "", "", "", ""]);
      row.height = 65;
      row.eachCell((cell, colNumber) => {
        cell.alignment = { horizontal: colNumber === 1 ? "center" : "left", vertical: "middle" };
        cell.border = {
          bottom: { style: "thin", color: { argb: colors.border } },
        };
      });
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "students_template.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}
