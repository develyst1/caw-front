"use client";

// caw-back cannot be reached (D-089, TASK-B-093): a screen, not an error and never sample data — inside the app frame and theme. One sentence, the one
// command that starts it (a code line you can copy), the address that was tried, and ลองอีกครั้ง, which reloads the page.
import { Button } from "@/components/ui/button";
import { backendDown, errorPage } from "@/words";

export function BackendDown({ url }: { url: string }) {
  return (
    <main className="grid min-h-[80vh] place-items-center px-4" data-backend-down>
      <div className="grid w-full max-w-[560px] gap-5 rounded-[10px] border border-hair bg-sheet px-8 py-10 max-md:px-5" role="alert">
        <p className="m-0 text-[19px] font-semibold leading-snug text-ink">{backendDown.text}</p>
        <div className="grid gap-1.5">
          <span className="text-sm text-ink2">{backendDown.command}</span>
          <code className="block select-all overflow-x-auto whitespace-nowrap rounded-md border border-hair2 bg-now-soft px-3.5 py-2.5 font-mono text-[15px] text-ink" data-start-command>cd caw-back &amp;&amp; bun run dev</code>
        </div>
        <p className="m-0 text-sm text-ink2">{backendDown.tried(url)}</p>
        <div><Button className="min-h-11 px-5 font-semibold" onClick={() => window.location.reload()}>{errorPage.retry}</Button></div>
      </div>
    </main>
  );
}
