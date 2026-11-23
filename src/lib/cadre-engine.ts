import {
  DepotCadreRow,
  DepotMaster,
  DesignationCode,
  DraftingHistory,
  EmployeeMaster,
  PostCadreMetrics,
  PostGroup,
  SanctionedStrength,
  WcrUser,
} from '@/types/wcr';
import { POST_GROUPS, PROMOTION_CHANNEL_ORDER } from './wcr-constants';

export function mapDesignationToBasePost(desig: DesignationCode): Exclude<PostGroup, 'ALL LP'> {
  if (desig === 'ALP' || desig === 'SALP') return 'ALP';
  if (desig === 'LPS' || desig === 'SHT' || desig === 'SSHT') return 'LPS';
  return desig;
}

export function buildPostMetrics(post: PostGroup, ss: number, mor: number, drafted: number): PostCadreMetrics {
  const actualWorking = mor - drafted;
  const vac = Math.max(0, ss - mor);
  const excess = Math.max(0, mor - ss);
  const vacPercent = ss === 0 ? 'N/A' : `${((vac / ss) * 100).toFixed(2)}%`;
  return { post, ss, mor, drafted, actualWorking, vac, excess, vacPercent };
}

export function computeDepotCadreMatrix(
  depots: DepotMaster[],
  employees: EmployeeMaster[],
  ssRecords: SanctionedStrength[]
) {
  const activeSS = ssRecords.filter((r) => r.is_current);
  const onRollEmployees = employees.filter(
    (e) => e.employment_status === 'Active' || e.employment_status === 'Drafted'
  );

  const depotRows: DepotCadreRow[] = depots.map((depot) => {
    const baseCounts: Record<Exclude<PostGroup, 'ALL LP'>, { ss: number; mor: number; drafted: number }> = {
      ALP: { ss: 0, mor: 0, drafted: 0 },
      LPS: { ss: 0, mor: 0, drafted: 0 },
      LPG: { ss: 0, mor: 0, drafted: 0 },
      LPP: { ss: 0, mor: 0, drafted: 0 },
      LPM: { ss: 0, mor: 0, drafted: 0 },
      CLI: { ss: 0, mor: 0, drafted: 0 },
    };

    for (const ss of activeSS) {
      if (ss.depot_id === depot.depot_id) {
        const grp = mapDesignationToBasePost(ss.designation_code);
        baseCounts[grp].ss += ss.new_ss;
      }
    }

    for (const emp of onRollEmployees) {
      if (emp.depot_id === depot.depot_id) {
        const grp = mapDesignationToBasePost(emp.designation_code);
        baseCounts[grp].mor += 1;
        if (emp.employment_status === 'Drafted') {
          baseCounts[grp].drafted += 1;
        }
      }
    }

    const posts: Record<PostGroup, PostCadreMetrics> = {
      ALP: buildPostMetrics('ALP', baseCounts.ALP.ss, baseCounts.ALP.mor, baseCounts.ALP.drafted),
      LPS: buildPostMetrics('LPS', baseCounts.LPS.ss, baseCounts.LPS.mor, baseCounts.LPS.drafted),
      LPG: buildPostMetrics('LPG', baseCounts.LPG.ss, baseCounts.LPG.mor, baseCounts.LPG.drafted),
      LPP: buildPostMetrics('LPP', baseCounts.LPP.ss, baseCounts.LPP.mor, baseCounts.LPP.drafted),
      LPM: buildPostMetrics('LPM', baseCounts.LPM.ss, baseCounts.LPM.mor, baseCounts.LPM.drafted),
      'ALL LP': buildPostMetrics(
        'ALL LP',
        baseCounts.LPG.ss + baseCounts.LPP.ss + baseCounts.LPM.ss,
        baseCounts.LPG.mor + baseCounts.LPP.mor + baseCounts.LPM.mor,
        baseCounts.LPG.drafted + baseCounts.LPP.drafted + baseCounts.LPM.drafted
      ),
      CLI: buildPostMetrics('CLI', baseCounts.CLI.ss, baseCounts.CLI.mor, baseCounts.CLI.drafted),
    };

    const baseGroups: Exclude<PostGroup, 'ALL LP'>[] = ['ALP', 'LPS', 'LPG', 'LPP', 'LPM', 'CLI'];
    const totalSS = baseGroups.reduce((acc, g) => acc + posts[g].ss, 0);
    const totalMOR = baseGroups.reduce((acc, g) => acc + posts[g].mor, 0);
    const totalDrafted = baseGroups.reduce((acc, g) => acc + posts[g].drafted, 0);
    const totalVAC = baseGroups.reduce((acc, g) => acc + posts[g].vac, 0);
    const totalExcess = baseGroups.reduce((acc, g) => acc + posts[g].excess, 0);

    return {
      depot_id: depot.depot_id,
      depot_code: depot.depot_code,
      depot_name: depot.depot_name,
      division_code: depot.division_code,
      posts,
      grandTotal: {
        ss: totalSS,
        mor: totalMOR,
        drafted: totalDrafted,
        actualWorking: totalMOR - totalDrafted,
        vac: totalVAC,
        excess: totalExcess,
        vacPercent: totalSS === 0 ? 'N/A' : `${((totalVAC / totalSS) * 100).toFixed(2)}%`,
      },
    };
  });

  const aggregateRows = (rows: DepotCadreRow[]) => {
    const posts = {} as Record<PostGroup, PostCadreMetrics>;
    for (const p of POST_GROUPS) {
      const ss = rows.reduce((s, r) => s + r.posts[p].ss, 0);
      const mor = rows.reduce((s, r) => s + r.posts[p].mor, 0);
      const drafted = rows.reduce((s, r) => s + r.posts[p].drafted, 0);
      const vac = rows.reduce((s, r) => s + r.posts[p].vac, 0);
      const excess = rows.reduce((s, r) => s + r.posts[p].excess, 0);
      posts[p] = {
        post: p,
        ss,
        mor,
        drafted,
        actualWorking: mor - drafted,
        vac,
        excess,
        vacPercent: ss === 0 ? 'N/A' : `${((vac / ss) * 100).toFixed(2)}%`,
      };
    }
    const totalSS = rows.reduce((s, r) => s + r.grandTotal.ss, 0);
    const totalMOR = rows.reduce((s, r) => s + r.grandTotal.mor, 0);
    const totalDrafted = rows.reduce((s, r) => s + r.grandTotal.drafted, 0);
    const totalVAC = rows.reduce((s, r) => s + r.grandTotal.vac, 0);
    const totalExcess = rows.reduce((s, r) => s + r.grandTotal.excess, 0);

    return {
      posts,
      grandTotal: {
        ss: totalSS,
        mor: totalMOR,
        drafted: totalDrafted,
        actualWorking: totalMOR - totalDrafted,
        vac: totalVAC,
        excess: totalExcess,
        vacPercent: totalSS === 0 ? 'N/A' : `${((totalVAC / totalSS) * 100).toFixed(2)}%`,
      },
    };
  };

  return {
    depotRows,
    divisionTotals: {
      JBP: aggregateRows(depotRows.filter((r) => r.division_code === 'JBP')),
      BPL: aggregateRows(depotRows.filter((r) => r.division_code === 'BPL')),
      KOTA: aggregateRows(depotRows.filter((r) => r.division_code === 'KOTA')),
    },
    wcrZoneTotal: aggregateRows(depotRows),
  };
}

export function evaluatePmeAlerts(employees: EmployeeMaster[], referenceDate = new Date()) {
  const ref = new Date(referenceDate.toISOString().slice(0, 10));
  const results = employees
    .filter((e) => e.employment_status !== 'Retired' && e.employment_status !== 'Transferred')
    .map((emp) => {
      const due = new Date(emp.pme_due_date);
      const diffDays = Math.floor((due.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));
      let urgency: 'OVERDUE' | 'URGENT_3_DAY' | 'UPCOMING_30_DAY' | 'OK' = 'OK';
      if (diffDays < 0) urgency = 'OVERDUE';
      else if (diffDays <= 3) urgency = 'URGENT_3_DAY';
      else if (diffDays <= 30) urgency = 'UPCOMING_30_DAY';
      return { ...emp, daysRemaining: diffDays, urgency };
    });

  return {
    urgentOrOverdue: results.filter((r) => r.urgency === 'OVERDUE' || r.urgency === 'URGENT_3_DAY'),
    overdue: results.filter((r) => r.urgency === 'OVERDUE'),
    dueWithin3Days: results.filter((r) => r.urgency === 'URGENT_3_DAY'),
    allEvaluated: results,
  };
}

export function evaluateDraftingBuckets(draftings: DraftingHistory[], referenceDate = new Date()) {
  const ref = new Date(referenceDate.toISOString().slice(0, 10));
  const active = draftings.filter((d) => d.drafting_status !== 'RETURNED');
  const buckets = {
    dueWithin90Days: [] as (DraftingHistory & { daysRemaining: number })[],
    dueWithin30Days: [] as (DraftingHistory & { daysRemaining: number })[],
    periodCompleted: [] as (DraftingHistory & { daysRemaining: number })[],
    overdue: [] as (DraftingHistory & { daysRemaining: number })[],
    extensionRequired: [] as (DraftingHistory & { daysRemaining: number })[],
  };

  for (const d of active) {
    const exp = new Date(d.expected_return_date);
    const daysRemaining = Math.floor((exp.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));
    const item = { ...d, daysRemaining };

    if (daysRemaining < 0) {
      buckets.overdue.push(item);
      if (d.drafting_status !== 'EXTENDED') buckets.extensionRequired.push(item);
    } else if (daysRemaining === 0) {
      buckets.periodCompleted.push(item);
      buckets.extensionRequired.push(item);
    } else if (daysRemaining <= 30) {
      buckets.dueWithin30Days.push(item);
    } else if (daysRemaining <= 90) {
      buckets.dueWithin90Days.push(item);
    }
  }
  return buckets;
}

export function evaluateRetirementWindows(employees: EmployeeMaster[], referenceDate = new Date()) {
  const ref = new Date(referenceDate.toISOString().slice(0, 10));
  const active = employees.filter((e) => e.employment_status !== 'Retired');
  const withDays = active.map((e) => {
    const ret = new Date(e.retirement_date);
    const daysRemaining = Math.floor((ret.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));
    return { ...e, daysRemaining };
  });

  return {
    within30Days: withDays.filter((e) => e.daysRemaining <= 30),
    within90Days: withDays.filter((e) => e.daysRemaining <= 90),
    within180Days: withDays.filter((e) => e.daysRemaining <= 180),
    within365Days: withDays.filter((e) => e.daysRemaining <= 365),
  };
}

export function universalEmployeeSearch(employees: EmployeeMaster[], query: string): EmployeeMaster[] {
  const q = query.trim().toLowerCase();
  if (!q) return employees;
  return employees.filter(
    (e) =>
      e.employee_name.toLowerCase().includes(q) ||
      e.crew_id.toLowerCase().includes(q) ||
      e.emp_no.toLowerCase().includes(q)
  );
}

export function validateTransferPermission(
  actor: WcrUser,
  previousDivision: string,
  newDivision: string
): { allowed: boolean; code?: string; message?: string } {
  if (actor.role_code === 'VIEWER') {
    return { allowed: false, code: 'VIEWER_READ_ONLY', message: 'Viewer role cannot execute transfers.' };
  }
  if (previousDivision !== newDivision && actor.role_code !== 'HQ_ADMIN') {
    return {
      allowed: false,
      code: 'INTER_DIVISION_BLOCKED',
      message: 'INTER_DIVISION_BLOCKED: Only HQ_ADMIN can execute inter-division transfers across JBP, BPL, and KOTA.',
    };
  }
  return { allowed: true };
}

export function validatePromotionChannel(
  actor: WcrUser,
  prevDesig: DesignationCode,
  newDesig: DesignationCode
): { allowed: boolean; isChannelException: boolean; message?: string } {
  const prevRank = PROMOTION_CHANNEL_ORDER[prevDesig];
  const newRank = PROMOTION_CHANNEL_ORDER[newDesig];
  const isNormal =
    newRank === prevRank + 1 ||
    (['LPS', 'SHT', 'SSHT'].includes(prevDesig) && newDesig === 'LPG');
  const isChannelException = !isNormal;

  if (isChannelException && actor.role_code !== 'HQ_ADMIN') {
    return {
      allowed: false,
      isChannelException: true,
      message: `CHANNEL_EXCEPTION_BLOCKED: Non-standard promotion (${prevDesig} -> ${newDesig}) requires HQ_ADMIN approval.`,
    };
  }
  return { allowed: true, isChannelException };
}
