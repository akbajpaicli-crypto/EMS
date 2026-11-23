import { NextRequest, NextResponse } from 'next/server';
import { firebaseRepo } from '@/services/db/firebase.adapter';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const actor = await firebaseRepo.getUserByEmail(body.actorEmail || 'cli-jbp@wcr.railnet.gov.in');
    if (!actor || !actor.is_active) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    switch (body.operation) {
      case 'UPDATE_SS':
        return NextResponse.json({
          success: true,
          data: await firebaseRepo.updateSanctionedStrength(actor, body.payload),
        });
      case 'PROMOTION':
        return NextResponse.json({
          success: true,
          data: await firebaseRepo.recordPromotion(actor, body.payload),
        });
      case 'DRAFTING_OUT':
        return NextResponse.json({
          success: true,
          data: await firebaseRepo.recordDraftingOut(actor, body.payload),
        });
      case 'DRAFTING_RETURN':
        return NextResponse.json({
          success: true,
          data: await firebaseRepo.recordDraftingReturn(
            actor,
            body.draftingId,
            body.returnOrderNo,
            body.actualReturnDate,
            body.overrideDepotId
          ),
        });
      case 'TRANSFER':
        return NextResponse.json({
          success: true,
          data: await firebaseRepo.recordTransfer(actor, body.payload),
        });
      default:
        return NextResponse.json({ error: 'Unsupported lifecycle operation' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Lifecycle operation failed' }, { status: 400 });
  }
}
