import type { Metadata } from "next";
import "./globals.css";
import { ClientProvider } from "@/app/client-provider";

export const metadata: Metadata = {
  title: "Next.js App",
  description: "Created with Next.js",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans">
        <ClientProvider>{children}</ClientProvider>
      </body>
    </html>
  );
}
