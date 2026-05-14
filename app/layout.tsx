import type { Metadata, Viewport } from "next";
import { Geist, Inter, JetBrains_Mono, Pirata_One, Libre_Barcode_128 } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegistrar from "./components/ServiceWorkerRegistrar";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const pirataOne = Pirata_One({
  variable: "--font-pirata-one",
  subsets: ["latin"],
  weight: ["400"],
});

const libreBarcode128 = Libre_Barcode_128({
  variable: "--font-libre-barcode-128",
  subsets: ["latin"],
  weight: ["400"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#f76b15",
};

export const metadata: Metadata = {
  title: "Factory",
  description:
    "Open source, cloud-only software factory that lets you bring your own coding agents.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Factory",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetBrainsMono.variable} ${geist.variable} ${pirataOne.variable} ${libreBarcode128.variable} h-full antialiased`}
    >
      <body className="relative isolate min-h-full flex flex-col bg-grayscale-1">
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
