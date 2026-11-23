import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseEnvStatus } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const enteredPin = String(body.pin || '').trim();
    const expectedPin = (process.env.ADMIN_CONSOLE_PIN || '2026').trim();

    if (!enteredPin || enteredPin !== expectedPin) {
      return NextResponse.json({ error: 'गलत Admin PIN — कृपया सही PIN दर्ज करें।' }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      envStatus: getFirebaseEnvStatus(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Authentication failed' }, { status: 500 });
  }
}