import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import { connection } from "next/server";
import { backendReachable, backendUrl, onSampleData } from "@/api";
import { BackendDown } from "@/components/BackendDown";
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
  // D-089: on the real back end, ask once whether caw-back answers — if not, every page shows BackendDown in place of its content (decided here, on
  // the server: a production build hides a server error's message from the client, so error.tsx could not tell "down" from any other failure)
  await connection();
  const down = !onSampleData() && !(await backendReachable());
  return (
    <html lang="th" className={plex.variable} data-theme={stored === "dark" || stored === "light" ? stored : undefined} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: theme }} />
      </head>
      <body>
        <SampleDataMark />
        <TooltipProvider>{down ? <BackendDown url={backendUrl()} /> : children}</TooltipProvider>
      </body>
    </html>
  );
}
