// Single link for the QR code / "get the app" CTA (see the JNU launch
// poster). A QR code just encodes one URL — it can't know what device
// scanned it — so this route does the platform check server-side from the
// User-Agent and redirects Android to the Play Store and everyone else
// (iOS, desktop) to the live web build.
import { NextRequest, NextResponse } from 'next/server';

const WEB_APP_URL = 'https://zen-z-app.vercel.app';
// Same package id as ANDROID_PACKAGE in apps/mobile/src/app/(home)/profile.tsx.
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.campussocial.app&hl=en';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const userAgent = req.headers.get('user-agent') || '';
  const isAndroid = /android/i.test(userAgent);

  const target = isAndroid ? PLAY_STORE_URL : WEB_APP_URL;
  return NextResponse.redirect(target, { status: 302 });
}
