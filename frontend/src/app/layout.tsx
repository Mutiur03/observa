import "./globals.css";
import { Inter } from "next/font/google";
import { Observa } from "@/components/Observa";
import { QueryProvider } from "@/components/QueryProvider";
import { Analytics } from "@vercel/analytics/next"
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata = {
  title: "Observa",
  description: "Self-hosted observability and analytics",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const observaApiKey = process.env.NEXT_PUBLIC_OBSERVA_API_KEY;

  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-canvas text-ink antialiased">
        <Analytics />
        {observaApiKey ? <Observa apiKey={observaApiKey} /> : null}
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
