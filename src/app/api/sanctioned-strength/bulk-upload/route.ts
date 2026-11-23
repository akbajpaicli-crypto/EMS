import { NextRequest, NextResponse } from 'next/server';
import { firebaseRepo } from '@/services/db/firebase.adapter';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const actor = await firebaseRepo.getUserByEmail(body.actorEmail || 'cli-jbp@wcr.railnet.gov.in');
    if (!actor || !actor.is_active || actor.role_code === 'VIEWER') {
      return NextResponse.json({ error: 'Unauthorized to update Sanctioned Strength' }, { status: 403 });
    }

    const entries = body.entries || [];
    const meta = {
      order_no: body.order_no || 'WCR/P-HQ/CADRE/OCT-2026',
      order_date: body.order_date || '2026-11-04',
      effective_date: body.effective_date || '2026-10-01',
      remarks: body.remarks || 'Bulk SS update from WCR Depot-wise Cadre Sheet',
    };

    const result = await firebaseRepo.bulkUpdateSanctionedStrength(actor, entries, meta);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update Sanctioned Strength' }, { status: 500 });
  }
}