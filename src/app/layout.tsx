import type { Metadata } from "next";
import "@/index.css";
import { AppLayout } from "@/components/AppLayout";
import { AppProviders } from "@/components/AppProviders";

export const metadata: Metadata = {
  title: "PodChat",
  description: "Talk to your podcasts",
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body className="min-h-screen">
        <AppProviders>
          <AppLayout>{children}</AppLayout>
        </AppProviders>
      </body>
    </html>
  );
}
