import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KisanX — AI-Powered Crop Intelligence",
  description:
    "AI-powered crop health, harvest and market intelligence for farmers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
