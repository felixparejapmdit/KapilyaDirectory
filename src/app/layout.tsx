import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, Public_Sans } from 'next/font/google';
import './globals.css';
import { Navigation } from '@/components/Navigation';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { AccessBeacon } from '@/components/AccessBeacon';
import { ThemeProvider } from '@/components/ThemeProvider';
import { LocationProvider } from '@/components/LocationProvider';
import { SplashProvider } from '@/components/SplashScreen';
import { VoiceProvider } from '@/components/VoiceProvider';
import { SPLASH_BOOT_SCRIPT, THEME_BODY_SCRIPT, THEME_BOOT_SCRIPT } from '@/lib/boot-scripts';

const publicSans = Public_Sans({ subsets: ['latin'], variable: '--font-public-sans', display: 'swap' });
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Kapilya Directory — Worldwide INC Near-Me Finder & Schedules',
  description:
    'Near-me finder for Iglesia Ni Cristo local congregations, extensions, and group worship services worldwide. Transit departure-board schedules, GPS directions, and offline PWA.',
  keywords: [
    'Kapilya Directory',
    'Iglesia Ni Cristo',
    'INC chapel near me',
    'INC schedule',
    'INC directory',
    'worship service times',
  ],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Kapilya Directory',
  },
};

export const viewport: Viewport = {
  themeColor: '#0B1426',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${publicSans.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Before first paint: theme, transparency, and whether the welcome splash shows. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT + SPLASH_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-screen antialiased selection:bg-[#E8A33D] selection:text-[#0B1426]">
        <script dangerouslySetInnerHTML={{ __html: THEME_BODY_SCRIPT }} />
        <ThemeProvider>
          <LocationProvider>
            <SplashProvider>
              <VoiceProvider>
                <div className="kd-app min-h-screen flex flex-col">
                  <ServiceWorkerRegister />
                  <AccessBeacon />
                  <Navigation />
                  <main className="flex-1 pb-20 md:pb-10">{children}</main>
                </div>
              </VoiceProvider>
            </SplashProvider>
          </LocationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
