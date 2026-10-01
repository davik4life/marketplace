import type { Metadata } from "next";
import "./globals.css";
import { ShopProvider } from "./shop-context";

export const metadata: Metadata = {
  title: "Okirika — Objects for everyday living",
  description:
    "Thoughtfully chosen home and lifestyle goods. Make room for the everyday.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ShopProvider>{children}</ShopProvider>
      </body>
    </html>
  );
}
