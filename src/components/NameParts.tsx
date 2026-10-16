// A person's name that may wrap: it breaks ONLY at its spaces — each part is one run that never breaks inside (a Thai surname is one unit to the
// reader, polish-plan § 2.4, B-086 review). A single part wider than its box ends in … on its own line instead of being cut (DEF-3, TASK-B-092);
// the caller puts the whole name in `title`. Used by Person (every screen that draws one) and by the team page's node and drawer head.
export function NameParts({ name }: { name: string }) {
  const parts = name.split(/\s+/).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 ? " " : ""}
          <span className="inline-block max-w-full overflow-hidden text-ellipsis whitespace-nowrap align-bottom" data-name-part>{p}</span>
        </span>
      ))}
    </>
  );
}
