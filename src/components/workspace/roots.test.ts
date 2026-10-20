import { describe, expect, test } from "bun:test";
import { canAdd, folderName, isValidRoot, keepReadOnly, MAX_ROOT_LENGTH, MAX_ROOTS, setKind, withoutRoot } from "./roots";

describe("isValidRoot", () => {
  test("absolute paths pass (POSIX and a Windows drive)", () => {
    for (const p of ["/", "/Users/me/my-repo", "/Users/me/โปรเจกต์", "C:\\work\\repo", "C:/work/repo"]) expect(isValidRoot(p), p).toBe(true);
  });
  test("a relative path, an empty one, a `..` segment, or 501 characters do not", () => {
    for (const p of ["", "repo", "./repo", "~/repo", "../repo", "/Users/me/../you", "C:\\work\\..\\x", `/${"x".repeat(MAX_ROOT_LENGTH)}`]) expect(isValidRoot(p), p).toBe(false);
    expect(isValidRoot(`/${"x".repeat(MAX_ROOT_LENGTH - 1)}`)).toBe(true); // exactly 500
  });
  test("a name that merely contains two dots is not a `..` segment", () => {
    expect(isValidRoot("/Users/me/my..repo")).toBe(true);
  });
});

describe("canAdd", () => {
  test("not a path already there, and not past 20", () => {
    expect(canAdd([], "/a")).toBe(true);
    expect(canAdd(["/a"], "/a")).toBe(false);
    expect(canAdd(["/a"], "a")).toBe(false);
    const full = Array.from({ length: MAX_ROOTS }, (_, i) => `/r${i}`);
    expect(canAdd(full, "/one-more")).toBe(false);
    expect(canAdd(full.slice(1), "/one-more")).toBe(true);
  });
});

// D-098 (TASK-B-104): a folder is named by its last path segment; two with the same last segment add their parent
describe("folderName", () => {
  test("the last segment — a trailing slash and Windows separators too", () => {
    expect(folderName("/Users/me/Develyst/usb-oda", ["/Users/me/Develyst/usb-oda"])).toBe("usb-oda");
    expect(folderName("/Users/me/repo/", ["/Users/me/repo/"])).toBe("repo");
    expect(folderName("C:\\work\\caw-front", ["C:\\work\\caw-front"])).toBe("caw-front");
  });
  test("two roots ending the same way → parent/last for both; a third, different one stays short", () => {
    const all = ["/a/corp-ais/usb-oda", "/b/mine/usb-oda", "/c/caw-front"];
    expect(all.map((r) => folderName(r, all))).toEqual(["corp-ais/usb-oda", "mine/usb-oda", "caw-front"]);
  });
  test("the root itself has no segment — it is shown as it is", () => {
    expect(folderName("/", ["/"])).toBe("/");
  });
});

// D-099 / D-100 (TASK-B-108): readOnly ⊆ roots — every change keeps it so
describe("folder kinds", () => {
  const roots = ["/a/web", "/a/spec", "/a/api"];
  test("setKind marks or unmarks one folder, keeping the roots' order and never a duplicate", () => {
    expect(setKind(roots, [], "/a/spec", true)).toEqual(["/a/spec"]);
    expect(setKind(roots, ["/a/spec"], "/a/spec", true)).toEqual(["/a/spec"]);
    expect(setKind(roots, ["/a/api", "/a/spec"], "/a/web", true)).toEqual(["/a/web", "/a/spec", "/a/api"]);
    expect(setKind(roots, ["/a/spec"], "/a/spec", false)).toEqual([]);
  });
  test("withoutRoot shortens both lists together; keepReadOnly drops what is no longer a root", () => {
    expect(withoutRoot(roots, ["/a/spec"], "/a/spec")).toEqual({ roots: ["/a/web", "/a/api"], readOnly: [] });
    expect(withoutRoot(roots, ["/a/spec"], "/a/web")).toEqual({ roots: ["/a/spec", "/a/api"], readOnly: ["/a/spec"] });
    expect(keepReadOnly(["/a/web"], ["/a/spec", "/a/web"])).toEqual(["/a/web"]);
  });
});
