import type { Metadata } from 'next';
import './globals.css';
import BottomNav from '@/components/BottomNav';
import AppDrawer from '@/components/AppDrawer';
import { CurrencyProvider } from '@/context/CurrencyContext';
import { AppModeProvider } from '@/context/AppModeContext';
import { AuthProvider } from '@/context/AuthContext';
import { SyncProvider } from '@/context/SyncContext';
import { DrawerProvider } from '@/context/DrawerContext';
import { NotificationProvider } from '@/context/NotificationContext';
import AuthGate from '@/components/AuthGate';
import ShareHandler from '@/components/ShareHandler';

import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Myser — Personal Budget Tracker',
  description: 'Track expenses, manage budgets, and see where your money goes — all locally on your device.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
      </head>
      <body>
        <AuthProvider>
          <SyncProvider>
            <CurrencyProvider>
              <AppModeProvider>
                <DrawerProvider>
                  <NotificationProvider>
                    <AuthGate>
                      <div className="app-container">
                        {children}
                        <BottomNav />
                      </div>
                      <AppDrawer />
                      <ShareHandler />
                    </AuthGate>
                  </NotificationProvider>
                </DrawerProvider>
              </AppModeProvider>
            </CurrencyProvider>
          </SyncProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
