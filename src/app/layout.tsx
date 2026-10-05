import React from 'react';
import type { Metadata, Viewport } from 'next';
import { Poppins } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import { PwaRegister } from '@/components/pwa/PwaRegister';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-poppins',
});

export const viewport: Viewport = {
  themeColor: '#3468A1',
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
    <html lang="en" className={poppins.variable}>
      <body className={`${poppins.className} bg-[#F2EFE6] text-[#131E20] antialiased`}>
        {children}
        <PwaRegister />
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
