// Not found inside a project (an unknown card, TASK-B-088): under the project's own header, one sentence and the way back to its board.
import { Button } from "@/components/ui/button";
import { errorPage, section } from "@/words";

export default function ProjectNotFound() {
  return (
    <main className="grid min-h-[60vh] place-items-center px-4" data-not-found>
      <div className="grid max-w-[480px] justify-items-center gap-5 rounded-[10px] border border-hair bg-sheet px-8 py-10 text-center">
        <p className="m-0 text-[17px] font-semibold text-ink">{errorPage.notFound}</p>
        {/* a relative link: the board of the project this URL is in (a not-found page gets no params) */}
        <Button asChild className="min-h-11 px-5 font-semibold"><a href="./" data-back-board>{section.board}</a></Button>
      </div>
    </main>
  );
}
