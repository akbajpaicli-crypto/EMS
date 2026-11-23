import type { Metadata } from 'next';
import './globals.css';
import { SYSTEM_BRANDING } from '@/lib/wcr-constants';

export const metadata: Metadata = {
  title: SYSTEM_BRANDING.primaryHeader,
  description: `${SYSTEM_BRANDING.hindiTitle} — ${SYSTEM_BRANDING.developerAttribution}`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
