// Not found, inside the app frame (TASK-B-088 § 2.5): one sentence and one way back. It renders in the root layout, so the head script has already
// put the stored theme on <html> — it starts dark when dark was picked (B-084 `card-unknown · cold-theme`).
import { Button } from "@/components/ui/button";
import { errorPage, section } from "@/words";

export default function NotFound() {
  return (
    <main className="grid min-h-[70vh] place-items-center px-4" data-not-found>
      <div className="grid max-w-[480px] justify-items-center gap-5 rounded-[10px] border border-hair bg-sheet px-8 py-10 text-center">
        <p className="m-0 text-[17px] font-semibold text-ink">{errorPage.notFound}</p>
        <Button asChild className="min-h-11 px-5 font-semibold"><a href="/">{section.projects}</a></Button>
      </div>
    </main>
  );
}
