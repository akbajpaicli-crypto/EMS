import { NextRequest, NextResponse } from 'next/server';
import { firebaseRepo } from '@/services/db/firebase.adapter';
import { getFirebaseEnvStatus } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get('email') || 'cli-jbp@wcr.railnet.gov.in';
    const actor = await firebaseRepo.getUserByEmail(email);
    if (!actor || !actor.is_active) {
      return NextResponse.json({ error: 'Unauthorized or inactive user' }, { status: 403 });
    }

    const [depots, employees, ssRecords] = await Promise.all([
      firebaseRepo.getDepots(actor),
      firebaseRepo.getEmployees(actor),
      firebaseRepo.getSanctionedStrength(actor),
    ]);

    return NextResponse.json({
      provider: 'firebase',
      actor,
      depots,
      employees,
      ssRecords,
      envStatus: getFirebaseEnvStatus(),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: err.message || 'Failed to read from Cloud Firestore',
        envStatus: getFirebaseEnvStatus(),
      },
      { status: 500 }
    );
  }
}