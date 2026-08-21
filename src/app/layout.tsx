import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider, ThemeProvider } from "./providers";
import { Navbar } from "@/components/shared/navbar";
import { ToastProvider } from "@/components/shared/toast";
import { getAuthenticatedUserAccess } from "@/lib/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CODE AROHA",
  description:
    "Student competitive programming analytics, verified skill rankings, and AI-powered talent insights on CODE AROHA.",
  keywords: [
    "CODE AROHA",
    "CodeChef",
    "LeetCode",
    "Competitive Programming",
    "Talent Leaderboard",
    "Student Placement Intelligence",
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const access = await getAuthenticatedUserAccess();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme') || 'light';
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `
          }}
        />
      </head>
      <body
        className="min-h-full flex flex-col bg-brand-bg text-brand-text selection:bg-[#EAB308]/30 selection:text-brand-text"
        suppressHydrationWarning
      >
        <ThemeProvider>
          <AuthProvider initialRole={access?.role} initialStudentProfileId={access?.studentProfileId}>
            <ToastProvider>
              <Navbar userRole={access?.role} studentProfileId={access?.studentProfileId} />
              <main className="flex-1 flex flex-col">{children}</main>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
