import type { Metadata } from "next";
import "./globals.css";
import SiteNav from "@/components/site-nav";

export const metadata: Metadata = {
  title: "中佳九学讲义管理系统",
  description: "中佳九学讲义管理系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
