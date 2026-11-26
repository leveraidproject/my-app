import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HLC Music Library",
  description: "HLC Music Library: every song we have sung, with who led it and where to find it.",
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
    apple: [{ url: "/icon.png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black antialiased">{children}</body>
    </html>
  );
}
