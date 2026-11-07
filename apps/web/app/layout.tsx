import type { Metadata } from "next";
import { Inter, Manrope, Noto_Sans_Devanagari, Noto_Sans_Gurmukhi } from "next/font/google";
import "./globals.css";
import { getUser } from "@/lib/auth";
import DashboardShell from "@/components/dashboard/DashboardShell";
const inter = Inter({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700"], variable: "--font-inter", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-manrope", display: "swap" });
const notoDeva = Noto_Sans_Devanagari({ subsets: ["devanagari"], weight: ["400", "600"], variable: "--font-noto-deva", display: "swap" });
const notoGuru = Noto_Sans_Gurmukhi({ subsets: ["gurmukhi"], weight: ["400", "600"], variable: "--font-noto-guru", display: "swap" });

const APP = process.env.NEXT_PUBLIC_APP_NAME || "Y2ube";

export const metadata: Metadata = {
  title: `${APP} — Prompt to published`,
  description: "Turn one idea into a finished video: script, visuals, voice, music, captions, thumbnail and SEO copy — ready to upload.",
  icons: { icon: "/favicon.svg" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${manrope.variable} ${notoDeva.variable} ${notoGuru.variable}`}>
      <head><script dangerouslySetInnerHTML={{ __html: `try{localStorage.removeItem("y2-theme");document.documentElement.removeAttribute("data-theme")}catch(e){}` }} /><meta name="color-scheme" content="dark" /></head>
      <body className="min-h-screen" suppressHydrationWarning>
        {user ? <DashboardShell user={user}>{children}</DashboardShell> : <main className="min-h-screen">{children}</main>}
      </body>
    </html>
  );
}