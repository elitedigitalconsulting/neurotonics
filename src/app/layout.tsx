import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { CartProvider } from "@/lib/cart";
import siteContent from "@/content/site.json";

export const metadata: Metadata = {
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
  ],
  openGraph: {
    title: `${siteContent.brand.name} — ${siteContent.brand.tagline}`,
    description: siteContent.brand.description,
    type: "website",
    locale: "en_AU",
    siteName: siteContent.brand.name,
  },
  robots: {
    index: true,
    follow: true,
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
      <body className="min-h-full flex flex-col bg-[#0a0a1a] text-white">
        <CartProvider>
          <Header />
          <div className="flex-1 pt-16 sm:pt-20">{children}</div>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
