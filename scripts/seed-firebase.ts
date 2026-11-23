import { adminDb } from '../src/lib/firebase-admin';
import {
  WCR_CADRES_SEED,
  WCR_DEPOTS_SEED,
  WCR_DESIGNATIONS_SEED,
} from '../src/lib/wcr-constants';
import { EmployeeMaster, SanctionedStrength, WcrUser } from '../src/types/wcr';

async function seedFirebaseWcrEms() {
  console.log('🚂 Seeding WCR EMS Master Data into Firebase Firestore...');

  // 1. Seed 4 Cadres
  const cadreBatch = adminDb.batch();
  for (const c of WCR_CADRES_SEED) {
    cadreBatch.set(adminDb.collection('cadre_master').doc(c.cadre_code), c, { merge: true });
  }
  await cadreBatch.commit();
  console.log('✅ Seeded 4 Cadres (E, M, D, LOCO_INSP)');

  // 2. Seed 9 Designations
  const desigBatch = adminDb.batch();
  for (const d of WCR_DESIGNATIONS_SEED) {
    desigBatch.set(adminDb.collection('designation_master').doc(d.designation_code), d, { merge: true });
  }
  await desigBatch.commit();
  console.log('✅ Seeded 9 Designations (ALP -> CLI)');

  // 3. Seed All 20 WCR Depots / Lobbies
  const depotBatch = adminDb.batch();
  for (const dep of WCR_DEPOTS_SEED) {
    depotBatch.set(adminDb.collection('depot_master').doc(dep.depot_id), dep, { merge: true });
  }
  await depotBatch.commit();
  console.log('✅ Seeded All 20 WCR Depots (KOTA: 5, BPL: 4, JBP: 11)');

  // 4. Seed RBAC Admin Users (HQ_ADMIN, DIVISION_ADMIN, DEPOT_ADMIN)
  const users: WcrUser[] = [
    {
      user_id: 'USR_HQ_01',
      email: 'cli-jbp@wcr.railnet.gov.in',
      auth_mode: 'SSO',
      full_name: 'A K Bajpai',
      designation: 'Chief Loco Inspector (CLI)',
      role_code: 'HQ_ADMIN',
      assigned_division: 'ALL',
      assigned_depot_id: 'ALL',
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      user_id: 'USR_JBP_01',
      email: 'div-jbp@wcr.railnet.gov.in',
      auth_mode: 'EMAIL_OTP',
      full_name: 'Senior DEE (TRO) Jabalpur',
      designation: 'Sr. DEE (TRO)',
      role_code: 'DIVISION_ADMIN',
      assigned_division: 'JBP',
      assigned_depot_id: 'ALL',
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      user_id: 'USR_BPL_01',
      email: 'div-bpl@wcr.railnet.gov.in',
      auth_mode: 'EMAIL_OTP',
      full_name: 'Senior DEE (TRO) Bhopal',
      designation: 'Sr. DEE (TRO)',
      role_code: 'DIVISION_ADMIN',
      assigned_division: 'BPL',
      assigned_depot_id: 'ALL',
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      user_id: 'USR_KOTA_01',
      email: 'div-kota@wcr.railnet.gov.in',
      auth_mode: 'EMAIL_OTP',
      full_name: 'Senior DEE (TRO) Kota',
      designation: 'Sr. DEE (TRO)',
      role_code: 'DIVISION_ADMIN',
      assigned_division: 'KOTA',
      assigned_depot_id: 'ALL',
      is_active: true,
      created_at: new Date().toISOString(),
    },
  ];
  const userBatch = adminDb.batch();
  for (const u of users) {
    userBatch.set(adminDb.collection('users').doc(u.email), u, { merge: true });
  }
  await userBatch.commit();
  console.log('✅ Seeded RBAC Admin Users (HQ_ADMIN & Division Admins)');

  // 5. Seed Initial Sanctioned Strength & Sample Crew Biodata
  const sampleEmployees: EmployeeMaster[] = [
    {
      emp_no: '01425891',
      crew_id: 'JBP2425',
      employee_name: 'Ramesh Kumar Tiwari',
      division_code: 'JBP',
      depot_id: 'DEP_JBP_JBP',
      current_station: 'JBP',
      designation_code: 'LPM',
      cadre_code: 'E',
      pay_level: 'Level-6',
      dob: '1968-08-15',
      date_of_appointment: '1994-03-10',
      retirement_date: '2028-08-31',
      pme_due_date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
      employment_status: 'Active',
      created_by: 'cli-jbp@wcr.railnet.gov.in',
      created_at: new Date().toISOString(),
    },
    {
      emp_no: '01598234',
      crew_id: 'NKJ1804',
      employee_name: 'Suresh Singh Patel',
      division_code: 'JBP',
      depot_id: 'DEP_JBP_NKJ',
      current_station: 'NKJ',
      designation_code: 'LPG',
      cadre_code: 'E',
      pay_level: 'Level-6',
      dob: '1979-04-20',
      date_of_appointment: '2005-07-12',
      retirement_date: '2039-04-30',
      pme_due_date: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10),
      employment_status: 'Drafted',
      created_by: 'cli-jbp@wcr.railnet.gov.in',
      created_at: new Date().toISOString(),
    },
    {
      emp_no: '02349102',
      crew_id: 'BINA1107',
      employee_name: 'Mahendra Prasad Sharma',
      division_code: 'BPL',
      depot_id: 'DEP_BPL_BINA',
      current_station: 'BINA',
      designation_code: 'LPP',
      cadre_code: 'E',
      pay_level: 'Level-6',
      dob: '1974-11-11',
      date_of_appointment: '2000-02-18',
      retirement_date: '2034-11-30',
      pme_due_date: new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10),
      employment_status: 'Active',
      created_by: 'div-bpl@wcr.railnet.gov.in',
      created_at: new Date().toISOString(),
    },
    {
      emp_no: '03119870',
      crew_id: 'KOTA3091',
      employee_name: 'Dinesh Chand Meena',
      division_code: 'KOTA',
      depot_id: 'DEP_KOTA_KOTA',
      current_station: 'KOTA',
      designation_code: 'SALP',
      cadre_code: 'E',
      pay_level: 'Level-4',
      dob: '1988-06-05',
      date_of_appointment: '2014-09-01',
      retirement_date: '2048-06-30',
      pme_due_date: new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10),
      employment_status: 'Active',
      created_by: 'div-kota@wcr.railnet.gov.in',
      created_at: new Date().toISOString(),
    },
  ];

  const empBatch = adminDb.batch();
  for (const e of sampleEmployees) {
    empBatch.set(adminDb.collection('employee_master').doc(e.emp_no), e, { merge: true });
  }
  await empBatch.commit();

  const sampleSS: SanctionedStrength[] = [
    { ss_record_id: 'SS_JBP_LPM', division_code: 'JBP', depot_id: 'DEP_JBP_JBP', designation_code: 'LPM', previous_ss: 0, new_ss: 45, order_no: 'WCR/P-HQ/CADRE/2026/01', order_date: '2026-01-01', effective_date: '2026-01-01', is_current: true, changed_by: 'cli-jbp@wcr.railnet.gov.in', changed_at: new Date().toISOString() },
    { ss_record_id: 'SS_NKJ_LPG', division_code: 'JBP', depot_id: 'DEP_JBP_NKJ', designation_code: 'LPG', previous_ss: 0, new_ss: 120, order_no: 'WCR/P-HQ/CADRE/2026/01', order_date: '2026-01-01', effective_date: '2026-01-01', is_current: true, changed_by: 'cli-jbp@wcr.railnet.gov.in', changed_at: new Date().toISOString() },
    { ss_record_id: 'SS_BINA_LPP', division_code: 'BPL', depot_id: 'DEP_BPL_BINA', designation_code: 'LPP', previous_ss: 0, new_ss: 60, order_no: 'WCR/P-HQ/CADRE/2026/01', order_date: '2026-01-01', effective_date: '2026-01-01', is_current: true, changed_by: 'cli-jbp@wcr.railnet.gov.in', changed_at: new Date().toISOString() },
    { ss_record_id: 'SS_KOTA_ALP', division_code: 'KOTA', depot_id: 'DEP_KOTA_KOTA', designation_code: 'ALP', previous_ss: 0, new_ss: 150, order_no: 'WCR/P-HQ/CADRE/2026/01', order_date: '2026-01-01', effective_date: '2026-01-01', is_current: true, changed_by: 'cli-jbp@wcr.railnet.gov.in', changed_at: new Date().toISOString() },
  ];
  const ssBatch = adminDb.batch();
  for (const s of sampleSS) {
    ssBatch.set(adminDb.collection('sanctioned_strength').doc(s.ss_record_id), s, { merge: true });
  }
  await ssBatch.commit();

  console.log('🎉 Firebase Firestore Seeding Completed Successfully!');
  process.exit(0);
}

seedFirebaseWcrEms().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
