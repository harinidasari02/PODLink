import type { Metadata, Viewport } from 'next';
import './globals.css';
import { RegisterSW } from '@/components/RegisterSW';

export const metadata: Metadata = { title: { default: 'PODLink', template: '%s · PODLink' }, description: 'Proof of delivery, checked at the gate.', manifest: '/manifest.webmanifest' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#1f3a5f' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
