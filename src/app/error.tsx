"use client";

// Something failed while drawing a page (TASK-B-088 § 2.5): one sentence, try again, or back to the projects — in the app's theme.
import { Button } from "@/components/ui/button";
import { errorPage, section } from "@/words";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="grid min-h-[70vh] place-items-center px-4" data-error-page>
      <div className="grid max-w-[480px] justify-items-center gap-5 rounded-[10px] border border-hair bg-sheet px-8 py-10 text-center" role="alert">
        <p className="m-0 text-[17px] font-semibold text-ink">{errorPage.failed}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button className="min-h-11 px-5 font-semibold" onClick={reset}>{errorPage.retry}</Button>
          <Button asChild variant="outline" className="min-h-11"><a href="/">{section.projects}</a></Button>
        </div>
      </div>
    </main>
  );
}
