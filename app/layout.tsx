import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chelseaiq Ai",
  description: "AI operating system for Chelsea hospitality intelligence",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
