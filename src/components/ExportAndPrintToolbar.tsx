'use client';

import React from 'react';
import { FileSpreadsheet, FileText, FileCode, Globe, Printer, Download } from 'lucide-react';
import {
  ExportMetadata,
  exportCadreMatrixToExcel,
  exportGenericTableToExcel,
  exportToCsv,
  exportToHtmlSnapshot,
  exportToJson,
  exportToPdf,
} from '@/lib/export-engine';
import { DepotCadreRow } from '@/types/wcr';

interface ExportAndPrintToolbarProps {
  meta: ExportMetadata;
  headers: string[];
  rows: (string | number)[][];
  rawData: Record<string, any>[];
  keys?: string[];
  cadreMatrixRows?: DepotCadreRow[];
}

export function ExportAndPrintToolbar({
  meta,
  headers,
  rows,
  rawData,
  keys,
  cadreMatrixRows,
}: ExportAndPrintToolbarProps) {
  const handleExcel = async () => {
    if (cadreMatrixRows) {
      await exportCadreMatrixToExcel(cadreMatrixRows, meta);
    } else {
      await exportGenericTableToExcel(
        headers,
        rawData,
        keys || (rawData[0] ? Object.keys(rawData[0]) : []),
        meta
      );
    }
  };

  return (
    <div className="no-print flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 mr-1">Export / Print:</span>
      <button type="button" onClick={handleExcel} className="inline-flex items-center gap-1.5 rounded bg-emerald-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-800">
        <FileSpreadsheet className="h-3.5 w-3.5" /> Excel (.xlsx)
      </button>
      <button type="button" onClick={() => exportToCsv(headers, rows, meta.fileNameBase)} className="inline-flex items-center gap-1.5 rounded bg-teal-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-teal-800">
        <Download className="h-3.5 w-3.5" /> CSV (.csv)
      </button>
      <button type="button" onClick={() => exportToPdf(headers, rows, meta)} className="inline-flex items-center gap-1.5 rounded bg-rose-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-rose-800">
        <FileText className="h-3.5 w-3.5" /> PDF ({meta.isWideMatrix ? 'A3' : 'A4'})
      </button>
      <button type="button" onClick={() => exportToJson(rawData, meta)} className="inline-flex items-center gap-1.5 rounded bg-slate-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800">
        <FileCode className="h-3.5 w-3.5" /> JSON (.json)
      </button>
      <button type="button" onClick={() => exportToHtmlSnapshot(headers, rows, meta)} className="inline-flex items-center gap-1.5 rounded bg-indigo-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-800">
        <Globe className="h-3.5 w-3.5" /> HTML (.html)
      </button>
      <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded bg-[#0F2942] px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900">
        <Printer className="h-3.5 w-3.5" /> Print / Preview
      </button>
    </div>
  );
}
