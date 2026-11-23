import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SYSTEM_BRANDING } from './wcr-constants';
import { DepotCadreRow } from '@/types/wcr';

export interface ExportMetadata {
  reportTitle: string;
  fileNameBase: string;
  generatedBy: string;
  activeFilters: string;
  isWideMatrix?: boolean;
}

export async function exportCadreMatrixToExcel(rows: DepotCadreRow[], meta: ExportMetadata) {
  const wb = new ExcelJS.Workbook();
  wb.creator = SYSTEM_BRANDING.developerAttribution;
  const ws = wb.addWorksheet('WCR Cadre Position', {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 5 }],
  });

  // 2 columns (DIV, CODE) + 7 post groups * 4 cols = 30 columns (A to AD)
  ws.mergeCells('A1:AD1');
  ws.getCell('A1').value = SYSTEM_BRANDING.primaryHeader;
  ws.getCell('A1').font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
  ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2942' } };

  ws.mergeCells('A2:AD2');
  ws.getCell('A2').value = `${meta.reportTitle} | Filters: ${meta.activeFilters} | Generated: ${new Date().toLocaleString('en-IN')}`;
  ws.getCell('A2').font = { italic: true, size: 10 };

  ws.mergeCells('A3:AD3');
  ws.getCell('A3').value = `${SYSTEM_BRANDING.developerAttribution} | ${SYSTEM_BRANDING.hindiFooter}`;
  ws.getCell('A3').font = { size: 9, color: { argb: 'FF334155' } };

  ws.mergeCells('A4:B4');
  ws.getCell('A4').value = 'LOBBY';

  const groups = ['ALP', 'LPS', 'LPG', 'LPP', 'LPM', 'ALL LP', 'CLI'] as const;
  let colIdx = 3;
  for (const grp of groups) {
    ws.mergeCells(4, colIdx, 4, colIdx + 3);
    ws.getCell(4, colIdx).value = grp;
    colIdx += 4;
  }

  const subHeaders = ['DIV', 'CODE'];
  for (let i = 0; i < groups.length; i++) subHeaders.push('SS', 'MOR', 'VAC', '%');
  const row5 = ws.getRow(5);
  subHeaders.forEach((h, idx) => {
    row5.getCell(idx + 1).value = h;
  });

  [4, 5].forEach((rNum) => {
    const row = ws.getRow(rNum);
    row.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2942' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
  });

  rows.forEach((r) => {
    const vals: (string | number)[] = [r.division_code, r.depot_code];
    for (const grp of groups) {
      const m = r.posts[grp];
      vals.push(m.ss, m.mor, m.vac, m.vacPercent);
    }
    const added = ws.addRow(vals);
    added.eachCell((c) => {
      c.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
    });
  });

  const totVals: (string | number)[] = ['WCR', 'TOTAL'];
  for (const grp of groups) {
    const ss = rows.reduce((s, r) => s + r.posts[grp].ss, 0);
    const mor = rows.reduce((s, r) => s + r.posts[grp].mor, 0);
    const vac = rows.reduce((s, r) => s + r.posts[grp].vac, 0);
    const pct = ss === 0 ? 'N/A' : `${((vac / ss) * 100).toFixed(2)}%`;
    totVals.push(ss, mor, vac, pct);
  }
  const totRow = ws.addRow(totVals);
  totRow.font = { bold: true };
  totRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

  ws.columns.forEach((col) => {
    col.width = 9.5;
  });

  const buffer = await wb.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${meta.fileNameBase}.xlsx`
  );
}

export async function exportGenericTableToExcel(
  headers: string[],
  rows: Record<string, any>[],
  keys: string[],
  meta: ExportMetadata
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Report', { views: [{ state: 'frozen', ySplit: 4 }] });

  ws.mergeCells(1, 1, 1, headers.length);
  ws.getCell(1, 1).value = SYSTEM_BRANDING.primaryHeader;
  ws.getCell(1, 1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  ws.getCell(1, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2942' } };

  ws.mergeCells(2, 1, 2, headers.length);
  ws.getCell(2, 1).value = `${meta.reportTitle} | ${SYSTEM_BRANDING.developerAttribution}`;

  const headerRow = ws.getRow(4);
  headers.forEach((h, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2942' } };
  });

  rows.forEach((r) => {
    const row = ws.addRow(keys.map((k) => r[k] ?? ''));
    keys.forEach((k, idx) => {
      if (k === 'emp_no' || k === 'crew_id') row.getCell(idx + 1).numFmt = '@';
    });
  });

  ws.columns.forEach((c) => {
    c.width = 18;
  });

  const buffer = await wb.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${meta.fileNameBase}.xlsx`
  );
}

export function exportToCsv(headers: string[], rows: (string | number)[][], fileNameBase: string) {
  const escape = (val: string | number) => `"${String(val ?? '').replace(/"/g, '""')}"`;
  const csvLines = [
    `# ${SYSTEM_BRANDING.primaryHeader}`,
    `# ${SYSTEM_BRANDING.developerAttribution} | ${SYSTEM_BRANDING.hindiFooter}`,
    headers.map(escape).join(','),
    ...rows.map((r) => r.map(escape).join(',')),
  ];
  const blob = new Blob(['\uFEFF' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `${fileNameBase}.csv`);
}

export function exportToPdf(headers: string[], rows: (string | number)[][], meta: ExportMetadata) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: meta.isWideMatrix ? 'a3' : 'a4',
  });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  autoTable(doc, {
    head: [headers],
    body: rows,
    margin: { top: 28, bottom: 20, left: 10, right: 10 },
    styles: { fontSize: meta.isWideMatrix ? 7 : 8, cellPadding: 1.8 },
    headStyles: { fillColor: [15, 41, 66], textColor: 255, fontStyle: 'bold' },
    didDrawPage: (data) => {
      doc.setFillColor(15, 41, 66);
      doc.rect(10, 8, pageWidth - 20, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.text(SYSTEM_BRANDING.primaryHeader, 14, 14.5);

      doc.setTextColor(30, 41, 59);
      doc.setFontSize(8.5);
      doc.text(
        `${meta.reportTitle} | Filters: ${meta.activeFilters} | By: ${meta.generatedBy} | ${new Date().toLocaleString('en-IN')}`,
        10,
        23
      );

      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(
        `${SYSTEM_BRANDING.developerAttribution} | Verified By: A K Bajpai, CLI, JBP`,
        10,
        pageHeight - 8
      );
      doc.text(`Page ${data.pageNumber} of ${pageCount}`, pageWidth - 32, pageHeight - 8);
    },
  });

  doc.save(`${meta.fileNameBase}.pdf`);
}

export function exportToJson(data: unknown[], meta: ExportMetadata) {
  const payload = {
    system: SYSTEM_BRANDING.primaryHeader,
    attribution: SYSTEM_BRANDING.developerAttribution,
    reportTitle: meta.reportTitle,
    generatedBy: meta.generatedBy,
    generatedAt: new Date().toISOString(),
    filters: meta.activeFilters,
    totalRows: data.length,
    data,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  triggerDownload(blob, `${meta.fileNameBase}.json`);
}

export function exportToHtmlSnapshot(headers: string[], rows: (string | number)[][], meta: ExportMetadata) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${meta.reportTitle} — WCR EMS</title>
<style>
  body { font-family: Arial, sans-serif; margin: 20px; color: #0f172a; }
  .hdr { background: #0f2942; color: #fff; padding: 14px 18px; border-radius: 6px; }
  .meta { font-size: 12px; color: #475569; margin: 10px 0 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #0f2942; color: #fff; padding: 8px; border: 1px solid #cbd5e1; }
  td { padding: 6px 8px; border: 1px solid #cbd5e1; }
  tr:nth-child(even) { background: #f8fafc; }
  .ftr { margin-top: 18px; font-size: 11px; color: #334155; border-top: 1px solid #cbd5e1; padding-top: 8px; }
</style>
</head>
<body>
  <div class="hdr">
    <strong>${SYSTEM_BRANDING.primaryHeader}</strong><br/>
    <small>${SYSTEM_BRANDING.hindiTitle}</small>
  </div>
  <div class="meta">
    <strong>Report:</strong> ${meta.reportTitle} | <strong>Filters:</strong> ${meta.activeFilters} |
    <strong>Generated By:</strong> ${meta.generatedBy} | <strong>Timestamp:</strong> ${new Date().toLocaleString('en-IN')}
  </div>
  <table>
    <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>
  <div class="ftr">${SYSTEM_BRANDING.developerAttribution} • ${SYSTEM_BRANDING.hindiFooter}</div>
</body>
</html>`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  triggerDownload(blob, `${meta.fileNameBase}.html`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}