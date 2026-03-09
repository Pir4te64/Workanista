import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

export const metadata: Metadata = {
  title: "ColdDuck",
  description: "Asistente inteligente para responder propuestas y outreach",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${roboto.className} bg-surface-black text-text-primary min-h-screen`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
