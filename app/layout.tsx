import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Consensus: AI for Research",
  description:
    "Consensus is an AI academic search engine for peer-reviewed literature—your research OS for finding, organizing, and analyzing science 10x faster.",
  icons: {
    icon: ["/favicon.ico", "/favicon.png", "/favicon.svg"],
  },
};

// Matches live consensus.app: width=device-width, initial-scale=1.0, minimum-scale=1.0
export const viewport = {
  width: "device-width",
  initialScale: 1.0,
  minimumScale: 1.0,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${sourceSerif.variable}`}>
      <body className="min-h-full flex flex-col antialiased">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
