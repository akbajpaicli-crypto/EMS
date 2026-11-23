'use client';

import React, { useMemo, useState } from 'react';
import {
  X,
  ArrowLeft,
  UserCheck,
  ShieldCheck,
  Users,
  AlertTriangle,
  Building2,
  Phone,
  Calendar,
  Award,
  FileBarChart2,
  Search,
} from 'lucide-react';
import {
  ADMINISTRATIVE_REPORTS,
  POST_GROUPS,
  SYSTEM_BRANDING,
  WCR_DEPOTS_SEED,
} from '@/lib/wcr-constants';
import {
  computeDepotCadreMatrix,
  evaluateDraftingBuckets,
  evaluatePmeAlerts,
  evaluateRetirementWindows,
  mapDesignationToBasePost,
  universalEmployeeSearch,
} from '@/lib/cadre-engine';
import {
  DepotMaster,
  DesignationCode,
  EmployeeMaster,
  PostGroup,
  SanctionedStrength,
} from '@/types/wcr';
import { ExportAndPrintToolbar } from './ExportAndPrintToolbar';

export type DrillDownTarget =
  | { type: 'EMPLOYEE'; empNoOrCrewId: string }
  | { type: 'CLI'; cliId: string; cliName?: string }
  | { type: 'LOBBY'; depotId: string }
  | {
      type: 'CADRE_CELL';
      metric: 'SS' | 'MOR' | 'VAC';
      depotId: string | 'ALL';
      divisionScope: 'ALL' | 'JBP' | 'BPL' | 'KOTA';
      postGroup: PostGroup | 'GRAND_TOTAL';
    }
  | {
      type: 'KPI_LIST';
      category: 'ALL_MOR' | 'WORKING' | 'DRAFTED' | 'PME_URGENT' | 'RETIREMENT_30' | 'RETIREMENT_90' | 'RETIREMENT_180' | 'RETIREMENT_365';
      divisionScope: 'ALL' | 'JBP' | 'BPL' | 'KOTA';
    }
  | {
      type: 'REPORT';
      reportId: number;
      divisionScope: 'ALL' | 'JBP' | 'BPL' | 'KOTA';
    };

interface EntityDetailModalsProps {
  stack: DrillDownTarget[];
  onPush: (target: DrillDownTarget) => void;
  onPop: () => void;
  onCloseAll: () => void;
  employees: EmployeeMaster[];
  depots: DepotMaster[];
  ssRecords: SanctionedStrength[];
}

function matchesPostGroup(desig: DesignationCode, group: PostGroup | 'GRAND_TOTAL'): boolean {
  if (group === 'GRAND_TOTAL') return true;
  if (group === 'ALL LP') return desig === 'LPG' || desig === 'LPP' || desig === 'LPM';
  return mapDesignationToBasePost(desig) === group;
}

export function EntityDetailModals({
  stack,
  onPush,
  onPop,
  onCloseAll,
  employees,
  depots,
  ssRecords,
}: EntityDetailModalsProps) {
  const [innerSearch, setInnerSearch] = useState('');

  const current = stack[stack.length - 1];

  const scopedEmployeesForCadre = useMemo(() => {
    if (!current || current.type !== 'CADRE_CELL') return [];
    return employees.filter((e) => {
      if (e.employment_status !== 'Active' && e.employment_status !== 'Drafted') return false;
      if (current.depotId !== 'ALL' && e.depot_id !== current.depotId) return false;
      if (current.depotId === 'ALL' && current.divisionScope !== 'ALL' && e.division_code !== current.divisionScope) {
        return false;
      }
      return matchesPostGroup(e.designation_code, current.postGroup);
    });
  }, [current, employees]);

  const scopedSsForCadre = useMemo(() => {
    if (!current || current.type !== 'CADRE_CELL') return [];
    return ssRecords.filter((s) => {
      if (!s.is_current) return false;
      if (current.depotId !== 'ALL' && s.depot_id !== current.depotId) return false;
      if (current.depotId === 'ALL' && current.divisionScope !== 'ALL' && s.division_code !== current.divisionScope) {
        return false;
      }
      return matchesPostGroup(s.designation_code, current.postGroup);
    });
  }, [current, ssRecords]);

  if (!current) return null;

  const renderLink = (label: React.ReactNode, target: DrillDownTarget, className = '') => (
    <button
      type="button"
      onClick={() => {
        setInnerSearch('');
        onPush(target);
      }}
      title="Click to inspect full details"
      className={`text-left font-semibold text-blue-700 underline decoration-dotted underline-offset-2 hover:text-blue-950 hover:decoration-solid cursor-pointer ${className}`}
    >
      {label}
    </button>
  );

  const renderEmployeeTable = (list: EmployeeMaster[], title: string, fileBase: string) => {
    const filtered = universalEmployeeSearch(list, innerSearch);
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={innerSearch}
              onChange={(e) => setInnerSearch(e.target.value)}
              placeholder="Filter by Name, CMS ID, or Emp No..."
              className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 text-xs"
            />
          </div>

          <ExportAndPrintToolbar
            meta={{
              reportTitle: title,
              fileNameBase: fileBase,
              generatedBy: 'A K Bajpai, CLI, JBP',
              activeFilters: `Count=${filtered.length}`,
            }}
            headers={['EMP NO', 'CMS ID', 'NAME', 'DIV', 'LOBBY', 'POST', 'NOMINATED CLI', 'STATUS', 'PME DUE', 'RETIREMENT']}
            rows={filtered.map((e) => [
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
            rawData={filtered}
            keys={['emp_no', 'crew_id', 'employee_name', 'division_code', 'current_station', 'designation_code', 'nominated_cli_name', 'employment_status', 'pme_due_date', 'retirement_date']}
          />
        </div>

        <div className="overflow-x-auto border border-slate-300 rounded-lg max-h-[52vh]">
          <table className="min-w-full text-xs border-collapse">
            <thead className="bg-[#0F2942] text-white sticky top-0">
              <tr>
                <th className="border border-slate-600 px-2.5 py-2 text-left">EMP NO</th>
                <th className="border border-slate-600 px-2.5 py-2 text-left">CMS ID</th>
                <th className="border border-slate-600 px-2.5 py-2 text-left">NAME</th>
                <th className="border border-slate-600 px-2 py-2">DIV</th>
                <th className="border border-slate-600 px-2 py-2">LOBBY</th>
                <th className="border border-slate-600 px-2 py-2">POST</th>
                <th className="border border-slate-600 px-2.5 py-2 text-left">NOMINATED CLI</th>
                <th className="border border-slate-600 px-2 py-2">STATUS</th>
                <th className="border border-slate-600 px-2.5 py-2">PME DUE</th>
                <th className="border border-slate-600 px-2.5 py-2">RETIREMENT</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-slate-500">
                    No matching records found.
                  </td>
                </tr>
              ) : (
                filtered.map((e) => {
                  const lobbyCode = e.current_station || e.depot_id.replace(/^DEP_[A-Z]+_/, '');
                  return (
                    <tr key={e.emp_no} className="hover:bg-blue-50/50">
                      <td className="border border-slate-300 px-2.5 py-1.5 font-mono">
                        {renderLink(e.emp_no, { type: 'EMPLOYEE', empNoOrCrewId: e.emp_no })}
                      </td>
                      <td className="border border-slate-300 px-2.5 py-1.5 font-mono">
                        {renderLink(e.crew_id, { type: 'EMPLOYEE', empNoOrCrewId: e.emp_no })}
                      </td>
                      <td className="border border-slate-300 px-2.5 py-1.5">
                        {renderLink(e.employee_name, { type: 'EMPLOYEE', empNoOrCrewId: e.emp_no })}
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-center">{e.division_code}</td>
                      <td className="border border-slate-300 px-2 py-1.5 text-center font-mono">
                        {renderLink(lobbyCode, { type: 'LOBBY', depotId: e.depot_id }, 'text-indigo-700')}
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-center font-bold">{e.designation_code}</td>
                      <td className="border border-slate-300 px-2.5 py-1.5">
                        {e.nominated_cli_id ? (
                          renderLink(
                            `${e.nominated_cli_id} — ${e.nominated_cli_name || ''}`,
                            { type: 'CLI', cliId: e.nominated_cli_id, cliName: e.nominated_cli_name },
                            'text-emerald-800'
                          )
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-center">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            e.employment_status === 'Drafted'
                              ? 'bg-amber-100 text-amber-800'
                              : e.employment_status === 'Retired'
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {e.employment_status}
                        </span>
                      </td>
                      <td className="border border-slate-300 px-2.5 py-1.5 text-center">{e.pme_due_date}</td>
                      <td className="border border-slate-300 px-2.5 py-1.5 text-center">{e.retirement_date}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // --- VIEW 1: COMPLETE EMPLOYEE BIODATA & SERVICE PROFILE ---
  if (current.type === 'EMPLOYEE') {
    const query = current.empNoOrCrewId.trim().toUpperCase();
    const emp = employees.find(
      (e) => e.emp_no.toUpperCase() === query || e.crew_id.toUpperCase() === query
    );

    const lobbyInfo = emp
      ? WCR_DEPOTS_SEED.find((d) => d.depot_id === emp.depot_id)
      : undefined;

    const pmeDays = emp
      ? Math.floor((new Date(emp.pme_due_date).getTime() - Date.now()) / 86400000)
      : 0;
    const retDays = emp
      ? Math.floor((new Date(emp.retirement_date).getTime() - Date.now()) / 86400000)
      : 0;

    return (
      <ModalShell
        title={emp ? `${emp.employee_name} (${emp.crew_id} • EMP NO: ${emp.emp_no})` : `Record: ${current.empNoOrCrewId}`}
        subtitle="Complete Employee Biodata, Nominated CLI & Service Particulars"
        canGoBack={stack.length > 1}
        onBack={onPop}
        onClose={onCloseAll}
      >
        {!emp ? (
          <div className="p-6 text-center text-sm text-slate-600">
            Employee record <strong>{current.empNoOrCrewId}</strong> was not found in active master roll.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded bg-[#0F2942] px-2.5 py-1 text-xs font-bold text-amber-300">
                  {emp.designation_code} • {emp.pay_level}
                </span>
                <span
                  className={`rounded px-2.5 py-1 text-xs font-bold ${
                    emp.employment_status === 'Drafted'
                      ? 'bg-amber-100 text-amber-900'
                      : 'bg-emerald-100 text-emerald-900'
                  }`}
                >
                  Status: {emp.employment_status}
                </span>
              </div>

              <ExportAndPrintToolbar
                meta={{
                  reportTitle: `Employee Service Biodata — ${emp.employee_name} (${emp.emp_no})`,
                  fileNameBase: `WCR_Biodata_${emp.emp_no}`,
                  generatedBy: 'A K Bajpai, CLI, JBP',
                  activeFilters: `EMP_NO=${emp.emp_no}`,
                }}
                headers={['FIELD', 'VALUE']}
                rows={[
                  ['Employee Number (EMP NO)', emp.emp_no],
                  ['CMS / Crew ID', emp.crew_id],
                  ['Employee Name', emp.employee_name],
                  ['Division', emp.division_code],
                  ['Base Lobby / Depot', `${lobbyInfo?.depot_code || emp.current_station} (${lobbyInfo?.depot_name || ''})`],
                  ['Designation & Cadre', `${emp.designation_code} (Cadre: ${emp.cadre_code})`],
                  ['Pay Level & Present Pay', `${emp.pay_level} ${emp.present_pay ? `• ₹${emp.present_pay}` : ''}`],
                  ['Date of Birth (DOB)', emp.dob],
                  ['Date of Appointment (DOA)', emp.date_of_appointment],
                  ['Date of Promotion (DOP)', emp.date_of_promotion || 'N/A'],
                  ['Next Increment Date', emp.next_increment_date || 'N/A'],
                  ['PME Due Date', `${emp.pme_due_date} (${pmeDays < 0 ? `Overdue by ${Math.abs(pmeDays)}d` : `${pmeDays} days left`})`],
                  ['Superannuation / Retirement Date', `${emp.retirement_date} (${retDays} days left)`],
                  ['Nominated CLI', emp.nominated_cli_id ? `${emp.nominated_cli_id} — ${emp.nominated_cli_name || ''}` : 'Not Assigned'],
                  ['CLI Allotted Date & Grade', `${emp.cli_allotted_date || 'N/A'} • Grade: ${emp.current_grade || 'N/A'}`],
                  ['Mobile No.', emp.mobile_no || 'N/A'],
                ]}
                rawData={[emp]}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-1.5">
                <div className="font-bold text-[#0F2942] uppercase text-[11px] flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-amber-600" /> Identity & Posting
                </div>
                <div><strong>EMP NO (Immutable):</strong> <span className="font-mono">{emp.emp_no}</span></div>
                <div><strong>CMS / Crew ID:</strong> <span className="font-mono">{emp.crew_id}</span></div>
                <div><strong>Full Name:</strong> {emp.employee_name}</div>
                <div><strong>Division:</strong> {emp.division_code}</div>
                <div>
                  <strong>Lobby / HQ:</strong>{' '}
                  {renderLink(
                    `${lobbyInfo?.depot_code || emp.current_station} (${lobbyInfo?.depot_name || emp.depot_id})`,
                    { type: 'LOBBY', depotId: emp.depot_id }
                  )}
                </div>
                <div><strong>Cadre / Pay:</strong> Cadre {emp.cadre_code} • {emp.pay_level} {emp.present_pay ? `(₹${emp.present_pay})` : ''}</div>
                <div className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5 text-slate-500" /> <strong>Mobile:</strong> {emp.mobile_no || 'Not recorded'}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-1.5">
                <div className="font-bold text-[#0F2942] uppercase text-[11px] flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-blue-600" /> Service Dates & Medical (PME)
                </div>
                <div><strong>Date of Birth (DOB):</strong> {emp.dob}</div>
                <div><strong>Date of Appointment:</strong> {emp.date_of_appointment}</div>
                <div><strong>Date of Promotion:</strong> {emp.date_of_promotion || '—'}</div>
                <div><strong>Next Increment:</strong> {emp.next_increment_date || '—'}</div>
                <div className={pmeDays <= 3 ? 'text-rose-700 font-bold' : ''}>
                  <strong>PME Due Date:</strong> {emp.pme_due_date}{' '}
                  <span>({pmeDays < 0 ? `Overdue ${Math.abs(pmeDays)}d` : `${pmeDays} days left`})</span>
                </div>
                <div>
                  <strong>Retirement Date:</strong> {emp.retirement_date}{' '}
                  <span className="text-slate-500">({retDays} days)</span>
                </div>
              </div>

              <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3.5 space-y-1.5">
                <div className="font-bold text-emerald-950 uppercase text-[11px] flex items-center gap-1.5">
                  <Award className="h-4 w-4 text-emerald-700" /> Nominated CLI & Grading
                </div>
                {emp.nominated_cli_id ? (
                  <>
                    <div>
                      <strong>Nominated CLI ID:</strong>{' '}
                      {renderLink(emp.nominated_cli_id, {
                        type: 'CLI',
                        cliId: emp.nominated_cli_id,
                        cliName: emp.nominated_cli_name,
                      })}
                    </div>
                    <div>
                      <strong>Nominated CLI Name:</strong>{' '}
                      {renderLink(emp.nominated_cli_name || emp.nominated_cli_id, {
                        type: 'CLI',
                        cliId: emp.nominated_cli_id,
                        cliName: emp.nominated_cli_name,
                      })}
                    </div>
                    <div><strong>CLI Allotted Date:</strong> {emp.cli_allotted_date || '—'}</div>
                    <div><strong>Current Safety Grade:</strong> {emp.current_grade || '—'}</div>
                  </>
                ) : (
                  <div className="text-slate-500">
                    {emp.designation_code === 'CLI'
                      ? 'Employee is a Chief Loco Inspector (CLI).'
                      : 'No CLI mapped yet. Upload LI GRADING sheet to link.'}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </ModalShell>
    );
  }

  // --- VIEW 2: NOMINATED CLI PROFILE & ALLOTTED CREW ROSTER ---
  if (current.type === 'CLI') {
    const cleanCliId = current.cliId.trim().toUpperCase();
    const cliBio = employees.find(
      (e) => e.crew_id.toUpperCase() === cleanCliId || e.emp_no.toUpperCase() === cleanCliId
    );
    const allottedCrew = employees.filter(
      (e) => String(e.nominated_cli_id || '').trim().toUpperCase() === cleanCliId
    );

    return (
      <ModalShell
        title={`CLI Profile: ${cliBio?.employee_name || current.cliName || cleanCliId} (${cleanCliId})`}
        subtitle={`Chief Loco Inspector Details & Allotted Crew Roster (${allottedCrew.length} Crew Members)`}
        canGoBack={stack.length > 1}
        onBack={onPop}
        onClose={onCloseAll}
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/70 p-3.5 text-xs grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase text-indigo-800">CLI ID / EMP NO</div>
              <div className="font-mono font-bold text-sm text-[#0F2942]">
                {cleanCliId} {cliBio ? `• ${cliBio.emp_no}` : ''}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase text-indigo-800">CLI Name</div>
              <div className="font-bold text-sm">{cliBio?.employee_name || current.cliName || '—'}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase text-indigo-800">HQ Lobby & Division</div>
              <div className="font-semibold">
                {cliBio ? `${cliBio.current_station} (${cliBio.division_code})` : cleanCliId.replace(/[0-9]/g, '')}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase text-indigo-800">Mobile & Allotted Crew</div>
              <div className="font-semibold">
                {cliBio?.mobile_no || 'N/A'} • <strong>{allottedCrew.length} Crew</strong>
              </div>
            </div>
          </div>

          {renderEmployeeTable(
            allottedCrew,
            `Allotted Crew under CLI ${cliBio?.employee_name || current.cliName || cleanCliId} (${cleanCliId})`,
            `CLI_Crew_Roster_${cleanCliId}`
          )}
        </div>
      </ModalShell>
    );
  }

  // --- VIEW 3: LOBBY COMPLETE PROFILE & CREW ROSTER ---
  if (current.type === 'LOBBY') {
    const depot = depots.find((d) => d.depot_id === current.depotId) || WCR_DEPOTS_SEED.find((d) => d.depot_id === current.depotId);
    const lobbyCrew = employees.filter((e) => e.depot_id === current.depotId);
    const lobbyMatrix = depot ? computeDepotCadreMatrix([depot], employees, ssRecords).depotRows[0] : null;

    return (
      <ModalShell
        title={`Lobby Profile: ${depot?.depot_code || current.depotId} — ${depot?.depot_name || ''}`}
        subtitle={`Division: ${depot?.division_code || ''} • Location: ${depot?.location || ''} • On-Roll Crew: ${lobbyCrew.length}`}
        canGoBack={stack.length > 1}
        onBack={onPop}
        onClose={onCloseAll}
      >
        <div className="space-y-4">
          {lobbyMatrix && (
            <div className="grid grid-cols-2 md:grid-cols-7 gap-2 text-xs">
              {POST_GROUPS.map((grp) => {
                const m = lobbyMatrix.posts[grp];
                return (
                  <div key={grp} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                    <div className="font-bold text-[#0F2942]">{grp}</div>
                    <div className="mt-1 flex justify-between">
                      <span>SS:</span>
                      {renderLink(m.ss, {
                        type: 'CADRE_CELL',
                        metric: 'SS',
                        depotId: current.depotId,
                        divisionScope: depot?.division_code || 'ALL',
                        postGroup: grp,
                      })}
                    </div>
                    <div className="flex justify-between">
                      <span>MOR:</span>
                      {renderLink(m.mor, {
                        type: 'CADRE_CELL',
                        metric: 'MOR',
                        depotId: current.depotId,
                        divisionScope: depot?.division_code || 'ALL',
                        postGroup: grp,
                      })}
                    </div>
                    <div className="flex justify-between">
                      <span>VAC:</span>
                      {renderLink(
                        `${m.vac} (${m.vacPercent})`,
                        {
                          type: 'CADRE_CELL',
                          metric: 'VAC',
                          depotId: current.depotId,
                          divisionScope: depot?.division_code || 'ALL',
                          postGroup: grp,
                        },
                        'text-rose-700'
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {renderEmployeeTable(
            lobbyCrew,
            `Lobby Crew Roster — ${depot?.depot_code || current.depotId}`,
            `Lobby_Crew_${depot?.depot_code || current.depotId}`
          )}
        </div>
      </ModalShell>
    );
  }

  // --- VIEW 4: CADRE MATRIX CELL DRILL-DOWN (SS, MOR, VAC, %) ---
  if (current.type === 'CADRE_CELL') {
    const depot = current.depotId === 'ALL' ? null : depots.find((d) => d.depot_id === current.depotId);
    const scopeLabel = depot
      ? `${depot.depot_code} (${depot.division_code})`
      : current.divisionScope === 'ALL'
      ? 'WCR Zone (All 20 Lobbies)'
      : `${current.divisionScope} Division`;

    const totalSS = scopedSsForCadre.reduce((s, r) => s + r.new_ss, 0);
    const totalMOR = scopedEmployeesForCadre.length;
    const totalDrafted = scopedEmployeesForCadre.filter((e) => e.employment_status === 'Drafted').length;
    const totalVAC = Math.max(0, totalSS - totalMOR);
    const vacPct = totalSS === 0 ? 'N/A' : `${((totalVAC / totalSS) * 100).toFixed(2)}%`;

    return (
      <ModalShell
        title={`${current.metric} Details — ${scopeLabel} • Post: ${current.postGroup}`}
        subtitle={`SS: ${totalSS} | MOR: ${totalMOR} (Working: ${totalMOR - totalDrafted}, Drafted: ${totalDrafted}) | Vacancy: ${totalVAC} (${vacPct})`}
        canGoBack={stack.length > 1}
        onBack={onPop}
        onClose={onCloseAll}
      >
        <div className="space-y-4">
          {/* Summary Strip with Cross-Links between SS, MOR, and VAC */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 text-xs">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-[10px] font-bold uppercase text-slate-500">Sanctioned (SS)</div>
              <div className="text-lg font-extrabold text-[#0F2942]">{totalSS}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-[10px] font-bold uppercase text-slate-500">Men on Roll (MOR)</div>
              <div className="text-lg font-extrabold text-emerald-700">{totalMOR}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-[10px] font-bold uppercase text-slate-500">Actual Working</div>
              <div className="text-lg font-extrabold text-slate-800">{totalMOR - totalDrafted}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-[10px] font-bold uppercase text-slate-500">Drafted (In MOR)</div>
              <div className="text-lg font-extrabold text-amber-700">{totalDrafted}</div>
            </div>
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
              <div className="text-[10px] font-bold uppercase text-rose-700">Net Vacancy</div>
              <div className="text-lg font-extrabold text-rose-700">
                {totalVAC} ({vacPct})
              </div>
            </div>
          </div>

          {/* Sanctioned Strength Order Breakdown Table */}
          {scopedSsForCadre.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-[#0F2942] flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-amber-600" />
                Sanctioned Strength (SS) Order Records ({scopedSsForCadre.length})
              </div>
              <div className="overflow-x-auto border border-slate-300 rounded-lg max-h-44">
                <table className="min-w-full text-xs border-collapse">
                  <thead className="bg-slate-800 text-white">
                    <tr>
                      <th className="border border-slate-600 px-2 py-1.5">DIV</th>
                      <th className="border border-slate-600 px-2 py-1.5">LOBBY</th>
                      <th className="border border-slate-600 px-2 py-1.5">POST</th>
                      <th className="border border-slate-600 px-2 py-1.5 text-right">PREV SS</th>
                      <th className="border border-slate-600 px-2 py-1.5 text-right">CURRENT SS</th>
                      <th className="border border-slate-600 px-2 py-1.5 text-left">ORDER NO</th>
                      <th className="border border-slate-600 px-2 py-1.5">EFFECTIVE DATE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scopedSsForCadre.map((s) => {
                      const code = s.depot_id.replace(/^DEP_[A-Z]+_/, '');
                      return (
                        <tr key={s.ss_record_id} className="hover:bg-slate-50">
                          <td className="border border-slate-300 px-2 py-1 text-center">{s.division_code}</td>
                          <td className="border border-slate-300 px-2 py-1 text-center font-mono">
                            {renderLink(code, { type: 'LOBBY', depotId: s.depot_id })}
                          </td>
                          <td className="border border-slate-300 px-2 py-1 text-center font-bold">{s.designation_code}</td>
                          <td className="border border-slate-300 px-2 py-1 text-right text-slate-500">{s.previous_ss}</td>
                          <td className="border border-slate-300 px-2 py-1 text-right font-bold text-[#0F2942]">{s.new_ss}</td>
                          <td className="border border-slate-300 px-2 py-1 font-mono text-[11px]">{s.order_no}</td>
                          <td className="border border-slate-300 px-2 py-1 text-center">{s.effective_date}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Men on Roll (MOR) Crew List */}
          <div className="space-y-1.5">
            <div className="text-xs font-bold text-[#0F2942] flex items-center gap-1.5">
              <Users className="h-4 w-4 text-emerald-600" />
              Men on Roll (MOR) Crew List ({scopedEmployeesForCadre.length} Employees)
            </div>
            {renderEmployeeTable(
              scopedEmployeesForCadre,
              `${scopeLabel} — ${current.postGroup} Crew List`,
              `WCR_${scopeLabel.replace(/[^A-Z0-9]/gi, '_')}_${current.postGroup}`
            )}
          </div>
        </div>
      </ModalShell>
    );
  }

  // --- VIEW 5: KPI CARD DRILL-DOWN LISTS ---
  if (current.type === 'KPI_LIST') {
    const divFiltered =
      current.divisionScope === 'ALL'
        ? employees
        : employees.filter((e) => e.division_code === current.divisionScope);

    let list: EmployeeMaster[] = [];
    let heading = '';

    if (current.category === 'ALL_MOR') {
      list = divFiltered.filter((e) => e.employment_status === 'Active' || e.employment_status === 'Drafted');
      heading = 'All Men on Roll (MOR — Active + Drafted)';
    } else if (current.category === 'WORKING') {
      list = divFiltered.filter((e) => e.employment_status === 'Active');
      heading = 'Actual Working Crew (Active Status)';
    } else if (current.category === 'DRAFTED') {
      list = divFiltered.filter((e) => e.employment_status === 'Drafted');
      heading = 'Drafted Crew Accountal (Included in MOR)';
    } else if (current.category === 'PME_URGENT') {
      list = evaluatePmeAlerts(divFiltered).urgentOrOverdue;
      heading = 'Urgent PME Alerts (Due ≤ 3 Days or Overdue)';
    } else {
      const ret = evaluateRetirementWindows(divFiltered);
      if (current.category === 'RETIREMENT_30') {
        list = ret.within30Days;
        heading = 'Upcoming Retirements (Within 30 Days)';
      } else if (current.category === 'RETIREMENT_90') {
        list = ret.within90Days;
        heading = 'Upcoming Retirements (Within 90 Days)';
      } else if (current.category === 'RETIREMENT_180') {
        list = ret.within180Days;
        heading = 'Upcoming Retirements (Within 180 Days)';
      } else {
        list = ret.within365Days;
        heading = 'Upcoming Retirements (Within 365 Days)';
      }
    }

    return (
      <ModalShell
        title={`${heading} (${list.length} Records)`}
        subtitle={`Division Scope: ${current.divisionScope} • Click any EMP NO, CMS ID, Name, Lobby, or CLI for full details`}
        canGoBack={stack.length > 1}
        onBack={onPop}
        onClose={onCloseAll}
      >
        {renderEmployeeTable(list, heading, `WCR_${current.category}_${current.divisionScope}`)}
      </ModalShell>
    );
  }

  // --- VIEW 6: LIVE 15 ADMINISTRATIVE REPORTS ---
  if (current.type === 'REPORT') {
    const rptMeta = ADMINISTRATIVE_REPORTS.find((r) => r.id === current.reportId) || ADMINISTRATIVE_REPORTS[0];
    const divFiltered =
      current.divisionScope === 'ALL'
        ? employees
        : employees.filter((e) => e.division_code === current.divisionScope);

    let reportEmployees = divFiltered;
    if (current.reportId === 3) reportEmployees = evaluatePmeAlerts(divFiltered).urgentOrOverdue;
    else if (current.reportId === 8 || current.reportId === 9) {
      reportEmployees = divFiltered.filter((e) => e.employment_status === 'Drafted');
    } else if (current.reportId === 12) {
      reportEmployees = evaluateRetirementWindows(divFiltered).within365Days;
    }

    return (
      <ModalShell
        title={`Report #${rptMeta.id}: ${rptMeta.title}`}
        subtitle={`Category: ${rptMeta.category} • Division Scope: ${current.divisionScope}`}
        canGoBack={stack.length > 1}
        onBack={onPop}
        onClose={onCloseAll}
      >
        {renderEmployeeTable(
          reportEmployees,
          `Report #${rptMeta.id} — ${rptMeta.title}`,
          `WCR_${rptMeta.code}_${current.divisionScope}`
        )}
      </ModalShell>
    );
  }

  return null;
}

function ModalShell({
  title,
  subtitle,
  canGoBack,
  onBack,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  canGoBack: boolean;
  onBack: () => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 md:p-5">
      <div className="w-full max-w-6xl rounded-xl bg-white shadow-2xl border border-slate-300 overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between bg-[#0F2942] px-5 py-3 text-white border-b-2 border-amber-500">
          <div className="flex items-center gap-3 min-w-0">
            {canGoBack && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2.5 py-1 text-xs font-bold text-amber-300 hover:bg-white/25"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            )}
            <div className="truncate">
              <h3 className="text-sm md:text-base font-bold truncate">{title}</h3>
              <p className="text-[11px] text-amber-200 truncate">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-300 hover:bg-white/10 hover:text-white"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 md:p-5 overflow-y-auto flex-1">{children}</div>

        <div className="border-t bg-slate-100 px-5 py-2 text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-2">
          <span>{SYSTEM_BRANDING.developerAttribution}</span>
          <span className="font-semibold text-slate-800">{SYSTEM_BRANDING.hindiFooter}</span>
        </div>
      </div>
    </div>
  );
}