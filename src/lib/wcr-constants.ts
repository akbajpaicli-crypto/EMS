import { DepotMaster, DesignationCode, PostGroup } from '@/types/wcr';

export const SYSTEM_BRANDING = {
  primaryHeader: 'WCR EMS — West Central Railway (Jabalpur • Bhopal • Kota Divisions)',
  hindiTitle: 'पश्चिम मध्य रेल कर्मचारी एवं कैडर प्रबंधन प्रणाली',
  developerAttribution: 'Developed by A K Bajpai, Chief Loco Inspector (CLI), Jabalpur Division, West Central Railway',
  hindiFooter: 'ए के बाजपेयी, मू. लो. नि., जबलपुर (पश्चिम मध्य रेल)',
  storageBucket: 'wcr-order-docs',
} as const;

export const POST_GROUPS: PostGroup[] = ['ALP', 'LPS', 'LPG', 'LPP', 'LPM', 'ALL LP', 'CLI'];

export const PROMOTION_CHANNEL_ORDER: Record<DesignationCode, number> = {
  ALP: 1,
  SALP: 2,
  LPS: 3,
  SHT: 4,
  SSHT: 5,
  LPG: 6,
  LPP: 7,
  LPM: 8,
  CLI: 9,
};

export const WCR_CADRES_SEED = [
  { cadre_code: 'E', cadre_name: 'Electrical (TRD/TRS/TRO)', division_scope: 'WCR', status: 'Active' },
  { cadre_code: 'M', cadre_name: 'Mechanical (Diesel/C&W)', division_scope: 'WCR', status: 'Active' },
  { cadre_code: 'D', cadre_name: 'Diesel Traction', division_scope: 'WCR', status: 'Active' },
  { cadre_code: 'LOCO_INSP', cadre_name: 'Chief Loco Inspector Cadre', division_scope: 'WCR', status: 'Active' },
];

export const WCR_DESIGNATIONS_SEED = [
  { designation_code: 'ALP', designation_name: 'Assistant Loco Pilot', reporting_group: 'ALP', channel_order: 1, cadre_code: 'E', pay_level: 'Level-2', division_scope: 'WCR', status: 'Active' },
  { designation_code: 'SALP', designation_name: 'Senior Assistant Loco Pilot', reporting_group: 'ALP', channel_order: 2, cadre_code: 'E', pay_level: 'Level-4', division_scope: 'WCR', status: 'Active' },
  { designation_code: 'LPS', designation_name: 'Loco Pilot (Shunting) Gr-II', reporting_group: 'LPS', channel_order: 3, cadre_code: 'E', pay_level: 'Level-4', division_scope: 'WCR', status: 'Active' },
  { designation_code: 'SHT', designation_name: 'Shunter', reporting_group: 'LPS', channel_order: 4, cadre_code: 'E', pay_level: 'Level-4', division_scope: 'WCR', status: 'Active' },
  { designation_code: 'SSHT', designation_name: 'Senior Shunter / LPS Gr-I', reporting_group: 'LPS', channel_order: 5, cadre_code: 'E', pay_level: 'Level-6', division_scope: 'WCR', status: 'Active' },
  { designation_code: 'LPG', designation_name: 'Loco Pilot (Goods)', reporting_group: 'LPG', channel_order: 6, cadre_code: 'E', pay_level: 'Level-6', division_scope: 'WCR', status: 'Active' },
  { designation_code: 'LPP', designation_name: 'Loco Pilot (Passenger)', reporting_group: 'LPP', channel_order: 7, cadre_code: 'E', pay_level: 'Level-6', division_scope: 'WCR', status: 'Active' },
  { designation_code: 'LPM', designation_name: 'Loco Pilot (Mail/Express)', reporting_group: 'LPM', channel_order: 8, cadre_code: 'E', pay_level: 'Level-6', division_scope: 'WCR', status: 'Active' },
  { designation_code: 'CLI', designation_name: 'Chief Loco Inspector', reporting_group: 'CLI', channel_order: 9, cadre_code: 'LOCO_INSP', pay_level: 'Level-7', division_scope: 'WCR', status: 'Active' },
];

// All 20 WCR Depots / Lobbies (KOTA: 5, BPL: 4, JBP: 11)
export const WCR_DEPOTS_SEED: DepotMaster[] = [
  // KOTA (5)
  { depot_id: 'DEP_KOTA_KOTA', depot_code: 'KOTA', depot_name: 'Kota Crew Lobby', division_code: 'KOTA', location: 'Kota Junction, Rajasthan', status: 'Active', effective_date: '2020-01-01' },
  { depot_id: 'DEP_KOTA_GGC',  depot_code: 'GGC',  depot_name: 'Gangapur City Lobby', division_code: 'KOTA', location: 'Gangapur City, Rajasthan', status: 'Active', effective_date: '2020-01-01' },
  { depot_id: 'DEP_KOTA_BXN',  depot_code: 'BXN',  depot_name: 'Bayana Crew Lobby', division_code: 'KOTA', location: 'Bayana Junction, Rajasthan', status: 'Active', effective_date: '2020-01-01' },
  { depot_id: 'DEP_KOTA_SWM',  depot_code: 'SWM',  depot_name: 'Sawai Madhopur Lobby', division_code: 'KOTA', location: 'Sawai Madhopur, Rajasthan', status: 'Active', effective_date: '2020-01-01' },
  { depot_id: 'DEP_KOTA_MTPC', depot_code: 'MTPC', depot_name: 'Malakheda / Multi-Traction Crew Point', division_code: 'KOTA', location: 'Kota Division', status: 'Active', effective_date: '2020-01-01' },
  // BPL (4)
  { depot_id: 'DEP_BPL_BINA',  depot_code: 'BINA', depot_name: 'Bina Crew Lobby', division_code: 'BPL', location: 'Bina Junction, MP', status: 'Active', effective_date: '2020-01-01' },
  { depot_id: 'DEP_BPL_BPL',   depot_code: 'BPL',  depot_name: 'Bhopal Crew Lobby', division_code: 'BPL', location: 'Bhopal Junction, MP', status: 'Active', effective_date: '2020-01-01' },
  { depot_id: 'DEP_BPL_ET',    depot_code: 'ET',   depot_name: 'Itarsi Crew Lobby', division_code: 'BPL', location: 'Itarsi Junction, MP', status: 'Active', effective_date: '2020-01-01' },
  { depot_id: 'DEP_BPL_GUNA',  depot_code: 'GUNA', depot_name: 'Guna Crew Lobby', division_code: 'BPL', location: 'Guna Junction, MP', status: 'Active', effective_date: '2020-01-01' },
  // JBP (11)
  { depot_id: 'DEP_JBP_JBP',   depot_code: 'JBP',  depot_name: 'Jabalpur Crew Lobby', division_code: 'JBP', location: 'Jabalpur Junction, MP', status: 'Active', effective_date: '2020-01-01' },
  { depot_id: 'DEP_JBP_NKJ',   depot_code: 'NKJ',  depot_name: 'New Katni Junction Lobby', division_code: 'JBP', location: 'New Katni Junction, MP', status: 'Active', effective_date: '2020-01-01' },
  { depot_id: 'DEP_JBP_STA',   depot_code: 'STA',  depot_name: 'Satna Crew Lobby', division_code: 'JBP', location: 'Satna Junction, MP', status: 'Active', effective_date: '2020-01-01' },
  { depot_id: 'DEP_JBP_SGO',   depot_code: 'SGO',  depot_name: 'Saugor Crew Lobby', division_code: 'JBP', location: 'Saugor, MP', status: 'Active', effective_date: '2020-01-01' },
  { depot_id: 'DEP_JBP_BEHR',  depot_code: 'BEHR', depot_name: 'Beohari Crew Lobby', division_code: 'JBP', location: 'Beohari, MP', status: 'Active', effective_date: '2020-01-01' },
  { depot_id: 'DEP_JBP_JKE',   depot_code: 'JKE',  depot_name: 'Jukehi Crew Lobby', division_code: 'JBP', location: 'Jukehi, MP', status: 'Active', effective_date: '2020-01-01' },
  { depot_id: 'DEP_JBP_BRGW',  depot_code: 'BRGW', depot_name: 'Bargawan Crew Lobby', division_code: 'JBP', location: 'Bargawan, MP', status: 'Active', effective_date: '2020-01-01' },
  { depot_id: 'DEP_JBP_DMO',   depot_code: 'DMO',  depot_name: 'Damoh Crew Lobby', division_code: 'JBP', location: 'Damoh, MP', status: 'Active', effective_date: '2020-01-01' },
  { depot_id: 'DEP_JBP_REWA',  depot_code: 'REWA', depot_name: 'Rewa Crew Lobby', division_code: 'JBP', location: 'Rewa, MP', status: 'Active', effective_date: '2020-01-01' },
  { depot_id: 'DEP_JBP_MZHL',  depot_code: 'MZHL', depot_name: 'Majhgawan Crew Lobby', division_code: 'JBP', location: 'Majhgawan, MP', status: 'Active', effective_date: '2020-01-01' },
  { depot_id: 'DEP_JBP_BNJH',  depot_code: 'BNJH', depot_name: 'Bina-Katni / Bhanjhar Point', division_code: 'JBP', location: 'Jabalpur Division, MP', status: 'Active', effective_date: '2020-01-01' },
];

export const ADMINISTRATIVE_REPORTS = [
  { id: 1,  code: 'RPT_01', title: 'WCR Consolidated Cadre Position (ALP, LPS, LPG, LPP, LPM, ALL LP, CLI)', category: 'Cadre' },
  { id: 2,  code: 'RPT_02', title: 'Depot-wise Cadre Position Statement (All 20 Depots × SS, MOR, VAC, %)', category: 'Cadre' },
  { id: 3,  code: 'RPT_03', title: 'Crew PME Due & Overdue Report (3-Day Advance Window + Custom Days)', category: 'Medical & Safety' },
  { id: 4,  code: 'RPT_04', title: 'Employee Master Report (Complete Biodata incl. PME Due Date)', category: 'Nominal Roll' },
  { id: 5,  code: 'RPT_05', title: 'Division-wise Employee List', category: 'Nominal Roll' },
  { id: 6,  code: 'RPT_06', title: 'Depot-wise Employee List', category: 'Nominal Roll' },
  { id: 7,  code: 'RPT_07', title: 'Designation-wise Employee List', category: 'Nominal Roll' },
  { id: 8,  code: 'RPT_08', title: 'Drafted Employee Report', category: 'Drafting' },
  { id: 9,  code: 'RPT_09', title: 'Drafting Due / Overdue Return Report', category: 'Drafting' },
  { id: 10, code: 'RPT_10', title: 'Promotion History Report', category: 'Lifecycle' },
  { id: 11, code: 'RPT_11', title: 'Transfer History Report', category: 'Lifecycle' },
  { id: 12, code: 'RPT_12', title: 'Retirement Due Monitoring Report', category: 'Lifecycle' },
  { id: 13, code: 'RPT_13', title: 'Vacancy Report', category: 'Cadre' },
  { id: 14, code: 'RPT_14', title: 'Excess Manpower Report', category: 'Cadre' },
  { id: 15, code: 'RPT_15', title: 'Immutable System Audit Log Report', category: 'Governance' },
] as const;

const LOBBY_ALIAS_TO_DEPOT_ID: Record<string, string> = {
  // KOTA (5)
  KOTA: 'DEP_KOTA_KOTA',
  GGC: 'DEP_KOTA_GGC',
  BXN: 'DEP_KOTA_BXN',
  SWM: 'DEP_KOTA_SWM',
  MTPC: 'DEP_KOTA_MTPC',
  // BPL (4)
  BINA: 'DEP_BPL_BINA',
  BPL: 'DEP_BPL_BPL',
  ET: 'DEP_BPL_ET',
  GUNA: 'DEP_BPL_GUNA',
  // JBP (11 + KTE alias for Katni/NKJ)
  JBP: 'DEP_JBP_JBP',
  NKJ: 'DEP_JBP_NKJ',
  KTE: 'DEP_JBP_NKJ',
  STA: 'DEP_JBP_STA',
  SGO: 'DEP_JBP_SGO',
  BEHR: 'DEP_JBP_BEHR',
  JKE: 'DEP_JBP_JKE',
  BRGW: 'DEP_JBP_BRGW',
  DMO: 'DEP_JBP_DMO',
  REWA: 'DEP_JBP_REWA',
  MZHL: 'DEP_JBP_MZHL',
  BNJH: 'DEP_JBP_BNJH',
};

/**
 * Extracts leading alphabetic prefix from CREW ID (e.g. "GGC1035" -> "GGC", "NKJ1804" -> "NKJ")
 * and resolves exact WCR depot_id & division_code.
 */
export function resolveLobbyFromCrewId(
  crewId?: string,
  explicitHqOrDepot?: string,
  fallbackDivision: 'JBP' | 'BPL' | 'KOTA' = 'JBP'
) {
  const alphaPrefix =
    String(crewId || '')
      .trim()
      .toUpperCase()
      .match(/^([A-Z]+)/)?.[1] || '';

  const cleanHq = String(explicitHqOrDepot || '')
    .trim()
    .toUpperCase()
    .replace(/^DEP_[A-Z]+_/, '');

  const matchedDepotId =
    LOBBY_ALIAS_TO_DEPOT_ID[cleanHq] || LOBBY_ALIAS_TO_DEPOT_ID[alphaPrefix];

  if (matchedDepotId) {
    const depot = WCR_DEPOTS_SEED.find((d) => d.depot_id === matchedDepotId)!;
    return {
      division_code: depot.division_code,
      depot_id: depot.depot_id,
      depot_code: depot.depot_code,
    };
  }

  const fallbackDepot =
    WCR_DEPOTS_SEED.find((d) => d.division_code === fallbackDivision) || WCR_DEPOTS_SEED[9];
  return {
    division_code: fallbackDivision,
    depot_id: fallbackDepot.depot_id,
    depot_code: fallbackDepot.depot_code,
  };
}