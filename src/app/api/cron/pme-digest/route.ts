import { NextRequest, NextResponse } from 'next/server';
import { firebaseRepo } from '@/services/db/firebase.adapter';
import { evaluatePmeAlerts } from '@/lib/cadre-engine';
import { SYSTEM_BRANDING } from '@/lib/wcr-constants';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hqActor = {
    user_id: 'cron-system',
    email: 'cli-jbp@wcr.railnet.gov.in',
    auth_mode: 'SSO' as const,
    full_name: 'WCR Daily PME Scheduler',
    designation: 'SYSTEM',
    role_code: 'HQ_ADMIN' as const,
    assigned_division: 'ALL' as const,
    assigned_depot_id: 'ALL',
    is_active: true,
    created_at: new Date().toISOString(),
  };

  const employees = await firebaseRepo.getEmployees(hqActor);
  const alerts = evaluatePmeAlerts(employees);

  return NextResponse.json({
    provider: 'firebase',
    system: SYSTEM_BRANDING.primaryHeader,
    attribution: SYSTEM_BRANDING.developerAttribution,
    runAtIST: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    urgentOrOverdueCount: alerts.urgentOrOverdue.length,
    alerts: alerts.urgentOrOverdue,
  });
}
