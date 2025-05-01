import './globals.css';
import type { Metadata } from 'next';
import { Toaster } from '@/components/ui/toaster';
import { GeistSans } from 'geist/font/sans';
import { FEATURES } from '@/lib/config/features';

export const metadata: Metadata = {
  title: 'CryptoSentry - Crypto Alert App',
  description: 'A powerful alert system for cryptocurrency trading',
  icons: {
    icon: [
      {
        url: '/favicon.svg',
        type: 'image/svg+xml',
      },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${GeistSans.variable} font-sans antialiased`}>
        {FEATURES.isDevMode && (
          <div className="fixed bottom-4 right-4 z-50 rounded-full bg-yellow-500 px-4 py-2 text-sm font-medium text-white shadow-lg">
            Development Mode
          </div>
        )}
        {children}
        <Toaster />
      </body>
    </html>
  );
}
