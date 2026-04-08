import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { CartProvider } from "@/lib/cart";
import siteContent from "@/content/site.json";

const BASE_URL = "https://elitedigitalconsulting.github.io/neurotonics";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: `${siteContent.brand.name} — ${siteContent.brand.tagline}`,
    template: `%s | ${siteContent.brand.name}`,
  },
  description: siteContent.brand.description,
  keywords: [
    "cognitive supplement",
    "brain boost",
    "nootropics",
    "natural supplement",
    "brain fog",
    "stress relief",
    "memory boost",
    "focus",
    "ARTG listed",
    "vegan supplement",
    "Australian supplement",
    "Neurotonics",
    "Brain Boost 1000",
    "nootropic capsules",
  ],
  alternates: {
    canonical: BASE_URL + "/",
  },
  openGraph: {
    title: `${siteContent.brand.name} — ${siteContent.brand.tagline}`,
    description: siteContent.brand.description,
    type: "website",
    locale: "en_AU",
    siteName: siteContent.brand.name,
    url: BASE_URL + "/",
    images: [
      {
        url: BASE_URL + "/images/product-main.png",
        width: 1200,
        height: 630,
        alt: `${siteContent.brand.name} — Brain Boost 1000 cognitive supplement`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@neurotonics",
    creator: "@neurotonics",
    title: `${siteContent.brand.name} — ${siteContent.brand.tagline}`,
    description: siteContent.brand.description,
    images: [BASE_URL + "/images/product-main.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
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
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-white text-gray-900">
        <CartProvider>
          <Header />
          <div className="flex-1 pt-24 sm:pt-28">{children}</div>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
