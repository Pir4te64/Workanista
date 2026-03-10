import type { Metadata } from "next";
import "@fontsource-variable/inter";
import Providers from "./components/Providers";
import "./globals.css";

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
      <body className="font-sans bg-surface-black text-text-primary min-h-screen antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
