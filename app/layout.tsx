import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Aonde — Curadoria João Pessoa",
  description: "Curadoria gastronômica e de hospedagem em João Pessoa, Paraíba — integrada ao Turso.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          crossOrigin=""
        />
        <link rel="stylesheet" href="/css/style.css" />
        <Script
          src="https://cdn.tailwindcss.com"
          strategy="beforeInteractive"
        />
        <Script id="tailwind-config" strategy="beforeInteractive">{`
          if (typeof tailwind !== 'undefined') {
            tailwind.config = {
              darkMode: 'class',
              theme: {
                extend: {
                  colors: { coral: '#E14D2A' },
                  fontFamily: {
                    sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
                    serif: ['"Instrument Serif"', 'Georgia', 'serif'],
                  }
                }
              }
            };
          }
        `}</Script>
        <Script
          src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className="min-h-screen flex flex-col selection:bg-coral selection:text-white">
        {children}
      </body>
    </html>
  );
}
