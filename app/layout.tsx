import type { Metadata } from "next";
import { Fira_Code, Noto_Sans_TC } from "next/font/google";
import favicon from "./favicon.png";
import "./globals.css";

const firaCode = Fira_Code({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fira-code"
});

const notoSansTc = Noto_Sans_TC({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-sans-tc"
});

export const metadata: Metadata = {
  title: "logs_viewer",
  description: "本機 log 檢視與篩選工具",
  icons: {
    icon: [{ url: favicon.src, type: "image/png" }],
    shortcut: [{ url: favicon.src, type: "image/png" }]
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-Hant"
      suppressHydrationWarning
      className={`${firaCode.variable} ${notoSansTc.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
