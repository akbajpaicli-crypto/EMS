'use client';

import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  UploadCloud,
  X,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Zap,
  Check,
  Trash2,
  Files,
} from 'lucide-react';
import { resolveLobbyFromCrewId, WCR_DEPOTS_SEED } from '@/lib/wcr-constants';
import { CadreCode, DesignationCode, DivisionCode } from '@/types/wcr';

interface UploadDataModalProps {
  open: boolean;
  actorEmail: string;
  onClose: () => void;
  onImportComplete: () => void;
}

type DetectedFeedType =
  | 'SANCTIONED_STRENGTH'
  | 'CMS_PARTICULARS'
  | 'CLI_MASTER'
  | 'LI_GRADING'
  | 'DRAFTED_CREW'
  | 'PME_DUE';

interface ParsedFileItem {
  id: string;
  file: File;
  fileName: string;
  detectedType: DetectedFeedType;
  validCount: number;
  records: Record<string, any>[];
}

function cleanHeaderKey(key: string): string {
  return String(key || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function normalizeRailwayDate(raw: unknown, fallback = ''): string {
  if (raw === null || raw === undefined || String(raw).trim() === '') return fallback;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  const num = Number(s);
  if (!Number.isNaN(num) && num > 10000 && num < 90000) {
    const utcDays = Math.floor(num - 25569);
    const dt = new Date(utcDays * 86400 * 1000);
    if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  }

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return fallback;
}

function computeRailwayRetirementDate(dobIso: string): string {
  const m = dobIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '2045-01-31';
  let year = Number(m[1]) + 60;
  let month = Number(m[2]);
  const day = Number(m[3]);
  if (day === 1) {
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

function normalizeDesignation(raw: string): DesignationCode {
  const v = String(raw || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (v.includes('CLI') || v.includes('INSPECTOR')) return 'CLI';
  if (v === 'LPM' || v.includes('MAIL')) return 'LPM';
  if (v === 'LPP' || v.includes('PASS')) return 'LPP';
  if (v === 'LPG' || v.includes('GOODS')) return 'LPG';
  if (v === 'SSHT' || v.includes('SRSHUNTER')) return 'SSHT';
  if (v === 'SHT' || v.includes('SHUNTER')) return 'SHT';
  if (v === 'LPS' || v.includes('SHUNTING')) return 'LPS';
  if (v === 'SALP' || v.includes('SRALP') || v.includes('SENIORASSISTANT')) return 'SALP';
  return 'ALP';
}

function normalizeCadre(raw: string, desig: DesignationCode): CadreCode {
  if (desig === 'CLI') return 'LOCO_INSP';
  const v = String(raw || '').toUpperCase();
  if (v.startsWith('M')) return 'M';
  if (v.startsWith('D')) return 'D';
  return 'E';
}

const FEED_BADGE_LABELS: Record<DetectedFeedType, string> = {
  SANCTIONED_STRENGTH: 'Sanctioned Strength (SS Matrix)',
  CMS_PARTICULARS: 'Service Particulars',
  CLI_MASTER: 'CLI/TI Biodata',
  LI_GRADING: 'LI Grading (CLI Map)',
  DRAFTED_CREW: 'Drafted Accountal',
  PME_DUE: 'PME Due Sheet',
};

const FEED_PRIORITY: DetectedFeedType[] = [
  'CMS_PARTICULARS',
  'CLI_MASTER',
  'LI_GRADING',
  'DRAFTED_CREW',
  'PME_DUE',
];

function consolidateCrewFiles(files: ParsedFileItem[]): Record<string, any>[] {
  const mergedMap = new Map<string, Record<string, any>>();
  for (const fType of FEED_PRIORITY) {
    const groupRecords = files
      .filter((pf) => pf.detectedType === fType)
      .flatMap((pf) => pf.records);

    for (const rec of groupRecords) {
      const key = String(rec.crew_id || rec.emp_no).trim().toUpperCase();
      if (!key) continue;

      const prev = mergedMap.get(key);
      if (prev) {
        const nonEmptyPatch = Object.fromEntries(
          Object.entries(rec).filter(([, v]) => v !== undefined && v !== null && v !== '')
        );
        mergedMap.set(key, {
          ...prev,
          ...nonEmptyPatch,
          emp_no: rec.emp_no || prev.emp_no,
          crew_id: rec.crew_id || prev.crew_id,
          employment_status:
            rec.employment_status === 'Drafted' || prev.employment_status === 'Drafted'
              ? 'Drafted'
              : rec.employment_status || prev.employment_status || 'Active',
        });
      } else {
        mergedMap.set(key, rec);
      }
    }
  }
  return Array.from(mergedMap.values());
}

/**
 * Parses WCR Depot-wise Cadre Position matrix (latest month tab e.g. oct-26) into 120 lobby-post SS records
 */
function parseWcrCadreMatrixWorkbook(workbook: XLSX.WorkBook): Record<string, any>[] {
  const validSheetNames = workbook.SheetNames.filter(
    (n) => !n.toLowerCase().includes('changelog')
  );
  const targetSheetName = validSheetNames[validSheetNames.length - 1] || workbook.SheetNames[0];
  const sheet = workbook.Sheets[targetSheetName];
  const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: true, defval: '' });

  const validLobbyCodes = new Set(WCR_DEPOTS_SEED.map((d) => d.depot_code));
  const ssEntries: Record<string, any>[] = [];

  for (let r = 0; r < matrix.length; r++) {
    const row = matrix[r] || [];
    const code = String(row[0] || '').trim().toUpperCase();
    if (!validLobbyCodes.has(code)) continue;
    // Skip zonal summary rows at bottom (rows 44-46)
    if (r > 38) continue;

    const depot = WCR_DEPOTS_SEED.find((d) => d.depot_code === code);
    if (!depot) continue;

    const postCols: { desig: 'LPM' | 'LPP' | 'LPG' | 'LPS' | 'ALP' | 'CLI'; col: number }[] = [
      { desig: 'LPM', col: 1 },
      { desig: 'LPP', col: 5 },
      { desig: 'LPG', col: 9 },
      { desig: 'LPS', col: 13 },
      { desig: 'ALP', col: 17 },
      { desig: 'CLI', col: 25 },
    ];

    for (const pc of postCols) {
      const val = Number(row[pc.col] ?? 0);
      ssEntries.push({
        division_code: depot.division_code,
        depot_id: depot.depot_id,
        depot_code: depot.depot_code,
        designation_code: pc.desig,
        new_ss: Number.isNaN(val) ? 0 : Math.max(0, Math.round(val)),
        sheet_tab: targetSheetName,
      });
    }
  }

  return ssEntries;
}

export function UploadDataModal({
  open,
  actorEmail,
  onClose,
  onImportComplete,
}: UploadDataModalProps) {
  const [feedMode, setFeedMode] = useState<'AUTO' | DetectedFeedType>('AUTO');
  const [defaultDivision, setDefaultDivision] = useState<DivisionCode>('JBP');
  const [orderNo, setOrderNo] = useState('WCR/P-HQ/CADRE/OCT-2026');
  const [effectiveDate, setEffectiveDate] = useState('2026-10-01');
  const [autoDeleteRaw, setAutoDeleteRaw] = useState(true);
  const [parsedFiles, setParsedFiles] = useState<ParsedFileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [syncResult, setSyncResult] = useState<{ summary: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // All Hooks strictly before conditional return
  const consolidatedCrew = useMemo(() => consolidateCrewFiles(parsedFiles), [parsedFiles]);
  const consolidatedSs = useMemo(
    () =>
      parsedFiles
        .filter((pf) => pf.detectedType === 'SANCTIONED_STRENGTH')
        .flatMap((pf) => pf.records),
    [parsedFiles]
  );

  if (!open) return null;

  const resetState = () => {
    setParsedFiles([]);
    setProgressText('');
    setSyncResult(null);
    setErrorMsg(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const parseSingleWorkbook = async (file: File): Promise<ParsedFileItem> => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const matrix = XLSX.utils.sheet_to_json<any[]>(firstSheet, {
      header: 1,
      raw: false,
      defval: '',
    });

    const topBanner = matrix.slice(0, 5).flat().join(' ').toUpperCase();
    const fileUpper = file.name.toUpperCase();

    if (
      feedMode === 'SANCTIONED_STRENGTH' ||
      (feedMode === 'AUTO' &&
        (topBanner.includes('WCR CADRE POSITION') ||
          topBanner.includes('RUNNING STAFF CADRE') ||
          fileUpper.includes('CADRE')))
    ) {
      const ssRecords = parseWcrCadreMatrixWorkbook(workbook);
      return {
        id: `${file.name}_${file.size}_${Date.now()}_${Math.random()}`,
        file,
        fileName: file.name,
        detectedType: 'SANCTIONED_STRENGTH',
        validCount: ssRecords.length,
        records: ssRecords,
      };
    }

    const headerKeywords = [
      'EMPNO', 'EMPID', 'PFNO', 'EMPLOYEENO', 'STAFFNO', 'HRMSID',
      'CREWID', 'CMSID', 'LIID', 'CLIID', 'CLINAME', 'CREWNAME',
      'EMPLOYEENAME', 'NAME', 'DESIG', 'DESIGNATION', 'CREWDESG', 'CREWDESIGNATION',
    ];

    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(matrix.length, 15); i++) {
      const cleanedCells = (matrix[i] || []).map(cleanHeaderKey);
      const matches = cleanedCells.filter((c) => headerKeywords.includes(c)).length;
      if (matches >= 2) {
        headerRowIndex = i;
        break;
      }
    }

    const rawHeaders = (matrix[headerRowIndex] || []).map((h) => String(h || '').trim());
    const cleanHeaders = rawHeaders.map(cleanHeaderKey);
    const headerSet = new Set(cleanHeaders);

    let detectedType: DetectedFeedType = 'CMS_PARTICULARS';
    if (feedMode !== 'AUTO') {
      detectedType = feedMode;
    } else if (headerSet.has('CLIID') && headerSet.has('CLINAME')) {
      detectedType = 'LI_GRADING';
    } else if (headerSet.has('LIID') && headerSet.has('HQ')) {
      detectedType = 'CLI_MASTER';
    } else if (
      headerSet.has('FORTNIGHTHRS') ||
      headerSet.has('AVAILSTTN') ||
      fileUpper.includes('DRAFTED') ||
      fileUpper.includes('DRAFT')
    ) {
      detectedType = 'DRAFTED_CREW';
    } else if (fileUpper.includes('PME') && !headerSet.has('BIRTHDATE') && !headerSet.has('DOB')) {
      detectedType = 'PME_DUE';
    }

    let fileDiv: DivisionCode = defaultDivision;
    if (topBanner.includes('KOTA') || fileUpper.includes('KOTA')) fileDiv = 'KOTA';
    else if (topBanner.includes('BHOPAL') || topBanner.includes('BPL') || fileUpper.includes('BPL')) fileDiv = 'BPL';
    else if (topBanner.includes('JABALPUR') || topBanner.includes('JBP') || fileUpper.includes('JBP')) fileDiv = 'JBP';

    const dataRows = matrix.slice(headerRowIndex + 1);
    const parsed: Record<string, any>[] = [];

    const pick = (rowObj: Record<string, string>, aliases: string[]): string => {
      for (const a of aliases) {
        if (rowObj[a] !== undefined && String(rowObj[a]).trim() !== '') {
          return String(rowObj[a]).trim();
        }
      }
      return '';
    };

    for (const cells of dataRows) {
      if (!cells || cells.every((c) => String(c || '').trim() === '')) continue;

      const rowMap: Record<string, string> = {};
      cleanHeaders.forEach((hk, idx) => {
        if (hk) rowMap[hk] = String(cells[idx] ?? '').trim();
      });

      if (detectedType === 'LI_GRADING') {
        const crewId = pick(rowMap, ['CREWID', 'CMSID']).toUpperCase();
        const cliId = pick(rowMap, ['CLIID', 'LIID']).toUpperCase();
        const cliName = pick(rowMap, ['CLINAME', 'LINAME']);
        if (!crewId || !cliId) continue;
        const loc = resolveLobbyFromCrewId(crewId, '', fileDiv);
        const crewName = pick(rowMap, ['NAME', 'CREWNAME']);
        const rawDesig = pick(rowMap, ['DESIG', 'DESIGNATION']);

        parsed.push({
          crew_id: crewId,
          ...(crewName ? { employee_name: crewName } : {}),
          ...(rawDesig ? { designation_code: normalizeDesignation(rawDesig) } : {}),
          division_code: loc.division_code,
          depot_id: loc.depot_id,
          current_station: loc.depot_code,
          nominated_cli_id: cliId,
          nominated_cli_name: cliName,
          cli_allotted_date: normalizeRailwayDate(pick(rowMap, ['CLIALLOTEDDATE', 'ALLOTEDDATE']), ''),
          current_grade: pick(rowMap, ['CURRENTGRADE', 'GRADE']),
        });
        continue;
      }

      if (detectedType === 'DRAFTED_CREW') {
        const crewId = pick(rowMap, ['CREWID', 'CMSID']).toUpperCase();
        const crewName = pick(rowMap, ['CREWNAME', 'NAME', 'EMPLOYEENAME']);
        if (!crewId) continue;
        const loc = resolveLobbyFromCrewId(crewId, '', fileDiv);
        const rawDesig = pick(rowMap, ['CREWDESIGNATION', 'DESIGNATION', 'DESIG']);
        const availSttn = pick(rowMap, ['AVAILSTTN', 'STATION']);

        parsed.push({
          crew_id: crewId,
          ...(crewName ? { employee_name: crewName } : {}),
          ...(rawDesig ? { designation_code: normalizeDesignation(rawDesig) } : {}),
          division_code: loc.division_code,
          depot_id: loc.depot_id,
          current_station: availSttn || loc.depot_code,
          employment_status: 'Drafted',
        });
        continue;
      }

      if (detectedType === 'CLI_MASTER') {
        const liId = pick(rowMap, ['LIID', 'CLIID', 'CREWID']).toUpperCase();
        const empNo = pick(rowMap, ['EMPNO', 'EMPID', 'PFNO']) || liId;
        const name = pick(rowMap, ['NAME', 'CLINAME', 'EMPLOYEENAME']);
        if (!empNo || !name) continue;
        const hq = pick(rowMap, ['HQ', 'LOBBY', 'DEPOT', 'STATION']);
        const loc = resolveLobbyFromCrewId(liId, hq, fileDiv);
        const dob = normalizeRailwayDate(pick(rowMap, ['DOB', 'BIRTHDATE']), '1975-01-01');
        const doa = normalizeRailwayDate(pick(rowMap, ['DOA', 'APPOINTDATE']), '2000-01-01');
        const dop = normalizeRailwayDate(pick(rowMap, ['DOP', 'PROMOTIONDATE']), '');
        const dor = normalizeRailwayDate(pick(rowMap, ['DOR', 'RETIREMENTDATE']), computeRailwayRetirementDate(dob));

        parsed.push({
          emp_no: empNo,
          crew_id: liId || empNo,
          employee_name: name,
          division_code: loc.division_code,
          depot_id: loc.depot_id,
          current_station: loc.depot_code,
          designation_code: 'CLI',
          cadre_code: 'LOCO_INSP',
          pay_level: 'Level-7',
          dob,
          date_of_appointment: doa,
          ...(dop ? { date_of_promotion: dop } : {}),
          retirement_date: dor,
          pme_due_date: normalizeRailwayDate(
            pick(rowMap, ['PMEDUE', 'PMEDUEDATE']),
            new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10)
          ),
          employment_status: 'Active',
          mobile_no: pick(rowMap, ['MOBILENO', 'MOBILE']),
        });
        continue;
      }

      const empNo = pick(rowMap, [
        'EMPNO', 'EMPID', 'PFNO', 'PFNUMBER', 'EMPLOYEENO', 'EMPLOYEEID', 'STAFFNO', 'HRMSID',
      ]);
      const crewId = pick(rowMap, ['CREWID', 'CMSID', 'CMSNO']).toUpperCase();
      const empName = pick(rowMap, ['CREWNAME', 'EMPLOYEENAME', 'EMPNAME', 'NAME']);

      const finalEmpNo = empNo || crewId;
      if (!finalEmpNo || (!empName && detectedType !== 'PME_DUE')) continue;

      const loc = resolveLobbyFromCrewId(crewId || finalEmpNo, '', fileDiv);
      const rawDesig = pick(rowMap, ['CREWDESG', 'DESIGNATIONCODE', 'DESIGNATION', 'DESIG', 'POST']);
      const designation_code = normalizeDesignation(rawDesig);
      const cadre_code = normalizeCadre(pick(rowMap, ['CADRE', 'CADRECODE']), designation_code);

      const dob = normalizeRailwayDate(pick(rowMap, ['BIRTHDATE', 'DOB', 'DATEOFBIRTH']), '1985-01-01');
      const doa = normalizeRailwayDate(pick(rowMap, ['APPOINTDATE', 'DATEOFAPPOINTMENT', 'DOA']), '2010-01-01');
      const dop = normalizeRailwayDate(pick(rowMap, ['PROMOTIONDATE', 'DATEOFPROMOTION', 'DOP']), '');
      const dorRaw = normalizeRailwayDate(pick(rowMap, ['RETIREMENTDATE', 'DOR', 'DATEOFRETIREMENT']), '');
      const pmeDue = normalizeRailwayDate(
        pick(rowMap, ['PMEDUEDATE', 'PMEDUE', 'NEXTPME', 'MEDICALDUE']),
        new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)
      );
      const rawLevel = pick(rowMap, ['LEVEL', 'PAYLEVEL']);
      const pay_level = rawLevel ? (rawLevel.startsWith('Level') ? rawLevel : `Level-${rawLevel}`) : 'Level-6';

      parsed.push({
        emp_no: finalEmpNo,
        crew_id: crewId || finalEmpNo,
        employee_name: empName || `Crew ${finalEmpNo}`,
        division_code: loc.division_code,
        depot_id: loc.depot_id,
        current_station: loc.depot_code,
        designation_code,
        cadre_code,
        pay_level,
        dob,
        date_of_appointment: doa,
        ...(dop ? { date_of_promotion: dop } : {}),
        retirement_date: dorRaw || computeRailwayRetirementDate(dob),
        pme_due_date: pmeDue,
        employment_status: 'Active',
        mobile_no: pick(rowMap, ['MOBILENO', 'MOBILE']),
      });
    }

    return {
      id: `${file.name}_${file.size}_${Date.now()}_${Math.random()}`,
      file,
      fileName: file.name,
      detectedType,
      validCount: parsed.length,
      records: parsed,
    };
  };

  const handleMultiFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setSyncResult(null);
    setErrorMsg(null);

    try {
      const items = await Promise.all(Array.from(fileList).map((f) => parseSingleWorkbook(f)));
      setParsedFiles((prev) => [...prev, ...items]);

      const totalFound = items.reduce((s, it) => s + it.validCount, 0);
      if (totalFound === 0) {
        setErrorMsg('No valid rows matched in selected files. Please check sheet headers.');
      }
    } catch (err: any) {
      setErrorMsg(`Excel Parse Error: ${err.message}`);
    } finally {
      e.target.value = '';
    }
  };

  const removeFile = (id: string) => {
    setParsedFiles((prev) => prev.filter((f) => f.id !== id));
    setSyncResult(null);
  };

  const handleExtractAndSync = async () => {
    if (consolidatedSs.length === 0 && consolidatedCrew.length === 0) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const parts: string[] = [];

      if (consolidatedSs.length > 0) {
        setProgressText(`Updating Sanctioned Strength (${consolidatedSs.length} lobby-post entries)...`);
        const ssRes = await fetch('/api/sanctioned-strength/bulk-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actorEmail,
            order_no: orderNo,
            order_date: new Date().toISOString().slice(0, 10),
            effective_date: effectiveDate,
            entries: consolidatedSs,
          }),
        });
        const ssData = await ssRes.json();
        if (!ssRes.ok) throw new Error(ssData.error || 'Failed updating Sanctioned Strength');
        parts.push(`Sanctioned Strength updated for ${ssData.updatedCount} lobby-post cells across 20 WCR lobbies`);
      }

      if (consolidatedCrew.length > 0) {
        setProgressText(`Syncing ${consolidatedCrew.length} crew records...`);
        const empRes = await fetch('/api/employees/bulk-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actorEmail,
            fileType: 'MERGED_MULTI_FEED',
            records: consolidatedCrew,
            autoDeleteRaw: true,
            rawStoragePaths: [],
          }),
        });
        const empData = await empRes.json();
        if (!empRes.ok) throw new Error(empData.error || 'Failed syncing crew records');
        parts.push(`${empData.inserted || 0} crew inserted, ${empData.updated || 0} updated`);
      }

      setProgressText('');
      setSyncResult({ summary: parts.join(' • ') });
      onImportComplete();
    } catch (err: any) {
      setErrorMsg(err.message || 'Sync failed');
    } finally {
      setLoading(false);
    }
  };

  const totalActionCount = consolidatedSs.length + consolidatedCrew.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between border-b bg-[#0F2942] px-5 py-3.5 text-white">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <UploadCloud className="h-5 w-5 text-amber-400" />
            <span>Multi-File Upload & Extraction (Sanctioned Strength • Service Particulars • CLI • Grading • Drafted)</span>
          </div>
          <button onClick={handleClose} className="text-slate-300 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                Sheet Detection Mode
              </label>
              <select
                value={feedMode}
                onChange={(e) => setFeedMode(e.target.value as any)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium"
              >
                <option value="AUTO">Auto-Detect Each File (SS Matrix / CMS / CLI / Grading / Drafted)</option>
                <option value="SANCTIONED_STRENGTH">WCR Depot-wise Cadre / SS Sheet</option>
                <option value="CMS_PARTICULARS">CMS Service Particulars (Lobby via CREW ID Prefix)</option>
                <option value="CLI_MASTER">CLI/TI Biodata (Lobby via HQ Column)</option>
                <option value="LI_GRADING">LI Grading Sheet (Assign Nominated CLI by CREW ID)</option>
                <option value="DRAFTED_CREW">Drafted Crew Accountal (Lobby via CREW ID Prefix)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                Fallback Division (for Crew Sheets)
              </label>
              <select
                value={defaultDivision}
                onChange={(e) => setDefaultDivision(e.target.value as DivisionCode)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium"
              >
                <option value="JBP">JBP — Jabalpur Division</option>
                <option value="BPL">BPL — Bhopal Division</option>
                <option value="KOTA">KOTA — Kota Division</option>
              </select>
            </div>
          </div>

          {consolidatedSs.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-lg bg-indigo-50 border border-indigo-200 p-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-indigo-900 mb-1">
                  Sanctioned Strength Order No.
                </label>
                <input
                  type="text"
                  value={orderNo}
                  onChange={(e) => setOrderNo(e.target.value)}
                  className="w-full rounded border border-indigo-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-indigo-900 mb-1">
                  Effective Date
                </label>
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className="w-full rounded border border-indigo-300 bg-white px-2.5 py-1.5 text-xs"
                />
              </div>
            </div>
          )}

          <div className="rounded-lg border-2 border-dashed border-slate-300 p-4 text-center hover:border-[#0F2942] bg-slate-50/60">
            <input
              type="file"
              multiple
              accept=".xlsx,.xls,.csv"
              disabled={loading}
              onChange={handleMultiFileSelect}
              className="block w-full text-xs text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-[#0F2942] file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-slate-800"
            />
            <p className="mt-1.5 text-[11px] text-slate-500">
              Upload <strong>WCR depot vise cadre _2.xlsx</strong> to update Sanctioned Strength (SS), or select multiple crew files together.
            </p>
          </div>

          {parsedFiles.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#0F2942]">
                <span className="flex items-center gap-1.5">
                  <Files className="h-4 w-4 text-amber-600" />
                  Selected Files ({parsedFiles.length})
                </span>
                <button
                  type="button"
                  onClick={resetState}
                  className="text-[11px] font-semibold text-rose-600 hover:underline"
                >
                  Clear All
                </button>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-md max-h-36 overflow-y-auto">
                {parsedFiles.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-3 py-1.5 text-xs bg-slate-50/50">
                    <div className="flex items-center gap-2 truncate">
                      <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="font-medium truncate">{item.fileName}</span>
                      <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-800">
                        {FEED_BADGE_LABELS[item.detectedType]}
                      </span>
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                        {item.validCount} entries
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(item.id)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {consolidatedSs.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
              <div className="text-xs font-bold text-[#0F2942]">
                Sanctioned Strength Extraction Preview (Sheet: {consolidatedSs[0]?.sheet_tab} • 20 Lobbies × 6 Posts = {consolidatedSs.length} SS Cells)
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded bg-white">
                <table className="min-w-full text-[11px] border-collapse">
                  <thead className="bg-slate-800 text-white">
                    <tr>
                      <th className="px-2 py-1">DIV</th>
                      <th className="px-2 py-1">LOBBY</th>
                      <th className="px-2 py-1">POST</th>
                      <th className="px-2 py-1 text-right">SANCTIONED STRENGTH (SS)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consolidatedSs.slice(0, 8).map((s, i) => (
                      <tr key={i} className="border-t border-slate-200">
                        <td className="px-2 py-1 text-center font-semibold">{s.division_code}</td>
                        <td className="px-2 py-1 text-center font-mono font-bold text-indigo-700">{s.depot_code}</td>
                        <td className="px-2 py-1 text-center font-bold">{s.designation_code}</td>
                        <td className="px-2 py-1 text-right font-bold">{s.new_ss}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {consolidatedCrew.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
              <div className="text-xs font-bold text-[#0F2942]">
                Crew Extraction Preview (First 6 of {consolidatedCrew.length} records)
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded bg-white">
                <table className="min-w-full text-[11px] border-collapse">
                  <thead className="bg-slate-800 text-white">
                    <tr>
                      <th className="px-2 py-1 text-left">CREW ID</th>
                      <th className="px-2 py-1 text-left">NAME</th>
                      <th className="px-2 py-1">DIV</th>
                      <th className="px-2 py-1">LOBBY</th>
                      <th className="px-2 py-1">POST</th>
                      <th className="px-2 py-1">STATUS</th>
                      <th className="px-2 py-1 text-left">NOMINATED CLI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consolidatedCrew.slice(0, 6).map((r, i) => (
                      <tr key={i} className="border-t border-slate-200">
                        <td className="px-2 py-1 font-mono font-semibold">{r.crew_id}</td>
                        <td className="px-2 py-1">{r.employee_name || '—'}</td>
                        <td className="px-2 py-1 text-center">{r.division_code}</td>
                        <td className="px-2 py-1 text-center font-bold text-indigo-700">{r.current_station}</td>
                        <td className="px-2 py-1 text-center font-bold">{r.designation_code || '—'}</td>
                        <td className="px-2 py-1 text-center">{r.employment_status || 'Active'}</td>
                        <td className="px-2 py-1">
                          {r.nominated_cli_id ? `${r.nominated_cli_id} (${r.nominated_cli_name})` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <label className="flex items-start gap-2.5 rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={autoDeleteRaw}
              onChange={(e) => setAutoDeleteRaw(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0F2942]"
            />
            <span>
              <strong>Auto-delete raw file from cloud storage after extraction to save space</strong>
              <span className="block text-[11px] text-slate-500">
                Enabled by default: preserves historical SS records and saves directly without consuming Storage quota.
              </span>
            </span>
          </label>

          {loading && progressText && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs font-semibold text-blue-900">
              ⏳ {progressText}
            </div>
          )}

          {errorMsg && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-900 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div>{errorMsg}</div>
            </div>
          )}

          {syncResult && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-300 p-3 text-xs text-emerald-950 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>Sync Completed!</strong> {syncResult.summary}. Click <strong>OK / Finish</strong> to view updated SS, MOR, Vacancy & % across all 20 lobbies.
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t bg-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>

          {!syncResult ? (
            <button
              type="button"
              disabled={loading || totalActionCount === 0}
              onClick={handleExtractAndSync}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F2942] px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-40"
            >
              <Zap className="h-4 w-4 text-amber-400" />
              {loading ? 'Updating...' : `Extract & Save (${totalActionCount} Entries)`}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-800 shadow"
            >
              <Check className="h-4 w-4" />
              OK / Finish
            </button>
          )}
        </div>
      </div>
    </div>
  );
}