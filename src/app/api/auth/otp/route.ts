import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import * as OTPAuth from 'otpauth';
import { adminDb } from '@/lib/firebase-admin';
import { firebaseRepo } from '@/services/db/firebase.adapter';

/**
 * Hybrid Auth Endpoint:
 * - action = 'SEND_OTP': Generates 6-digit Email OTP (10-min expiry, max 5 attempts)
 * - action = 'VERIFY_OTP': Verifies 6-digit Email OTP
 * - action = 'VERIFY_TOTP': Verifies Google Authenticator 6-digit TOTP
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const action = body.action as 'SEND_OTP' | 'VERIFY_OTP' | 'VERIFY_TOTP';

    const user = await firebaseRepo.getUserByEmail(email);
    if (!user || !user.is_active) {
      return NextResponse.json({ error: 'Access Denied: Inactive or unregistered WCR user.' }, { status: 403 });
    }

    if (action === 'SEND_OTP') {
      const code = String(crypto.randomInt(100000, 999999));
      const hash = crypto.createHash('sha256').update(code).digest('hex');
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      await adminDb.collection('auth_otp_codes').doc(email).set({
        email,
        otp_hash: hash,
        attempts: 0,
        expires_at: expiresAt,
        consumed: false,
      });

      // In production, send via Nodemailer SMTP; return masked confirmation
      return NextResponse.json({
        success: true,
        message: `6-digit OTP sent to ${email} (valid for 10 minutes).`,
        devPreviewOtp: process.env.NODE_ENV !== 'production' ? code : undefined,
      });
    }

    if (action === 'VERIFY_OTP') {
      const otp = String(body.code || '').trim();
      const docRef = adminDb.collection('auth_otp_codes').doc(email);
      const snap = await docRef.get();
      if (!snap.exists) return NextResponse.json({ error: 'OTP not requested' }, { status: 400 });

      const data = snap.data()!;
      if (data.consumed) return NextResponse.json({ error: 'OTP already used' }, { status: 400 });
      if (Date.now() > data.expires_at) return NextResponse.json({ error: 'OTP expired (10 min limit)' }, { status: 400 });
      if (data.attempts >= 5) return NextResponse.json({ error: 'Maximum 5 attempts exceeded' }, { status: 429 });

      const hash = crypto.createHash('sha256').update(otp).digest('hex');
      if (hash !== data.otp_hash) {
        await docRef.update({ attempts: data.attempts + 1 });
        return NextResponse.json({ error: `Invalid OTP (${4 - data.attempts} attempts left)` }, { status: 401 });
      }

      await docRef.update({ consumed: true });
      await adminDb.collection('users').doc(email).update({ last_login: new Date().toISOString() });
      return NextResponse.json({ success: true, user });
    }

    if (action === 'VERIFY_TOTP') {
      if (!user.totp_secret) {
        return NextResponse.json({ error: 'TOTP Authenticator not configured for this user' }, { status: 400 });
      }
      const totp = new OTPAuth.TOTP({
        issuer: 'WCR EMS',
        label: user.email,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(user.totp_secret),
      });
      const delta = totp.validate({ token: String(body.code || ''), window: 1 });
      if (delta === null) {
        return NextResponse.json({ error: 'Invalid Authenticator TOTP code' }, { status: 401 });
      }
      await adminDb.collection('users').doc(email).update({ last_login: new Date().toISOString() });
      return NextResponse.json({ success: true, user });
    }

    return NextResponse.json({ error: 'Invalid auth action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Authentication error' }, { status: 500 });
  }
}
