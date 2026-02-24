import type { Metadata } from 'next';
import { Literata, Instrument_Sans } from 'next/font/google';
import './globals.css';

const literata = Literata({
  subsets: ['latin'],
  variable: '--font-literata',
  display: 'swap',
});

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Hone',
  description: 'A minimalist writing platform',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${literata.variable} ${instrumentSans.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
