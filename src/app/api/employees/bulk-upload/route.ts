import { NextRequest, NextResponse } from 'next/server';
import { firebaseRepo } from '@/services/db/firebase.adapter';
import { EmployeeMaster } from '@/types/wcr';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const actor = await firebaseRepo.getUserByEmail(body.actorEmail || 'cli-jbp@wcr.railnet.gov.in');
    if (!actor || !actor.is_active) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const records: EmployeeMaster[] = body.records || [];
    const feedType = body.fileType || 'CMS_PARTICULARS';
    const result = await firebaseRepo.bulkUpsertEmployees(actor, records, feedType);

    if (body.autoDeleteRaw && Array.isArray(body.rawStoragePaths)) {
      await Promise.all(
        body.rawStoragePaths.map((p: string) => firebaseRepo.deleteRawUploadedFile(p))
      );
    }

    return NextResponse.json({
      success: true,
      ...result,
      rawDeleted: Boolean(body.autoDeleteRaw),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Bulk upload failed' }, { status: 500 });
  }
}