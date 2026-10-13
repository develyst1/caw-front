// The workspace folders (`workspace.roots`, SPEC-A-008 v1.1): at most 20, each an absolute path of 1–500 characters with no `..` segment.
// The back end checks the same and is the authority; this lets the editor say "no" before asking.
export const MAX_ROOTS = 20;
export const MAX_ROOT_LENGTH = 500;

const ABSOLUTE = /^(\/|[A-Za-z]:[\\/])/;

export const isValidRoot = (path: string) =>
  path.length >= 1 && path.length <= MAX_ROOT_LENGTH && ABSOLUTE.test(path) && !path.split(/[\\/]/).includes("..");

/** Can `path` be added to `roots`? A valid path that is not already there, with room left. */
export const canAdd = (roots: string[], path: string) => isValidRoot(path) && !roots.includes(path) && roots.length < MAX_ROOTS;
