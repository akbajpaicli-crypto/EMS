export type DivisionCode = 'JBP' | 'BPL' | 'KOTA';
export type RoleCode = 'HQ_ADMIN' | 'DIVISION_ADMIN' | 'DEPOT_ADMIN' | 'VIEWER';
export type AuthMode = 'SSO' | 'EMAIL_OTP' | 'TOTP';
export type DesignationCode = 'ALP' | 'SALP' | 'LPS' | 'SHT' | 'SSHT' | 'LPG' | 'LPP' | 'LPM' | 'CLI';
export type PostGroup = 'ALP' | 'LPS' | 'LPG' | 'LPP' | 'LPM' | 'ALL LP' | 'CLI';
export type CadreCode = 'E' | 'M' | 'D' | 'LOCO_INSP';
export type EmploymentStatus = 'Active' | 'Drafted' | 'Retired' | 'Transferred';
export type DraftingStatus = 'ON_DRAFTING' | 'EXTENDED' | 'RETURNED';
export type TransferType = 'INTRA_DIVISION' | 'INTER_DIVISION';

export interface WcrUser {
  user_id: string;
  email: string;
  auth_mode: AuthMode;
  full_name: string;
  designation: string;
  role_code: RoleCode;
  assigned_division: 'ALL' | DivisionCode;
  assigned_depot_id: 'ALL' | string;
  totp_secret?: string;
  is_active: boolean;
  last_login?: string;
  created_at: string;
}

export interface DepotMaster {
  depot_id: string;
  depot_code: string;
  depot_name: string;
  division_code: DivisionCode;
  location: string;
  status: 'Active' | 'Inactive';
  effective_date: string;
  remarks?: string;
}

export interface EmployeeMaster {
  nominated_cli_id?: string;
  nominated_cli_name?: string;
  cli_allotted_date?: string;
  current_grade?: string;
  emp_no: string;
  crew_id: string;
  employee_name: string;
  division_code: DivisionCode;
  depot_id: string;
  current_station: string;
  designation_code: DesignationCode;
  cadre_code: CadreCode;
  pay_level: string;
  present_pay?: number;
  dob: string;
  date_of_appointment: string;
  date_of_promotion?: string;
  next_increment_date?: string;
  retirement_date: string;
  pme_due_date: string;
  employment_status: EmploymentStatus;
  mobile_no?: string;
  email?: string;
  date_of_joining_depot?: string;
  remarks?: string;
  created_by: string;
  created_at: string;
  modified_by?: string;
  modified_at?: string;
}

export interface SanctionedStrength {
  ss_record_id: string;
  division_code: DivisionCode;
  depot_id: string;
  designation_code: DesignationCode;
  previous_ss: number;
  new_ss: number;
  order_no: string;
  order_date: string;
  effective_date: string;
  is_current: boolean;
  document_url?: string;
  remarks?: string;
  changed_by: string;
  changed_at: string;
}

export interface PromotionHistory {
  promo_id: string;
  emp_no: string;
  division_code: DivisionCode;
  depot_id: string;
  previous_designation: DesignationCode;
  new_designation: DesignationCode;
  previous_cadre: CadreCode;
  new_cadre: CadreCode;
  previous_pay_level: string;
  new_pay_level: string;
  promotion_order_no: string;
  promotion_order_date: string;
  effective_date: string;
  is_channel_exception: boolean;
  document_url?: string;
  remarks?: string;
  entered_by: string;
  entered_at: string;
}

export interface DraftingHistory {
  drafting_id: string;
  emp_no: string;
  employee_name: string;
  original_division: DivisionCode;
  original_depot_id: string;
  original_designation: DesignationCode;
  drafted_designation: string;
  drafted_location: string;
  drafting_order_no: string;
  drafting_order_date: string;
  drafting_start_date: string;
  approved_duration_months: number;
  expected_return_date: string;
  actual_return_date?: string;
  return_order_no?: string;
  drafting_status: DraftingStatus;
  document_url?: string;
  remarks?: string;
  entered_by: string;
  entered_at: string;
}

export interface TransferHistory {
  transfer_id: string;
  emp_no: string;
  transfer_type: TransferType;
  previous_division: DivisionCode;
  new_division: DivisionCode;
  previous_depot_id: string;
  new_depot_id: string;
  previous_designation: DesignationCode;
  new_designation: DesignationCode;
  transfer_order_no: string;
  order_date: string;
  effective_date: string;
  document_url?: string;
  remarks?: string;
  entered_by: string;
  entered_at: string;
}

export interface ServiceHistory {
  service_id: string;
  emp_no: string;
  event_type:
    | 'APPOINTMENT'
    | 'ONBOARDING'
    | 'PROMOTION'
    | 'DRAFTING_OUT'
    | 'DRAFTING_EXTEND'
    | 'DRAFTING_RETURN'
    | 'TRANSFER'
    | 'RETIREMENT';
  event_date: string;
  reference_id?: string;
  division_code: DivisionCode;
  depot_id: string;
  designation_code: DesignationCode;
  order_no?: string;
  description: string;
  entered_by: string;
  entered_at: string;
}

export interface AuditLog {
  log_id: string;
  timestamp: string;
  user_email: string;
  user_role: RoleCode;
  division_code?: string;
  depot_id?: string;
  operation: string;
  record_type: string;
  record_id: string;
  previous_value?: Record<string, unknown> | null;
  new_value?: Record<string, unknown> | null;
  remarks?: string;
}

export interface PostCadreMetrics {
  post: PostGroup;
  ss: number;
  mor: number;
  drafted: number;
  actualWorking: number;
  vac: number;
  excess: number;
  vacPercent: string;
}

export interface DepotCadreRow {
  depot_id: string;
  depot_code: string;
  depot_name: string;
  division_code: DivisionCode;
  posts: Record<PostGroup, PostCadreMetrics>;
  grandTotal: {
    ss: number;
    mor: number;
    drafted: number;
    actualWorking: number;
    vac: number;
    excess: number;
    vacPercent: string;
  };
}
