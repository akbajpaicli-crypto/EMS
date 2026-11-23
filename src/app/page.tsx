'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Train,
  RefreshCw,
  Upload,
  AlertCircle,
  Search,
  FileBarChart2,
  Users,
  ShieldCheck,
  Clock,
  Flame,
  MapPin,
  Lock,
  Unlock,
  Download,
  X,
} from 'lucide-react';
import {
  ADMINISTRATIVE_REPORTS,
  POST_GROUPS,
  SYSTEM_BRANDING,
  WCR_DEPOTS_SEED,
} from '@/lib/wcr-constants';
import {
  computeDepotCadreMatrix,
  evaluatePmeAlerts,
  evaluateRetirementWindows,
  universalEmployeeSearch,
} from '@/lib/cadre-engine';
import { DepotMaster, DivisionCode, EmployeeMaster, PostGroup, SanctionedStrength } from '@/types/wcr';
import { ExportAndPrintToolbar } from '@/components/ExportAndPrintToolbar';
import { UploadDataModal } from '@/components/UploadDataModal';
import { DrillDownTarget, EntityDetailModals } from '@/components/EntityDetailModals';

type CadreViewMode = 'HQ_DIV_SUMMARY' | 'HQ_LOBBY_WISE' | 'DIVISION_LOBBY';

const DIVISION_ORDER: DivisionCode[] = ['KOTA', 'BPL', 'JBP'];

const DIVISION_FULL_NAMES: Record<DivisionCode, string> = {
  KOTA: 'KOTA DIVISION',
  BPL: 'BHOPAL (BPL) DIVISION',
  JBP: 'JABALPUR (JBP) DIVISION',
};

const DIVISION_PRINT_TITLES: Record<'ALL' | DivisionCode, { en: string; hi: string }> = {
  ALL: {
    en: 'WEST CENTRAL RAILWAY',
    hi: 'पश्चिम मध्य रेल (मुख्यालय — जबलपुर)',
  },
  JBP: {
    en: 'WEST CENTRAL RAILWAY — JABALPUR DIVISION',
    hi: 'पश्चिम मध्य रेल — जबलपुर मण्डल',
  },
  BPL: {
    en: 'WEST CENTRAL RAILWAY — BHOPAL DIVISION',
    hi: 'पश्चिम मध्य रेल — भोपाल मण्डल',
  },
  KOTA: {
    en: 'WEST CENTRAL RAILWAY — KOTA DIVISION',
    hi: 'पश्चिम मध्य रेल — कोटा मण्डल',
  },
};

export default function WcrEmsFirebasePage() {
  const [actorEmail] = useState('cli-jbp@wcr.railnet.gov.in');
  const [depots, setDepots] = useState<DepotMaster[]>(WCR_DEPOTS_SEED);
  const [employees, setEmployees] = useState<EmployeeMaster[]>([]);
  const [ssRecords, setSsRecords] = useState<SanctionedStrength[]>([]);
  const [loading, setLoading] = useState(true);
  const [rebalancing, setRebalancing] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Admin Console state (Upload Data & Assign Lobbies are hidden until unlocked)
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [adminPinError, setAdminPinError] = useState<string | null>(null);
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [cloudEnvReady, setCloudEnvReady] = useState<boolean | null>(null);

  const [cadreViewMode, setCadreViewMode] = useState<CadreViewMode>('HQ_LOBBY_WISE');
  const [selectedDivision, setSelectedDivision] = useState<'ALL' | DivisionCode>('ALL');

  const [searchQuery, setSearchQuery] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'CADRE' | 'EMPLOYEES' | 'REPORTS'>('CADRE');
  const [drillStack, setDrillStack] = useState<DrillDownTarget[]>([]);

  const openDrill = (target: DrillDownTarget) => setDrillStack([target]);
  const pushDrill = (target: DrillDownTarget) => setDrillStack((prev) => [...prev, target]);
  const popDrill = () => setDrillStack((prev) => prev.slice(0, -1));
  const closeAllDrills = () => setDrillStack([]);

  const selectHqDivSummary = () => {
    setSelectedDivision('ALL');
    setCadreViewMode('HQ_DIV_SUMMARY');
  };

  const selectHqLobbyWise = () => {
    setSelectedDivision('ALL');
    setCadreViewMode('HQ_LOBBY_WISE');
  };

  const selectSingleDivision = (div: DivisionCode) => {
    setSelectedDivision(div);
    setCadreViewMode('DIVISION_LOBBY');
  };

  const fetchFirebaseDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard?email=${encodeURIComponent(actorEmail)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.depots?.length) setDepots(data.depots);
        if (data.employees) setEmployees(data.employees);
        if (data.ssRecords) setSsRecords(data.ssRecords);
        if (data.envStatus) {
          setCloudEnvReady(Boolean(data.envStatus.hasClientEmail && data.envStatus.hasPrivateKey));
        }
      }
    } finally {
      setLoading(false);
    }
  }, [actorEmail]);

  useEffect(() => {
    fetchFirebaseDashboard();
  }, [fetchFirebaseDashboard]);

  const handleUnlockAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyingPin(true);
    setAdminPinError(null);
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: adminPinInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAdminPinError(data.error || 'Invalid PIN');
        return;
      }
      setIsAdminUnlocked(true);
      setAdminModalOpen(false);
      setAdminPinInput('');
      if (data.envStatus) {
        setCloudEnvReady(Boolean(data.envStatus.hasClientEmail && data.envStatus.hasPrivateKey));
      }
    } catch (err: any) {
      setAdminPinError(err.message || 'Verification failed');
    } finally {
      setVerifyingPin(false);
    }
  };

  const handleDownloadVercelSnapshot = () => {
    const payload = {
      updated_at: new Date().toISOString(),
      employees,
      ssRecords,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wcr-snapshot.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRebalanceLobbies = async () => {
    setRebalancing(true);
    setStatusBanner(null);
    try {
      const res = await fetch('/api/employees/rebalance-lobbies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to assign lobbies');
      setStatusBanner(
        `Lobby Assignment Complete: ${data.updatedCount} crew records re-mapped to their exact lobbies via CREW ID prefix.`
      );
      await fetchFirebaseDashboard();
    } catch (err: any) {
      setStatusBanner(`Error: ${err.message}`);
    } finally {
      setRebalancing(false);
    }
  };

  const filteredDepots = useMemo(
    () => (selectedDivision === 'ALL' ? depots : depots.filter((d) => d.division_code === selectedDivision)),
    [depots, selectedDivision]
  );

  const cadreSummary = useMemo(
    () => computeDepotCadreMatrix(filteredDepots, employees, ssRecords),
    [filteredDepots, employees, ssRecords]
  );

  const divisionCadreMap = useMemo(() => {
    const map = {} as Record<DivisionCode, ReturnType<typeof computeDepotCadreMatrix>>;
    for (const div of DIVISION_ORDER) {
      const divDepots = depots.filter((d) => d.division_code === div);
      map[div] = computeDepotCadreMatrix(divDepots, employees, ssRecords);
    }
    return map;
  }, [depots, employees, ssRecords]);

  const divisionScopedEmployees = useMemo(
    () =>
      selectedDivision === 'ALL'
        ? employees
        : employees.filter((e) => e.division_code === selectedDivision),
    [employees, selectedDivision]
  );

  const pmeAlerts = useMemo(() => evaluatePmeAlerts(divisionScopedEmployees), [divisionScopedEmployees]);
  const retirementAlerts = useMemo(
    () => evaluateRetirementWindows(divisionScopedEmployees),
    [divisionScopedEmployees]
  );

  const searchedEmployees = useMemo(
    () => universalEmployeeSearch(divisionScopedEmployees, searchQuery),
    [divisionScopedEmployees, searchQuery]
  );

  const { matrixHeaders, matrixRows } = useMemo(() => {
    const firstColLabel = cadreViewMode === 'HQ_DIV_SUMMARY' ? 'DIVISION' : 'DIV';
    const secondColLabel = cadreViewMode === 'HQ_DIV_SUMMARY' ? 'LOBBIES' : 'CODE';
    const headers = [
      firstColLabel,
      secondColLabel,
      ...POST_GROUPS.flatMap((p) => [`${p} SS`, `${p} MOR`, `${p} VAC`, `${p} %`]),
    ];

    const rows: (string | number)[][] = [];

    if (cadreViewMode === 'HQ_DIV_SUMMARY') {
      for (const div of DIVISION_ORDER) {
        const divData = divisionCadreMap[div];
        rows.push([
          div,
          `${divData.depotRows.length} Lobbies`,
          ...POST_GROUPS.flatMap((p) => [
            divData.wcrZoneTotal.posts[p].ss,
            divData.wcrZoneTotal.posts[p].mor,
            divData.wcrZoneTotal.posts[p].vac,
            divData.wcrZoneTotal.posts[p].vacPercent,
          ]),
        ]);
      }
      rows.push([
        'WCR ZONE',
        'ALL 20',
        ...POST_GROUPS.flatMap((p) => [
          cadreSummary.wcrZoneTotal.posts[p].ss,
          cadreSummary.wcrZoneTotal.posts[p].mor,
          cadreSummary.wcrZoneTotal.posts[p].vac,
          cadreSummary.wcrZoneTotal.posts[p].vacPercent,
        ]),
      ]);
    } else if (cadreViewMode === 'HQ_LOBBY_WISE') {
      for (const div of DIVISION_ORDER) {
        const divData = divisionCadreMap[div];
        for (const r of divData.depotRows) {
          rows.push([
            r.division_code,
            r.depot_code,
            ...POST_GROUPS.flatMap((p) => [r.posts[p].ss, r.posts[p].mor, r.posts[p].vac, r.posts[p].vacPercent]),
          ]);
        }
        rows.push([
          `${div} DIV`,
          'TOTAL',
          ...POST_GROUPS.flatMap((p) => [
            divData.wcrZoneTotal.posts[p].ss,
            divData.wcrZoneTotal.posts[p].mor,
            divData.wcrZoneTotal.posts[p].vac,
            divData.wcrZoneTotal.posts[p].vacPercent,
          ]),
        ]);
      }
      rows.push([
        'WCR ZONE',
        'GRAND TOTAL',
        ...POST_GROUPS.flatMap((p) => [
          cadreSummary.wcrZoneTotal.posts[p].ss,
          cadreSummary.wcrZoneTotal.posts[p].mor,
          cadreSummary.wcrZoneTotal.posts[p].vac,
          cadreSummary.wcrZoneTotal.posts[p].vacPercent,
        ]),
      ]);
    } else {
      for (const r of cadreSummary.depotRows) {
        rows.push([
          r.division_code,
          r.depot_code,
          ...POST_GROUPS.flatMap((p) => [r.posts[p].ss, r.posts[p].mor, r.posts[p].vac, r.posts[p].vacPercent]),
        ]);
      }
      rows.push([
        `${selectedDivision} DIV`,
        'TOTAL',
        ...POST_GROUPS.flatMap((p) => [
          cadreSummary.wcrZoneTotal.posts[p].ss,
          cadreSummary.wcrZoneTotal.posts[p].mor,
          cadreSummary.wcrZoneTotal.posts[p].vac,
          cadreSummary.wcrZoneTotal.posts[p].vacPercent,
        ]),
      ]);
    }

    return { matrixHeaders: headers, matrixRows: rows };
  }, [cadreViewMode, divisionCadreMap, cadreSummary, selectedDivision]);

  const printHeaderInfo = DIVISION_PRINT_TITLES[selectedDivision];
  const activeReportHeading =
    activeTab === 'CADRE'
      ? cadreViewMode === 'HQ_DIV_SUMMARY'
        ? 'HQ Consolidated Cadre Position — Division-wise Summary (Post-wise)'
        : cadreViewMode === 'HQ_LOBBY_WISE'
        ? 'WCR Lobby-wise Cadre Position with Division Totals (All 20 Lobbies)'
        : `${DIVISION_FULL_NAMES[selectedDivision as DivisionCode]} — Lobby-wise Cadre Position Statement`
      : activeTab === 'EMPLOYEES'
      ? `Employee Master, Nominated CLI & PME Report (${selectedDivision === 'ALL' ? 'All WCR' : `${selectedDivision} Division`})`
      : 'WCR Administrative Reports Directory';

  const renderMetricCells = (
    postsRecord: Record<PostGroup, { ss: number; mor: number; vac: number; vacPercent: string }>,
    depotId: string | 'ALL',
    divisionScope: 'ALL' | DivisionCode,
    isBoldRow = false
  ) =>
    POST_GROUPS.map((grp: PostGroup) => {
      const m = postsRecord[grp];
      const cellBorder = isBoldRow ? 'border-slate-400 py-2' : 'border-slate-300 py-1.5';
      return (
        <React.Fragment key={grp}>
          <td className={`border ${cellBorder} px-1.5 text-right`}>
            <button
              type="button"
              onClick={() =>
                openDrill({
                  type: 'CADRE_CELL',
                  metric: 'SS',
                  depotId,
                  divisionScope,
                  postGroup: grp,
                })
              }
              className="hover:text-blue-800 hover:underline decoration-dotted cursor-pointer"
            >
              {m.ss}
            </button>
          </td>
          <td className={`border ${cellBorder} px-1.5 text-right font-semibold`}>
            <button
              type="button"
              onClick={() =>
                openDrill({
                  type: 'CADRE_CELL',
                  metric: 'MOR',
                  depotId,
                  divisionScope,
                  postGroup: grp,
                })
              }
              className="text-blue-700 underline decoration-dotted underline-offset-2 hover:text-blue-950 hover:decoration-solid cursor-pointer"
            >
              {m.mor}
            </button>
          </td>
          <td className={`border ${cellBorder} px-1.5 text-right font-semibold text-rose-700`}>
            <button
              type="button"
              onClick={() =>
                openDrill({
                  type: 'CADRE_CELL',
                  metric: 'VAC',
                  depotId,
                  divisionScope,
                  postGroup: grp,
                })
              }
              className="underline decoration-dotted underline-offset-2 hover:text-rose-950 hover:decoration-solid cursor-pointer"
            >
              {m.vac}
            </button>
          </td>
          <td className={`border ${cellBorder} px-1.5 text-right text-slate-700`}>
            {m.vacPercent === 'N/A' ? (
              'N/A'
            ) : (
              <button
                type="button"
                onClick={() =>
                  openDrill({
                    type: 'CADRE_CELL',
                    metric: 'VAC',
                    depotId,
                    divisionScope,
                    postGroup: grp,
                  })
                }
                className="hover:text-slate-950 hover:underline decoration-dotted cursor-pointer"
              >
                {m.vacPercent}
              </button>
            )}
          </td>
        </React.Fragment>
      );
    });

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col">
      {/* SCREEN-ONLY WEB HEADER */}
      <header className="no-print bg-[#0F2942] text-white shadow-md border-b-4 border-amber-500">
        <div className="mx-auto max-w-[1600px] px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-500/20 p-2 border border-amber-400/40">
              <Train className="h-7 w-7 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-xl font-bold tracking-tight">{SYSTEM_BRANDING.primaryHeader}</h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/20 border border-orange-400/40 px-2 py-0.5 text-[10px] font-bold text-orange-300">
                  <Flame className="h-3 w-3" /> WCR Cadre Live
                </span>
              </div>
              <p className="text-xs text-amber-300 font-medium">
                {SYSTEM_BRANDING.hindiTitle} • {SYSTEM_BRANDING.developerAttribution}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={fetchFirebaseDashboard}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 border border-white/20 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> 🔄 Refresh Cadre
            </button>

            {!isAdminUnlocked ? (
              <button
                type="button"
                onClick={() => {
                  setAdminPinError(null);
                  setAdminModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 border border-amber-400/50 px-3.5 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/30"
              >
                <Lock className="h-3.5 w-3.5" /> Admin Console
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsAdminUnlocked(false)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-rose-500"
              >
                <Unlock className="h-3.5 w-3.5" /> Lock Admin
              </button>
            )}
          </div>
        </div>

        {/* ADMIN CONSOLE BAR (ONLY VISIBLE AFTER UNLOCKING ADMIN CONSOLE) */}
        {isAdminUnlocked && (
          <div className="bg-slate-900/95 border-t border-amber-500/40 px-4 py-2.5">
            <div className="mx-auto max-w-[1600px] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="rounded bg-amber-500 px-2 py-0.5 text-[10px] font-extrabold text-slate-950 uppercase">
                  Admin Console
                </span>
                <span className="text-slate-300">
                  Database Mode:{' '}
                  <strong className={cloudEnvReady ? 'text-emerald-400' : 'text-amber-300'}>
                    {cloudEnvReady
                      ? 'Cloud Firestore Connected (Live Sync)'
                      : 'Bundled Vercel Snapshot (Add Firestore Keys in Vercel for Live Cloud Updates)'}
                  </strong>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setUploadOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 shadow"
                >
                  <Upload className="h-3.5 w-3.5" /> 📤 Upload Data
                </button>
                <button
                  onClick={handleRebalanceLobbies}
                  disabled={rebalancing}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 shadow disabled:opacity-50"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  {rebalancing ? 'Assigning Lobbies...' : '📍 Assign Lobbies by Crew ID'}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadVercelSnapshot}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-500"
                  title="Download wcr-snapshot.json to embed permanently in Vercel build"
                >
                  <Download className="h-3.5 w-3.5" /> Save Snapshot JSON
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="print-container mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 space-y-5">
        {/* PRINT-ONLY DYNAMIC HEADER */}
        <div className="print-only-block border-b-2 border-slate-900 pb-1.5 mb-2">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-sm font-extrabold tracking-wide text-slate-950 uppercase">
                {printHeaderInfo.en}
              </div>
              <div className="text-[10px] font-semibold text-slate-700">
                {printHeaderInfo.hi} • {activeReportHeading}
              </div>
            </div>
            <div className="text-right text-[9px] text-slate-700">
              <div>Print Date: {new Date().toLocaleDateString('en-IN')}</div>
              <div>
                SS: <strong>{cadreSummary.wcrZoneTotal.grandTotal.ss}</strong> | MOR:{' '}
                <strong>{cadreSummary.wcrZoneTotal.grandTotal.mor}</strong> | VAC:{' '}
                <strong>{cadreSummary.wcrZoneTotal.grandTotal.vac}</strong>
              </div>
            </div>
          </div>
        </div>

        {statusBanner && (
          <div className="no-print flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-300 px-4 py-2.5 text-xs font-semibold text-emerald-950">
            <span>✅ {statusBanner}</span>
            <button onClick={() => setStatusBanner(null)} className="text-emerald-700 hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {/* HYPERLINKED KPI SUMMARY CARDS */}
        <div className="no-print grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-xl bg-white p-4 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
              <span>{selectedDivision === 'ALL' ? 'WCR' : selectedDivision} Sanctioned Strength (SS)</span>
              <ShieldCheck className="h-4 w-4 text-[#0F2942]" />
            </div>
            <button
              type="button"
              onClick={() =>
                openDrill({
                  type: 'CADRE_CELL',
                  metric: 'SS',
                  depotId: 'ALL',
                  divisionScope: selectedDivision,
                  postGroup: 'GRAND_TOTAL',
                })
              }
              title="Click to inspect Sanctioned Strength breakdown"
              className="mt-2 text-2xl font-extrabold text-[#0F2942] underline decoration-dotted underline-offset-4 hover:text-blue-800 cursor-pointer"
            >
              {cadreSummary.wcrZoneTotal.grandTotal.ss}
            </button>
            <div className="mt-1 text-xs text-slate-500">
              Across {filteredDepots.length} Active Lobbies • Vacancy:{' '}
              <button
                type="button"
                onClick={() =>
                  openDrill({
                    type: 'CADRE_CELL',
                    metric: 'VAC',
                    depotId: 'ALL',
                    divisionScope: selectedDivision,
                    postGroup: 'GRAND_TOTAL',
                  })
                }
                className="font-bold text-rose-700 underline decoration-dotted hover:decoration-solid cursor-pointer"
              >
                {cadreSummary.wcrZoneTotal.grandTotal.vac} ({cadreSummary.wcrZoneTotal.grandTotal.vacPercent})
              </button>
            </div>
          </div>

          <div className="rounded-xl bg-white p-4 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
              <span>Men on Roll (MOR) / Working</span>
              <Users className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 flex flex-wrap items-baseline gap-2">
              <button
                type="button"
                onClick={() => openDrill({ type: 'KPI_LIST', category: 'ALL_MOR', divisionScope: selectedDivision })}
                title="Click to view all Men on Roll"
                className="text-2xl font-extrabold text-emerald-700 underline decoration-dotted underline-offset-4 hover:text-emerald-900 cursor-pointer"
              >
                {cadreSummary.wcrZoneTotal.grandTotal.mor}
              </button>
              <span className="text-xs font-medium text-slate-600">
                (Working:{' '}
                <button
                  type="button"
                  onClick={() => openDrill({ type: 'KPI_LIST', category: 'WORKING', divisionScope: selectedDivision })}
                  className="font-bold text-slate-900 underline decoration-dotted hover:text-blue-700 cursor-pointer"
                >
                  {cadreSummary.wcrZoneTotal.grandTotal.actualWorking}
                </button>{' '}
                | Drafted:{' '}
                <button
                  type="button"
                  onClick={() => openDrill({ type: 'KPI_LIST', category: 'DRAFTED', divisionScope: selectedDivision })}
                  className="font-bold text-amber-700 underline decoration-dotted hover:text-amber-900 cursor-pointer"
                >
                  {cadreSummary.wcrZoneTotal.grandTotal.drafted}
                </button>
                )
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-500">Click any number to view full crew list</div>
          </div>

          <div className="rounded-xl bg-rose-50 p-4 shadow-sm border-2 border-rose-400">
            <div className="flex items-center justify-between text-xs font-bold text-rose-800 uppercase">
              <span>Urgent PME Alerts (≤ 3 Days / Overdue)</span>
              <AlertCircle className="h-4 w-4 text-rose-600" />
            </div>
            <button
              type="button"
              onClick={() => openDrill({ type: 'KPI_LIST', category: 'PME_URGENT', divisionScope: selectedDivision })}
              title="Click to inspect PME Due & Overdue Crew"
              className="mt-2 text-2xl font-extrabold text-rose-700 underline decoration-dotted underline-offset-4 hover:text-rose-950 cursor-pointer"
            >
              {pmeAlerts.urgentOrOverdue.length} Crew
            </button>
            <div className="mt-1 text-xs text-rose-700">
              Overdue: {pmeAlerts.overdue.length} | Due ≤ 3 Days: {pmeAlerts.dueWithin3Days.length}
            </div>
          </div>

          <div className="rounded-xl bg-white p-4 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
              <span>Retirements (Next 365 Days)</span>
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <button
              type="button"
              onClick={() => openDrill({ type: 'KPI_LIST', category: 'RETIREMENT_365', divisionScope: selectedDivision })}
              title="Click to inspect retiring crew within 365 days"
              className="mt-2 text-2xl font-extrabold text-slate-800 underline decoration-dotted underline-offset-4 hover:text-blue-800 cursor-pointer"
            >
              {retirementAlerts.within365Days.length}
            </button>
            <div className="mt-1 text-xs text-slate-600 space-x-1.5">
              <button
                type="button"
                onClick={() => openDrill({ type: 'KPI_LIST', category: 'RETIREMENT_30', divisionScope: selectedDivision })}
                className="underline decoration-dotted hover:text-blue-700 font-semibold cursor-pointer"
              >
                30d: {retirementAlerts.within30Days.length}
              </button>
              <span>|</span>
              <button
                type="button"
                onClick={() => openDrill({ type: 'KPI_LIST', category: 'RETIREMENT_90', divisionScope: selectedDivision })}
                className="underline decoration-dotted hover:text-blue-700 font-semibold cursor-pointer"
              >
                90d: {retirementAlerts.within90Days.length}
              </button>
              <span>|</span>
              <button
                type="button"
                onClick={() => openDrill({ type: 'KPI_LIST', category: 'RETIREMENT_180', divisionScope: selectedDivision })}
                className="underline decoration-dotted hover:text-blue-700 font-semibold cursor-pointer"
              >
                180d: {retirementAlerts.within180Days.length}
              </button>
            </div>
          </div>
        </div>

        {/* NAVIGATION TABS & CADRE VIEW SELECTOR */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3 shadow-sm border border-slate-200">
          <div className="flex flex-wrap items-center gap-2">
            {(['CADRE', 'EMPLOYEES', 'REPORTS'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
                  activeTab === tab ? 'bg-[#0F2942] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tab === 'CADRE' && 'Cadre Position Matrix'}
                {tab === 'EMPLOYEES' && `Employee Master & Nominated CLI (${searchedEmployees.length})`}
                {tab === 'REPORTS' && '15 Administrative Reports'}
              </button>
            ))}

            <div className="h-6 w-px bg-slate-300 mx-1" />

            <button
              type="button"
              onClick={selectHqDivSummary}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
                cadreViewMode === 'HQ_DIV_SUMMARY'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              HQ: Division Summary
            </button>

            <button
              type="button"
              onClick={selectHqLobbyWise}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
                cadreViewMode === 'HQ_LOBBY_WISE'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              HQ: All Lobbies + Div Totals
            </button>

            {(['JBP', 'BPL', 'KOTA'] as const).map((div) => (
              <button
                key={div}
                type="button"
                onClick={() => selectSingleDivision(div)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  cadreViewMode === 'DIVISION_LOBBY' && selectedDivision === div
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {div} Division
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Name, CMS ID (GGC1035), or Emp No..."
              className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-1.5 text-xs focus:border-[#0F2942] focus:outline-none"
            />
          </div>
        </div>

        {/* TAB 1: CADRE POSITION MATRIX */}
        {activeTab === 'CADRE' && (
          <section className="print-container rounded-xl bg-white p-4 shadow-sm border border-slate-200 space-y-3">
            <div className="no-print flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-[#0F2942]">{activeReportHeading}</h2>
                <p className="text-xs text-slate-500">
                  Click any <strong>Division</strong>, <strong>Lobby Code</strong>, <strong>SS</strong>, <strong>MOR</strong>, <strong>VAC</strong>, or <strong>%</strong> number to inspect full details.
                </p>
              </div>
              <ExportAndPrintToolbar
                meta={{
                  reportTitle: `${printHeaderInfo.en} — ${activeReportHeading}`,
                  fileNameBase: `WCR_Cadre_${cadreViewMode}_${selectedDivision}`,
                  generatedBy: 'A K Bajpai, CLI, JBP',
                  activeFilters: `View=${cadreViewMode}, Division=${selectedDivision}`,
                  isWideMatrix: true,
                }}
                headers={matrixHeaders}
                rows={matrixRows}
                rawData={cadreSummary.depotRows}
              />
            </div>

            <div className="table-scroll-container overflow-x-auto border border-slate-300 rounded-lg">
              <table className="min-w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#0F2942] text-white">
                    <th rowSpan={2} className="border border-slate-600 px-2.5 py-2">
                      {cadreViewMode === 'HQ_DIV_SUMMARY' ? 'DIVISION' : 'DIV'}
                    </th>
                    <th rowSpan={2} className="border border-slate-600 px-3 py-2">
                      {cadreViewMode === 'HQ_DIV_SUMMARY' ? 'LOBBIES' : 'CODE'}
                    </th>
                    {POST_GROUPS.map((grp) => (
                      <th
                        key={grp}
                        colSpan={4}
                        className={`border border-slate-600 px-2 py-1.5 text-center ${
                          grp === 'ALL LP' ? 'bg-amber-700' : ''
                        }`}
                      >
                        {grp}
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-slate-800 text-slate-100">
                    {POST_GROUPS.map((grp) => (
                      <React.Fragment key={grp}>
                        <th className="border border-slate-600 px-1.5 py-1">SS</th>
                        <th className="border border-slate-600 px-1.5 py-1">MOR</th>
                        <th className="border border-slate-600 px-1.5 py-1">VAC</th>
                        <th className="border border-slate-600 px-1.5 py-1">%</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {cadreViewMode === 'HQ_DIV_SUMMARY' && (
                    <>
                      {DIVISION_ORDER.map((div) => {
                        const divData = divisionCadreMap[div];
                        return (
                          <tr key={div} className="hover:bg-blue-50/50">
                            <td className="border border-slate-300 px-3 py-2 font-bold text-center">
                              <button
                                type="button"
                                onClick={() => selectSingleDivision(div)}
                                className="text-indigo-800 underline decoration-dotted underline-offset-2 hover:text-indigo-950 cursor-pointer"
                              >
                                {div} DIVISION
                              </button>
                            </td>
                            <td className="border border-slate-300 px-3 py-2 text-center font-mono text-slate-600">
                              <button
                                type="button"
                                onClick={() => selectSingleDivision(div)}
                                className="hover:text-blue-700 hover:underline cursor-pointer"
                              >
                                {divData.depotRows.length} Lobbies
                              </button>
                            </td>
                            {renderMetricCells(divData.wcrZoneTotal.posts, 'ALL', div, false)}
                          </tr>
                        );
                      })}

                      <tr className="bg-slate-200 font-bold text-slate-950">
                        <td colSpan={2} className="border border-slate-400 px-3 py-2 text-center">
                          TOTAL (WCR ZONE)
                        </td>
                        {renderMetricCells(cadreSummary.wcrZoneTotal.posts, 'ALL', 'ALL', true)}
                      </tr>
                    </>
                  )}

                  {cadreViewMode === 'HQ_LOBBY_WISE' && (
                    <>
                      {DIVISION_ORDER.map((div) => {
                        const divData = divisionCadreMap[div];
                        return (
                          <React.Fragment key={div}>
                            {divData.depotRows.map((row) => (
                              <tr key={row.depot_id} className="hover:bg-blue-50/40">
                                <td className="border border-slate-300 px-2.5 py-1.5 font-semibold text-center">
                                  <button
                                    type="button"
                                    onClick={() => selectSingleDivision(row.division_code)}
                                    className="hover:text-blue-700 hover:underline cursor-pointer"
                                  >
                                    {row.division_code}
                                  </button>
                                </td>
                                <td className="border border-slate-300 px-3 py-1.5 font-mono font-bold text-center">
                                  <button
                                    type="button"
                                    onClick={() => openDrill({ type: 'LOBBY', depotId: row.depot_id })}
                                    className="text-indigo-700 underline decoration-dotted underline-offset-2 hover:text-indigo-950 cursor-pointer"
                                  >
                                    {row.depot_code}
                                  </button>
                                </td>
                                {renderMetricCells(row.posts, row.depot_id, row.division_code, false)}
                              </tr>
                            ))}

                            <tr className="bg-amber-100/80 font-bold text-slate-900">
                              <td colSpan={2} className="border border-slate-400 px-3 py-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => selectSingleDivision(div)}
                                  className="text-slate-950 underline decoration-dotted hover:text-blue-800 cursor-pointer"
                                >
                                  {div} DIV TOTAL
                                </button>
                              </td>
                              {renderMetricCells(divData.wcrZoneTotal.posts, 'ALL', div, true)}
                            </tr>
                          </React.Fragment>
                        );
                      })}

                      <tr className="bg-slate-300 font-extrabold text-slate-950">
                        <td colSpan={2} className="border border-slate-500 px-3 py-2 text-center">
                          TOTAL (WCR ZONE)
                        </td>
                        {renderMetricCells(cadreSummary.wcrZoneTotal.posts, 'ALL', 'ALL', true)}
                      </tr>
                    </>
                  )}

                  {cadreViewMode === 'DIVISION_LOBBY' && (
                    <>
                      {cadreSummary.depotRows.map((row) => (
                        <tr key={row.depot_id} className="hover:bg-blue-50/40">
                          <td className="border border-slate-300 px-2.5 py-1.5 font-semibold text-center">
                            {row.division_code}
                          </td>
                          <td className="border border-slate-300 px-3 py-1.5 font-mono font-bold text-center">
                            <button
                              type="button"
                              onClick={() => openDrill({ type: 'LOBBY', depotId: row.depot_id })}
                              className="text-indigo-700 underline decoration-dotted underline-offset-2 hover:text-indigo-950 cursor-pointer"
                            >
                              {row.depot_code}
                            </button>
                          </td>
                          {renderMetricCells(row.posts, row.depot_id, row.division_code, false)}
                        </tr>
                      ))}

                      <tr className="bg-slate-200 font-bold text-slate-950">
                        <td colSpan={2} className="border border-slate-400 px-3 py-2 text-center">
                          TOTAL ({selectedDivision} DIVISION)
                        </td>
                        {renderMetricCells(cadreSummary.wcrZoneTotal.posts, 'ALL', selectedDivision, true)}
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* TAB 2: EMPLOYEE MASTER & NOMINATED CLI */}
        {activeTab === 'EMPLOYEES' && (
          <section className="print-container rounded-xl bg-white p-4 shadow-sm border border-slate-200 space-y-3">
            <div className="no-print flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-[#0F2942]">
                  {activeReportHeading} ({searchedEmployees.length} Records)
                </h2>
                <p className="text-xs text-slate-500">
                  Click any <strong>EMP NO</strong>, <strong>CMS ID</strong>, <strong>Employee Name</strong>, <strong>Lobby</strong>, or <strong>Nominated CLI</strong> to inspect full details.
                </p>
              </div>
              <ExportAndPrintToolbar
                meta={{
                  reportTitle: `${printHeaderInfo.en} — Employee Master & Nominated CLI`,
                  fileNameBase: `WCR_Employee_Master_${selectedDivision}`,
                  generatedBy: 'A K Bajpai, CLI, JBP',
                  activeFilters: `Division=${selectedDivision}, Search="${searchQuery || 'NONE'}"`,
                }}
                headers={['EMP NO', 'CMS ID', 'NAME', 'DIV', 'LOBBY', 'POST', 'NOMINATED CLI', 'STATUS', 'PME DUE DATE', 'RETIREMENT']}
                rows={searchedEmployees.map((e) => [
                  e.emp_no,
                  e.crew_id,
                  e.employee_name,
                  e.division_code,
                  e.current_station || e.depot_id.replace(/^DEP_[A-Z]+_/, ''),
                  e.designation_code,
                  e.nominated_cli_id ? `${e.nominated_cli_id} (${e.nominated_cli_name || ''})` : '—',
                  e.employment_status,
                  e.pme_due_date,
                  e.retirement_date,
                ])}
                rawData={searchedEmployees}
                keys={['emp_no', 'crew_id', 'employee_name', 'division_code', 'current_station', 'designation_code', 'nominated_cli_name', 'employment_status', 'pme_due_date', 'retirement_date']}
              />
            </div>

            <div className="table-scroll-container overflow-x-auto border border-slate-300 rounded-lg">
              <table className="min-w-full text-xs border-collapse">
                <thead className="bg-[#0F2942] text-white">
                  <tr>
                    <th className="border border-slate-600 px-3 py-2 text-left">EMP NO</th>
                    <th className="border border-slate-600 px-3 py-2 text-left">CMS ID</th>
                    <th className="border border-slate-600 px-3 py-2 text-left">EMPLOYEE NAME</th>
                    <th className="border border-slate-600 px-2 py-2">DIV</th>
                    <th className="border border-slate-600 px-2 py-2">LOBBY</th>
                    <th className="border border-slate-600 px-2 py-2">POST</th>
                    <th className="border border-slate-600 px-3 py-2 text-left">NOMINATED CLI</th>
                    <th className="border border-slate-600 px-2 py-2">STATUS</th>
                    <th className="border border-slate-600 px-3 py-2">PME DUE DATE</th>
                    <th className="border border-slate-600 px-3 py-2">RETIREMENT</th>
                  </tr>
                </thead>
                <tbody>
                  {searchedEmployees.slice(0, 300).map((e) => {
                    const isUrgentPme = pmeAlerts.urgentOrOverdue.some((u) => u.emp_no === e.emp_no);
                    const lobbyCode = e.current_station || e.depot_id.replace(/^DEP_[A-Z]+_/, '');
                    return (
                      <tr key={e.emp_no} className={isUrgentPme ? 'bg-rose-50' : 'hover:bg-blue-50/40'}>
                        <td className="border border-slate-300 px-3 py-2 font-mono font-bold">
                          <button
                            type="button"
                            onClick={() => openDrill({ type: 'EMPLOYEE', empNoOrCrewId: e.emp_no })}
                            className="text-blue-700 underline decoration-dotted underline-offset-2 hover:text-blue-950 cursor-pointer"
                          >
                            {e.emp_no}
                          </button>
                        </td>
                        <td className="border border-slate-300 px-3 py-2 font-mono">
                          <button
                            type="button"
                            onClick={() => openDrill({ type: 'EMPLOYEE', empNoOrCrewId: e.emp_no })}
                            className="text-blue-700 underline decoration-dotted underline-offset-2 hover:text-blue-950 cursor-pointer"
                          >
                            {e.crew_id}
                          </button>
                        </td>
                        <td className="border border-slate-300 px-3 py-2 font-semibold">
                          <button
                            type="button"
                            onClick={() => openDrill({ type: 'EMPLOYEE', empNoOrCrewId: e.emp_no })}
                            className="text-left text-blue-800 underline decoration-dotted underline-offset-2 hover:text-blue-950 cursor-pointer"
                          >
                            {e.employee_name}
                          </button>
                        </td>
                        <td className="border border-slate-300 px-2 py-2 text-center">{e.division_code}</td>
                        <td className="border border-slate-300 px-2 py-2 text-center font-mono font-bold">
                          <button
                            type="button"
                            onClick={() => openDrill({ type: 'LOBBY', depotId: e.depot_id })}
                            className="text-indigo-700 underline decoration-dotted underline-offset-2 hover:text-indigo-950 cursor-pointer"
                          >
                            {lobbyCode}
                          </button>
                        </td>
                        <td className="border border-slate-300 px-2 py-2 text-center font-bold">{e.designation_code}</td>
                        <td className="border border-slate-300 px-3 py-2 text-xs">
                          {e.nominated_cli_id ? (
                            <button
                              type="button"
                              onClick={() =>
                                openDrill({
                                  type: 'CLI',
                                  cliId: e.nominated_cli_id!,
                                  cliName: e.nominated_cli_name,
                                })
                              }
                              className="text-left font-medium text-emerald-800 underline decoration-dotted underline-offset-2 hover:text-emerald-950 cursor-pointer"
                            >
                              <span className="font-mono font-bold">{e.nominated_cli_id}</span> — {e.nominated_cli_name}
                            </button>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="border border-slate-300 px-2 py-2 text-center">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              e.employment_status === 'Drafted'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {e.employment_status}
                          </span>
                        </td>
                        <td className={`border border-slate-300 px-3 py-2 text-center font-bold ${isUrgentPme ? 'text-rose-700' : ''}`}>
                          {e.pme_due_date} {isUrgentPme && '⚠️'}
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-center">{e.retirement_date}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {searchedEmployees.length > 300 && (
              <p className="no-print text-xs text-slate-500">
                Showing first 300 rows for instant UI responsiveness. Use Search box or Export buttons to access all {searchedEmployees.length} rows.
              </p>
            )}
          </section>
        )}

        {/* TAB 3: CLICKABLE 15 ADMINISTRATIVE REPORTS */}
        {activeTab === 'REPORTS' && (
          <section className="print-container rounded-xl bg-white p-4 shadow-sm border border-slate-200 space-y-3">
            <div className="no-print flex items-center gap-2">
              <FileBarChart2 className="h-5 w-5 text-[#0F2942]" />
              <h2 className="text-base font-bold text-[#0F2942]">
                All 15 Official WCR Administrative Reports (Click any report to open live data)
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {ADMINISTRATIVE_REPORTS.map((rpt) => (
                <button
                  type="button"
                  key={rpt.id}
                  onClick={() => openDrill({ type: 'REPORT', reportId: rpt.id, divisionScope: selectedDivision })}
                  className="text-left rounded-lg border border-slate-200 p-3.5 hover:border-[#0F2942] hover:bg-blue-50/40 bg-slate-50/70 flex flex-col justify-between gap-2 cursor-pointer transition"
                >
                  <div>
                    <span className="inline-block rounded bg-[#0F2942] px-2 py-0.5 text-[10px] font-bold text-amber-300">
                      #{rpt.id} • {rpt.category}
                    </span>
                    <h3 className="mt-1.5 text-xs font-bold text-blue-900 underline decoration-dotted">
                      {rpt.title}
                    </h3>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Click to open report • .xlsx, .csv, .pdf, .json, .html & Print
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* PRINT-ONLY OFFICIAL FOOTER RIGHT BELOW TABLE */}
        <div className="print-only-block border-t border-slate-800 pt-1.5 mt-2 text-[9px] text-slate-800">
          <div className="flex items-center justify-between">
            <span>
              <strong>Generated by:</strong> A K Bajpai, Chief Loco Inspector (CLI), Jabalpur Division, West Central Railway
            </span>
            <span className="font-semibold">{SYSTEM_BRANDING.hindiFooter}</span>
          </div>
        </div>
      </main>

      {/* SCREEN-ONLY DARK FOOTER */}
      <footer className="no-print bg-slate-900 text-slate-300 border-t border-slate-800 py-3 px-4 text-xs">
        <div className="mx-auto max-w-[1600px] flex flex-wrap items-center justify-between gap-2">
          <span>{SYSTEM_BRANDING.developerAttribution}</span>
          <span className="text-amber-400 font-medium">{SYSTEM_BRANDING.hindiFooter}</span>
        </div>
      </footer>

      {/* ADMIN CONSOLE PIN UNLOCK MODAL */}
      {adminModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <form
            onSubmit={handleUnlockAdmin}
            className="w-full max-w-sm rounded-xl bg-white shadow-2xl border border-slate-300 overflow-hidden"
          >
            <div className="flex items-center justify-between bg-[#0F2942] px-4 py-3 text-white">
              <div className="flex items-center gap-2 text-sm font-bold">
                <Lock className="h-4 w-4 text-amber-400" />
                <span>WCR EMS — Admin Console</span>
              </div>
              <button
                type="button"
                onClick={() => setAdminModalOpen(false)}
                className="text-slate-300 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-600">
                डेटा अपलोड और लॉबी असाइनमेंट टूल्स खोलने के लिए <strong>Admin Console PIN</strong> दर्ज करें:
              </p>
              <input
                type="password"
                autoFocus
                value={adminPinInput}
                onChange={(e) => setAdminPinInput(e.target.value)}
                placeholder="Enter Admin PIN (Default: 2026)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-[#0F2942] focus:outline-none"
              />
              {adminPinError && (
                <div className="rounded bg-rose-50 border border-rose-200 px-3 py-1.5 text-xs text-rose-700 font-semibold">
                  {adminPinError}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setAdminModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyingPin || !adminPinInput}
                  className="rounded-lg bg-[#0F2942] px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {verifyingPin ? 'Checking...' : 'Unlock Admin Console'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <UploadDataModal
        open={uploadOpen}
        actorEmail={actorEmail}
        onClose={() => setUploadOpen(false)}
        onImportComplete={fetchFirebaseDashboard}
      />

      <EntityDetailModals
        stack={drillStack}
        onPush={pushDrill}
        onPop={popDrill}
        onCloseAll={closeAllDrills}
        employees={employees}
        depots={depots}
        ssRecords={ssRecords}
      />
    </div>
  );
}