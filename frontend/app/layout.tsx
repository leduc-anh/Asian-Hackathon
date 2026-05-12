import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import "@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css";

export const metadata: Metadata = {
  title: "AeroTwin Studio — Digital City Workspace",
  description:
    "Nền tảng mô phỏng vi khí hậu và khí động học cho quy hoạch & thiết kế đô thị bền vững.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="bg-[#050506] text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
