import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SwRegister } from "@/components/sw-register";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Samyak Rao / SAM31GRAPHICS",
  description: "A cinematic interactive portfolio through the imagination, edits, photos, and 3D worlds of Samyak Rao.",
  applicationName: "SAM31GRAPHICS",
  authors: [{ name: "Samyak Rao" }],
  creator: "Samyak Rao",
  metadataBase: new URL("https://sam31graphics.onrender.com"),
  openGraph: {
    title: "Samyak Rao / SAM31GRAPHICS",
    description: "Every room holds a story. Video edits, photography, motion, imagination.",
    type: "website",
    images: ["/assets/images/thumbnails/Thumbnail_CODM_BoomHeadshot.jpg"]
  },
  twitter: {
    card: "summary_large_image",
    title: "Samyak Rao / SAM31GRAPHICS",
    description: "A cinematic interactive 3D creative universe."
  }
};

export const viewport: Viewport = {
  themeColor: "#050507",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
