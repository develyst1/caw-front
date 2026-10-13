import { describe, expect, test } from "bun:test";
import { canAdd, isValidRoot, MAX_ROOT_LENGTH, MAX_ROOTS } from "./roots";

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
