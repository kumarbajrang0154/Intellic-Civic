import React from 'react';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from 'sonner';
import { PwaRegister } from '@/components/pwa/PwaRegister';

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: 'IntelliCivic - AI Driven Civic Platform',
  description: 'Smart City Civic Complaint Management and Decision Support Platform',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'IntelliCivic',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <PwaRegister />
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
