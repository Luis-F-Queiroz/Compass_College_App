import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Compass — College Application Hub",
  description: "Your private, cloud-backed college-application command center.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
