import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "next-themes";

export const metadata: Metadata = {
  title: "Reelmotion Editor",
  description: "Reelmotion Editor",
  icons: {
    icon: [
      {
        url: "/icons/icon_reelmotion_ai.png",
        sizes: "any",
        type: "image/png",
      },
    ],
    shortcut: "/icons/icon_reelmotion_ai.png",
    apple: "/icons/icon_reelmotion_ai.png",
    other: [
      {
        rel: "icon",
        url: "/icons/icon_reelmotion_ai.png",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icons/icon_reelmotion_ai.png" type="image/png" />
        <link rel="shortcut icon" href="/icons/icon_reelmotion_ai.png" type="image/png" />
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <main className="bg-gray-900">
            {children}
            <Toaster />
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
