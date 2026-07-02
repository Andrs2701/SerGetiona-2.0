import type { Metadata } from "next";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { BASE_PATH } from "@/lib/basePath";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sergestiona 2.0 | Universidad Sergio Arboleda",
  description: "Plataforma de gestión de producción de contenidos académicos virtuales",
  icons: {
    icon: `${BASE_PATH}/favicon.ico`,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* Anti-FOUC: set dark class before paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{const t=localStorage.getItem('sg_theme');if(t==='dark'||(t===null&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full bg-[--background] text-[--foreground]">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
