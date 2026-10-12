import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BillCheck | Medical Bill Audit",
  description: "AI-powered medical bill auditing, error detection, and fair price verification.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased font-sans" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
