import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { SampleDataMark } from "@/components/SampleDataMark";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = { title: "CAW" };

// Direction B's one family (TASK-B-085, WHY.md rule 4): IBM Plex Sans Thai 400 / 500 / 600.
const plex = IBM_Plex_Sans_Thai({ weight: ["400", "500", "600"], subsets: ["thai", "latin"], display: "swap", variable: "--font-plex" });

// Runs in <head> before the first paint (P-1, OD-10): the stored pick, else the computer's setting — so a dark page never flashes
// light. The key is CawRoot's THEME_KEY ("caw-theme"); it is written out here because a server layout cannot read a client module's value.
const theme = `try{var t=localStorage.getItem("caw-theme");if(t!=="dark"&&t!=="light")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  // a stored pick also reaches the server (ThemeToggle writes the cookie), so the HTML itself arrives in that scheme
  const stored = (await cookies()).get("caw-theme")?.value;
  return (
    <html lang="th" className={plex.variable} data-theme={stored === "dark" || stored === "light" ? stored : undefined} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: theme }} />
      </head>
      <body>
        {/* Ant Design's server-side style extraction; it only emits styles for the Ant components a route renders. */}
        <SampleDataMark />
        <AntdRegistry>
          <TooltipProvider>{children}</TooltipProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
