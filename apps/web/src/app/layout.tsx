import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { Toaster } from '@/components/ui/toaster';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'FreelancerHub',
    template: '%s | FreelancerHub',
  },
  description:
    'The global freelance marketplace with trust, transparency, and real-time collaboration.',
  keywords: ['freelance', 'marketplace', 'projects', 'hiring', 'remote work'],
  authors: [{ name: 'FreelancerHub Team' }],
  creator: 'FreelancerHub',
  metadataBase: new URL(
    process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
  ),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
    title: 'FreelancerHub',
    description:
      'The global freelance marketplace with trust, transparency, and real-time collaboration.',
    siteName: 'FreelancerHub',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FreelancerHub',
    description:
      'The global freelance marketplace with trust, transparency, and real-time collaboration.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className={inter.className}>
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
