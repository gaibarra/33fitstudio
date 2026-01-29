import './globals.css';
import type { ReactNode } from 'react';
import HeaderNav from './components/HeaderNav';

export const metadata = {
  title: '33 F/T Studio',
  description: 'Reservas, membresías y marketing para 33 F/T Studio.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-base text-slate-900">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6 sm:space-y-8">
          <HeaderNav />
          {children}
        </div>
      </body>
    </html>
  );
}
