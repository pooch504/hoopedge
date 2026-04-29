import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HoopEdge",
  description: "NBA and WNBA matchup intelligence and prop edges.",
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