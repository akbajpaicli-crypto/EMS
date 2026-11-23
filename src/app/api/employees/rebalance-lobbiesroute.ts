import { NextRequest, NextResponse } from 'next/server';
import { firebaseRepo } from '@/services/db/firebase.adapter';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const actor = await firebaseRepo.getUserByEmail(body.actorEmail || 'cli-jbp@wcr.railnet.gov.in');
    if (!actor || !actor.is_active) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const result = await firebaseRepo.rebalanceAllLobbiesByCrewId(actor);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to rebalance lobbies' }, { status: 500 });
  }
}