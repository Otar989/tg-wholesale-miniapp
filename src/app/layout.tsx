import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "ОптМаркет РФ — Telegram Mini App",
  description: "B2B оптовый маркетплейс для поставщиков и покупателей",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <head>
        <script src="https://telegram.org/js/telegram-web-app.js" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
