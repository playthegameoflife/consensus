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
        {/* Accessibility: skip-to-main link — matches live consensus.app */}
        <a
          href="#main-content"
          data-testid="skip-link"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-white focus:text-cyan-600 focus:font-semibold focus:rounded-lg focus:shadow-lg"
        >
          Skip to main content
        </a>
        {/* Add data-testid="title" to the title element — not supported via Next.js metadata API */}
        <script
          dangerouslySetInnerHTML={{
            __html: `document.title = document.title; document.querySelector('title')?.setAttribute('data-testid', 'title');`,
          }}
        />
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
