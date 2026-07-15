import type { Metadata, Viewport } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EVE - Inventory Intelligence",
  description: "Inventory Intelligence Platform for Ecommerce Founders. Predict stockouts, find dead stock, and get reorder recommendations.",
};

import { Toaster } from 'sonner';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="executive-light"
      className={`${inter.variable} ${robotoMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('theme') || 'executive-light';
                  var active = stored;
                  if (stored === 'system') {
                    active = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'executive-light';
                  }
                  document.documentElement.setAttribute('data-theme', active);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
