// The workspace folders (`workspace.roots`, SPEC-A-008 v1.1): at most 20, each an absolute path of 1–500 characters with no `..` segment.
// The back end checks the same and is the authority; this lets the editor say "no" before asking.
export const MAX_ROOTS = 20;
export const MAX_ROOT_LENGTH = 500;

const ABSOLUTE = /^(\/|[A-Za-z]:[\\/])/;

export const isValidRoot = (path: string) =>
  path.length >= 1 && path.length <= MAX_ROOT_LENGTH && ABSOLUTE.test(path) && !path.split(/[\\/]/).includes("..");

/** Can `path` be added to `roots`? A valid path that is not already there, with room left. */
export const canAdd = (roots: string[], path: string) => isValidRoot(path) && !roots.includes(path) && roots.length < MAX_ROOTS;

const segments = (root: string) => root.split(/[\\/]/).filter(Boolean);

/** What a folder is called on screen (D-098, TASK-B-104): its last path segment (`usb-oda`); when another root in `allRoots` ends the same way,
 *  its parent too (`corp-ais/usb-oda`). The full path stays internal — the folders dialog, where it is typed and checked, and `title`. */
export function folderName(root: string, allRoots: string[]): string {
  const own = segments(root);
  if (own.length === 0) return root;
  const last = own.at(-1)!;
  const clash = allRoots.some((r) => r !== root && segments(r).at(-1) === last);
  return clash && own.length > 1 ? own.slice(-2).join("/") : last;
}

// Folder kinds (D-099 / D-100, TASK-B-108): `readOnly` ⊆ `roots` — the folders the team may read but not write. Kept in the roots' order.
/** `readOnly` limited to what is still in `roots`. */
export const keepReadOnly = (roots: string[], readOnly: string[]) => roots.filter((r) => readOnly.includes(r));
/** `readOnly` with `root` marked read-only (`true`) or writable (`false`). */
export const setKind = (roots: string[], readOnly: string[], root: string, ro: boolean) =>
  roots.filter((r) => (r === root ? ro : readOnly.includes(r)));
/** Both lists without `root` — sent together in one save (the seam reads a left-out `readOnly` as none). */
export const withoutRoot = (roots: string[], readOnly: string[], root: string) => {
  const next = roots.filter((r) => r !== root);
  return { roots: next, readOnly: keepReadOnly(next, readOnly) };
};
