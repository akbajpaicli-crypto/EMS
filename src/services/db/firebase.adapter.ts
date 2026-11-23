import bundledSnapshot from '@/data/wcr-snapshot.json';
import { adminDb, adminStorage } from '@/lib/firebase-admin';
import {
  AuditLog,
  DepotMaster,
  DraftingHistory,
  EmployeeMaster,
  PromotionHistory,
  SanctionedStrength,
  ServiceHistory,
  TransferHistory,
  WcrUser,
} from '@/types/wcr';
import { resolveLobbyFromCrewId, SYSTEM_BRANDING, WCR_DEPOTS_SEED } from '@/lib/wcr-constants';
import { validatePromotionChannel, validateTransferPermission } from '@/lib/cadre-engine';

const SHARD_SIZE = 800;

const snapshotData = bundledSnapshot as {
  employees?: EmployeeMaster[];
  ssRecords?: SanctionedStrength[];
};

const DEFAULT_WCR_USERS: Record<string, WcrUser> = {
  'cli-jbp@wcr.railnet.gov.in': {
    user_id: 'USR_HQ_01',
    email: 'cli-jbp@wcr.railnet.gov.in',
    auth_mode: 'SSO',
    full_name: 'A K Bajpai',
    designation: 'Chief Loco Inspector (CLI)',
    role_code: 'HQ_ADMIN',
    assigned_division: 'ALL',
    assigned_depot_id: 'ALL',
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  'div-jbp@wcr.railnet.gov.in': {
    user_id: 'USR_JBP_01',
    email: 'div-jbp@wcr.railnet.gov.in',
    auth_mode: 'EMAIL_OTP',
    full_name: 'Sr. DEE (TRO) Jabalpur',
    designation: 'Sr. DEE (TRO)',
    role_code: 'DIVISION_ADMIN',
    assigned_division: 'JBP',
    assigned_depot_id: 'ALL',
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  'div-bpl@wcr.railnet.gov.in': {
    user_id: 'USR_BPL_01',
    email: 'div-bpl@wcr.railnet.gov.in',
    auth_mode: 'EMAIL_OTP',
    full_name: 'Sr. DEE (TRO) Bhopal',
    designation: 'Sr. DEE (TRO)',
    role_code: 'DIVISION_ADMIN',
    assigned_division: 'BPL',
    assigned_depot_id: 'ALL',
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  'div-kota@wcr.railnet.gov.in': {
    user_id: 'USR_KOTA_01',
    email: 'div-kota@wcr.railnet.gov.in',
    auth_mode: 'EMAIL_OTP',
    full_name: 'Sr. DEE (TRO) Kota',
    designation: 'Sr. DEE (TRO)',
    role_code: 'DIVISION_ADMIN',
    assigned_division: 'KOTA',
    assigned_depot_id: 'ALL',
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
  },
};

export class FirebaseWcrRepository {
  readonly providerName = 'firebase' as const;

  private scopeQuery(
    col: FirebaseFirestore.CollectionReference,
    actor: WcrUser,
    divField = 'division_code',
    depotField = 'depot_id'
  ) {
    if (actor.role_code === 'HQ_ADMIN' || (actor.assigned_division === 'ALL' && actor.role_code === 'VIEWER')) {
      return col;
    }
    if (actor.assigned_depot_id && actor.assigned_depot_id !== 'ALL') {
      return col.where(depotField, '==', actor.assigned_depot_id);
    }
    return col.where(divField, '==', actor.assigned_division);
  }

  private filterEmployeeScope(list: EmployeeMaster[], actor: WcrUser): EmployeeMaster[] {
    if (actor.role_code === 'HQ_ADMIN' || (actor.assigned_division === 'ALL' && actor.role_code === 'VIEWER')) {
      return list;
    }
    if (actor.assigned_depot_id && actor.assigned_depot_id !== 'ALL') {
      return list.filter((e) => e.depot_id === actor.assigned_depot_id);
    }
    return list.filter((e) => e.division_code === actor.assigned_division);
  }

  private async readAllEmployeeShards(): Promise<{ employees: EmployeeMaster[]; shardCount: number }> {
    try {
      const snap = await adminDb.collection('employee_shards').get();
      if (!snap.empty) {
        const employees: EmployeeMaster[] = [];
        for (const doc of snap.docs) {
          const items = doc.data()?.items;
          if (Array.isArray(items)) {
            employees.push(...(items as EmployeeMaster[]));
          }
        }
        if (employees.length > 0) {
          return { employees, shardCount: snap.size };
        }
      }
    } catch {
      // Fallback to bundled Vercel snapshot if Firestore credentials are not yet configured
    }

    const fallbackEmployees = Array.isArray(snapshotData.employees) ? snapshotData.employees : [];
    return { employees: fallbackEmployees, shardCount: 0 };
  }

  private async writeAllEmployeeShards(
    employees: EmployeeMaster[],
    previousShardCount: number
  ): Promise<{ cloudSynced: boolean; shardsWritten: number }> {
    const totalShards = Math.max(1, Math.ceil(employees.length / SHARD_SIZE));
    const batch = adminDb.batch();

    for (let i = 0; i < totalShards; i++) {
      const slice = employees.slice(i * SHARD_SIZE, (i + 1) * SHARD_SIZE);
      const shardId = `SHARD_${String(i + 1).padStart(3, '0')}`;
      const ref = adminDb.collection('employee_shards').doc(shardId);
      batch.set(ref, {
        shard_id: shardId,
        count: slice.length,
        updated_at: new Date().toISOString(),
        items: slice,
      });
    }

    for (let j = totalShards; j < previousShardCount; j++) {
      const oldId = `SHARD_${String(j + 1).padStart(3, '0')}`;
      batch.delete(adminDb.collection('employee_shards').doc(oldId));
    }

    await batch.commit();
    return { cloudSynced: true, shardsWritten: totalShards };
  }

  async getUserByEmail(email: string): Promise<WcrUser | null> {
    const clean = email.toLowerCase().trim();
    if (DEFAULT_WCR_USERS[clean]) return DEFAULT_WCR_USERS[clean];
    try {
      const snap = await adminDb.collection('users').doc(clean).get();
      return snap.exists ? (snap.data() as WcrUser) : null;
    } catch {
      return null;
    }
  }

  async getDepots(actor: WcrUser): Promise<DepotMaster[]> {
    if (actor.role_code === 'HQ_ADMIN' || actor.assigned_division === 'ALL') {
      return WCR_DEPOTS_SEED;
    }
    if (actor.assigned_depot_id && actor.assigned_depot_id !== 'ALL') {
      return WCR_DEPOTS_SEED.filter((d) => d.depot_id === actor.assigned_depot_id);
    }
    return WCR_DEPOTS_SEED.filter((d) => d.division_code === actor.assigned_division);
  }

  async getEmployees(actor: WcrUser): Promise<EmployeeMaster[]> {
    const { employees } = await this.readAllEmployeeShards();
    return this.filterEmployeeScope(employees, actor);
  }

  async upsertEmployee(actor: WcrUser, emp: EmployeeMaster): Promise<EmployeeMaster> {
    const { employees, shardCount } = await this.readAllEmployeeShards();
    const nowIso = new Date().toISOString();
    const idx = employees.findIndex((e) => e.emp_no === emp.emp_no);
    const prev = idx >= 0 ? employees[idx] : null;

    const record: EmployeeMaster = {
      ...emp,
      created_by: prev?.created_by || actor.email,
      created_at: prev?.created_at || nowIso,
      modified_by: actor.email,
      modified_at: nowIso,
    };

    if (idx >= 0) employees[idx] = record;
    else employees.push(record);

    await this.writeAllEmployeeShards(employees, shardCount);
    return record;
  }

  async bulkUpsertEmployees(
    actor: WcrUser,
    list: Partial<EmployeeMaster>[],
    feedType:
      | 'MERGED_MULTI_FEED'
      | 'CMS_PARTICULARS'
      | 'PME_DUE'
      | 'CLI_MASTER'
      | 'LI_GRADING'
      | 'DRAFTED_CREW' = 'MERGED_MULTI_FEED'
  ): Promise<{ inserted: number; updated: number; cloudSynced: boolean; shardsWritten: number }> {
    let inserted = 0;
    let updated = 0;
    const nowIso = new Date().toISOString();

    const { employees: existingList, shardCount } = await this.readAllEmployeeShards();
    const byEmpNo = new Map<string, EmployeeMaster>();
    const byCrewId = new Map<string, string>();

    for (const emp of existingList) {
      byEmpNo.set(emp.emp_no, emp);
      if (emp.crew_id) {
        byCrewId.set(String(emp.crew_id).trim().toUpperCase(), emp.emp_no);
      }
    }

    for (const rawItem of list) {
      const cleanCrewId = String(rawItem.crew_id || '').trim().toUpperCase();
      const cleanEmpNo = String(rawItem.emp_no || '').trim();
      const matchedEmpKey =
        (cleanEmpNo && byEmpNo.has(cleanEmpNo) ? cleanEmpNo : undefined) ||
        (cleanCrewId ? byCrewId.get(cleanCrewId) : undefined);

      const prev = matchedEmpKey ? byEmpNo.get(matchedEmpKey) : undefined;
      const targetEmpNo = cleanEmpNo || prev?.emp_no || cleanCrewId;
      if (!targetEmpNo) continue;

      if (prev && prev.emp_no !== targetEmpNo && prev.emp_no === cleanCrewId) {
        byEmpNo.delete(prev.emp_no);
      }

      if (prev) {
        updated++;
        const merged: EmployeeMaster = {
          ...prev,
          ...Object.fromEntries(
            Object.entries(rawItem).filter(([, v]) => v !== undefined && v !== null && v !== '')
          ),
          emp_no: targetEmpNo,
          crew_id: cleanCrewId || prev.crew_id || targetEmpNo,
          nominated_cli_id: rawItem.nominated_cli_id || prev.nominated_cli_id || '',
          nominated_cli_name: rawItem.nominated_cli_name || prev.nominated_cli_name || '',
          employment_status:
            feedType === 'DRAFTED_CREW' || rawItem.employment_status === 'Drafted'
              ? 'Drafted'
              : rawItem.employment_status || prev.employment_status || 'Active',
          created_by: prev.created_by || actor.email,
          created_at: prev.created_at || nowIso,
          modified_by: actor.email,
          modified_at: nowIso,
        };
        byEmpNo.set(targetEmpNo, merged);
        if (merged.crew_id) byCrewId.set(merged.crew_id.toUpperCase(), targetEmpNo);
      } else {
        inserted++;
        const created: EmployeeMaster = {
          emp_no: targetEmpNo,
          crew_id: cleanCrewId || targetEmpNo,
          employee_name: rawItem.employee_name || `Crew ${targetEmpNo}`,
          division_code: rawItem.division_code || 'JBP',
          depot_id: rawItem.depot_id || 'DEP_JBP_JBP',
          current_station: rawItem.current_station || 'JBP',
          designation_code: rawItem.designation_code || 'ALP',
          cadre_code: rawItem.cadre_code || 'E',
          pay_level: rawItem.pay_level || 'Level-6',
          dob: rawItem.dob || '1985-01-01',
          date_of_appointment: rawItem.date_of_appointment || '2010-01-01',
          retirement_date: rawItem.retirement_date || '2045-01-31',
          pme_due_date: rawItem.pme_due_date || new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
          employment_status:
            feedType === 'DRAFTED_CREW' || rawItem.employment_status === 'Drafted' ? 'Drafted' : 'Active',
          ...(rawItem.nominated_cli_id ? { nominated_cli_id: rawItem.nominated_cli_id } : {}),
          ...(rawItem.nominated_cli_name ? { nominated_cli_name: rawItem.nominated_cli_name } : {}),
          ...(rawItem.cli_allotted_date ? { cli_allotted_date: rawItem.cli_allotted_date } : {}),
          ...(rawItem.current_grade ? { current_grade: rawItem.current_grade } : {}),
          ...(rawItem.mobile_no ? { mobile_no: rawItem.mobile_no } : {}),
          created_by: actor.email,
          created_at: nowIso,
          modified_by: actor.email,
          modified_at: nowIso,
        };
        byEmpNo.set(targetEmpNo, created);
        if (created.crew_id) byCrewId.set(created.crew_id.toUpperCase(), targetEmpNo);
      }
    }

    const finalList = Array.from(byEmpNo.values());
    const writeRes = await this.writeAllEmployeeShards(finalList, shardCount);

    return {
      inserted,
      updated,
      cloudSynced: writeRes.cloudSynced,
      shardsWritten: writeRes.shardsWritten,
    };
  }

  async rebalanceAllLobbiesByCrewId(actor: WcrUser): Promise<{ updatedCount: number }> {
    const { employees, shardCount } = await this.readAllEmployeeShards();
    let updatedCount = 0;

    const updatedList = employees.map((d) => {
      const hqHint = d.designation_code === 'CLI' ? d.current_station : '';
      const loc = resolveLobbyFromCrewId(d.crew_id, hqHint, d.division_code || 'JBP');
      if (d.depot_id !== loc.depot_id || d.division_code !== loc.division_code) {
        updatedCount++;
        return {
          ...d,
          division_code: loc.division_code,
          depot_id: loc.depot_id,
          current_station: loc.depot_code,
          modified_by: actor.email,
          modified_at: new Date().toISOString(),
        };
      }
      return d;
    });

    await this.writeAllEmployeeShards(updatedList, shardCount);
    return { updatedCount };
  }

  async getSanctionedStrength(actor: WcrUser): Promise<SanctionedStrength[]> {
    let allRecords: SanctionedStrength[] = [];
    try {
      const stateDoc = await adminDb.collection('system_state').doc('current_sanctioned_strength').get();
      if (stateDoc.exists && Array.isArray(stateDoc.data()?.items)) {
        allRecords = stateDoc.data()!.items as SanctionedStrength[];
      } else {
        const snap = await adminDb.collection('sanctioned_strength').where('is_current', '==', true).get();
        allRecords = snap.docs.map((d) => d.data() as SanctionedStrength);
      }
    } catch {
      // Fallback to bundled Vercel snapshot
    }

    if (allRecords.length === 0 && Array.isArray(snapshotData.ssRecords)) {
      allRecords = snapshotData.ssRecords;
    }

    const currentOnly = allRecords.filter((r) => r.is_current);
    if (actor.role_code === 'HQ_ADMIN' || actor.assigned_division === 'ALL') return currentOnly;
    if (actor.assigned_depot_id && actor.assigned_depot_id !== 'ALL') {
      return currentOnly.filter((r) => r.depot_id === actor.assigned_depot_id);
    }
    return currentOnly.filter((r) => r.division_code === actor.assigned_division);
  }

  async bulkUpdateSanctionedStrength(
    actor: WcrUser,
    entries: {
      division_code: 'JBP' | 'BPL' | 'KOTA';
      depot_id: string;
      designation_code: 'ALP' | 'LPS' | 'LPG' | 'LPP' | 'LPM' | 'CLI';
      new_ss: number;
    }[],
    meta: { order_no: string; order_date: string; effective_date: string; remarks?: string }
  ): Promise<{ updatedCount: number; cloudSynced: boolean }> {
    const nowIso = new Date().toISOString();
    const existingAll = await this.getSanctionedStrength({
      ...actor,
      role_code: 'HQ_ADMIN',
      assigned_division: 'ALL',
      assigned_depot_id: 'ALL',
    });

    const mapByKey = new Map<string, SanctionedStrength>();
    for (const r of existingAll) {
      mapByKey.set(`${r.division_code}_${r.depot_id}_${r.designation_code}`, r);
    }

    const historyArchive: SanctionedStrength[] = [];

    for (const item of entries) {
      const key = `${item.division_code}_${item.depot_id}_${item.designation_code}`;
      const prev = mapByKey.get(key);
      const prevVal = prev ? prev.new_ss : 0;

      if (prev) {
        historyArchive.push({ ...prev, is_current: false });
      }

      mapByKey.set(key, {
        ss_record_id: `SS_${item.depot_id}_${item.designation_code}_${Date.now()}`,
        division_code: item.division_code,
        depot_id: item.depot_id,
        designation_code: item.designation_code,
        previous_ss: prevVal,
        new_ss: Number(item.new_ss) || 0,
        order_no: meta.order_no,
        order_date: meta.order_date,
        effective_date: meta.effective_date,
        is_current: true,
        remarks: meta.remarks || 'Imported from WCR Depot-wise Cadre Sheet',
        changed_by: actor.email,
        changed_at: nowIso,
      });
    }

    const updatedCurrent = Array.from(mapByKey.values());
    const batch = adminDb.batch();
    batch.set(adminDb.collection('system_state').doc('current_sanctioned_strength'), {
      updated_at: nowIso,
      order_no: meta.order_no,
      effective_date: meta.effective_date,
      count: updatedCurrent.length,
      items: updatedCurrent,
    });
    if (historyArchive.length > 0) {
      batch.set(adminDb.collection('ss_history_archive').doc(`HIST_${Date.now()}`), {
        archived_at: nowIso,
        changed_by: actor.email,
        order_no: meta.order_no,
        previous_records: historyArchive,
      });
    }
    await batch.commit();

    return { updatedCount: entries.length, cloudSynced: true };
  }

  async updateSanctionedStrength(
    actor: WcrUser,
    payload: Omit<SanctionedStrength, 'ss_record_id' | 'previous_ss' | 'is_current' | 'changed_by' | 'changed_at'>
  ): Promise<SanctionedStrength> {
    await this.bulkUpdateSanctionedStrength(
      actor,
      [
        {
          division_code: payload.division_code,
          depot_id: payload.depot_id,
          designation_code: payload.designation_code as any,
          new_ss: payload.new_ss,
        },
      ],
      {
        order_no: payload.order_no,
        order_date: payload.order_date,
        effective_date: payload.effective_date,
        remarks: payload.remarks,
      }
    );
    const updated = await this.getSanctionedStrength(actor);
    return updated.find(
      (u) => u.depot_id === payload.depot_id && u.designation_code === payload.designation_code
    )!;
  }

  async recordPromotion(
    actor: WcrUser,
    payload: Omit<PromotionHistory, 'promo_id' | 'entered_by' | 'entered_at'>
  ): Promise<PromotionHistory> {
    const check = validatePromotionChannel(actor, payload.previous_designation, payload.new_designation);
    if (!check.allowed) throw new Error(check.message);

    const promoRef = adminDb.collection('promotion_history').doc();
    const promo: PromotionHistory = {
      ...payload,
      promo_id: promoRef.id,
      is_channel_exception: check.isChannelException,
      entered_by: actor.email,
      entered_at: new Date().toISOString(),
    };
    await promoRef.set(promo);

    const { employees, shardCount } = await this.readAllEmployeeShards();
    const updatedList = employees.map((e) =>
      e.emp_no === payload.emp_no
        ? {
            ...e,
            designation_code: payload.new_designation,
            cadre_code: payload.new_cadre,
            pay_level: payload.new_pay_level,
            date_of_promotion: payload.effective_date,
            modified_by: actor.email,
            modified_at: new Date().toISOString(),
          }
        : e
    );
    await this.writeAllEmployeeShards(updatedList, shardCount);
    return promo;
  }

  async recordDraftingOut(
    actor: WcrUser,
    payload: Omit<DraftingHistory, 'drafting_id' | 'drafting_status' | 'entered_by' | 'entered_at'>
  ): Promise<DraftingHistory> {
    const ref = adminDb.collection('drafting_history').doc();
    const rec: DraftingHistory = {
      ...payload,
      drafting_id: ref.id,
      approved_duration_months: payload.approved_duration_months || 36,
      drafting_status: 'ON_DRAFTING',
      entered_by: actor.email,
      entered_at: new Date().toISOString(),
    };
    await ref.set(rec);

    const { employees, shardCount } = await this.readAllEmployeeShards();
    const updatedList = employees.map((e) =>
      e.emp_no === payload.emp_no ? { ...e, employment_status: 'Drafted' as const } : e
    );
    await this.writeAllEmployeeShards(updatedList, shardCount);
    return rec;
  }

  async recordDraftingReturn(
    actor: WcrUser,
    draftingId: string,
    returnOrderNo: string,
    actualReturnDate: string,
    overrideDepotId?: string
  ): Promise<DraftingHistory> {
    const ref = adminDb.collection('drafting_history').doc(draftingId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Drafting record not found');
    const draft = snap.data() as DraftingHistory;
    const targetDepot = overrideDepotId || draft.original_depot_id;

    await ref.update({
      drafting_status: 'RETURNED',
      actual_return_date: actualReturnDate,
      return_order_no: returnOrderNo,
    });

    const { employees, shardCount } = await this.readAllEmployeeShards();
    const updatedList = employees.map((e) =>
      e.emp_no === draft.emp_no
        ? {
            ...e,
            employment_status: 'Active' as const,
            designation_code: draft.original_designation,
            depot_id: targetDepot,
          }
        : e
    );
    await this.writeAllEmployeeShards(updatedList, shardCount);
    return { ...draft, drafting_status: 'RETURNED', actual_return_date: actualReturnDate, return_order_no: returnOrderNo };
  }

  async recordTransfer(
    actor: WcrUser,
    payload: Omit<TransferHistory, 'transfer_id' | 'entered_by' | 'entered_at'>
  ): Promise<TransferHistory> {
    const check = validateTransferPermission(actor, payload.previous_division, payload.new_division);
    if (!check.allowed) throw new Error(check.message);

    const ref = adminDb.collection('transfer_history').doc();
    const tx: TransferHistory = {
      ...payload,
      transfer_id: ref.id,
      entered_by: actor.email,
      entered_at: new Date().toISOString(),
    };
    await ref.set(tx);

    const { employees, shardCount } = await this.readAllEmployeeShards();
    const updatedList = employees.map((e) =>
      e.emp_no === payload.emp_no
        ? {
            ...e,
            division_code: payload.new_division,
            depot_id: payload.new_depot_id,
            designation_code: payload.new_designation,
            date_of_joining_depot: payload.effective_date,
          }
        : e
    );
    await this.writeAllEmployeeShards(updatedList, shardCount);
    return tx;
  }

  async markEmployeeRetired(actor: WcrUser, empNo: string, retirementOrderNo: string): Promise<EmployeeMaster> {
    const { employees, shardCount } = await this.readAllEmployeeShards();
    const target = employees.find((e) => e.emp_no === empNo);
    if (!target) throw new Error(`Employee ${empNo} not found`);

    const updatedEmp: EmployeeMaster = {
      ...target,
      employment_status: 'Retired',
      modified_by: actor.email,
      modified_at: new Date().toISOString(),
    };

    const updatedList = employees.map((e) => (e.emp_no === empNo ? updatedEmp : e));
    await this.writeAllEmployeeShards(updatedList, shardCount);

    await this.appendAuditLog({
      user_email: actor.email,
      user_role: actor.role_code,
      division_code: target.division_code,
      depot_id: target.depot_id,
      operation: 'MARK_RETIRED',
      record_type: 'employee_master',
      record_id: empNo,
      remarks: `Order ${retirementOrderNo}`,
    });

    return updatedEmp;
  }

  async getPromotions(actor: WcrUser): Promise<PromotionHistory[]> {
    const snap = await this.scopeQuery(adminDb.collection('promotion_history'), actor).get();
    return snap.docs.map((d) => d.data() as PromotionHistory);
  }

  async getDraftings(actor: WcrUser): Promise<DraftingHistory[]> {
    const snap = await this.scopeQuery(
      adminDb.collection('drafting_history'),
      actor,
      'original_division',
      'original_depot_id'
    ).get();
    return snap.docs.map((d) => d.data() as DraftingHistory);
  }

  async getTransfers(): Promise<TransferHistory[]> {
    const snap = await adminDb.collection('transfer_history').get();
    return snap.docs.map((d) => d.data() as TransferHistory);
  }

  async getServiceHistory(empNo: string): Promise<ServiceHistory[]> {
    const snap = await adminDb.collection('service_history').where('emp_no', '==', empNo).get();
    return snap.docs.map((d) => d.data() as ServiceHistory);
  }

  async getAuditLogs(actor: WcrUser): Promise<AuditLog[]> {
    const q =
      actor.role_code === 'HQ_ADMIN'
        ? adminDb.collection('audit_log').orderBy('timestamp', 'desc').limit(100)
        : adminDb.collection('audit_log').where('division_code', '==', actor.assigned_division).limit(100);
    const snap = await q.get();
    return snap.docs.map((d) => d.data() as AuditLog);
  }

  async appendAuditLog(entry: Omit<AuditLog, 'log_id' | 'timestamp'>): Promise<void> {
    try {
      const ref = adminDb.collection('audit_log').doc();
      await ref.set({ ...entry, log_id: ref.id, timestamp: new Date().toISOString() });
    } catch {
      // Non-blocking audit log
    }
  }

  async uploadOrderDocument(fileName: string, content: Uint8Array, contentType: string): Promise<string> {
    const bucket = adminStorage.bucket();
    const path = `${SYSTEM_BRANDING.storageBucket}/orders/${Date.now()}_${fileName}`;
    await bucket.file(path).save(Buffer.from(content), { contentType });
    return path;
  }

  async deleteRawUploadedFile(storagePath: string): Promise<void> {
    await adminStorage.bucket().file(storagePath).delete({ ignoreNotFound: true });
  }
}

export const firebaseRepo = new FirebaseWcrRepository();