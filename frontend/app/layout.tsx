import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import "@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css";

export const metadata: Metadata = {
  title: "Aero-Twin Frontend",
  description: "Aero-Twin urban dust risk frontend shell",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[#050506] text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
