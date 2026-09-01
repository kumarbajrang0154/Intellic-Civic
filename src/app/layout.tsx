import React from 'react';
import './globals.css';
import { Toaster } from 'sonner';

export const metadata = {
  title: 'IntelliCivic - AI Driven Civic Platform',
  description: 'Smart City Civic Complaint Management and Decision Support Platform',
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
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
