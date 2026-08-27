import React from 'react';

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
      <body>{children}</body>
    </html>
  );
}
