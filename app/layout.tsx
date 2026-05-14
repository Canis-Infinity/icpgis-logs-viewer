import type { Metadata } from "next";
import favicon from "./favicon.png";
import "./globals.css";

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
    <html lang="zh-Hant" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
