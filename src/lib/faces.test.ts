// The one list of faces (TASK-B-070's set, approved by the operator 2026-10-14) and the face a worker shows: the stored ids when all three are known,
// else one derived from the name — computed, never stored (rule §9). The core keeps no list (SPEC-A-008 § v1.12), so an id it stored and this list no
// longer has must never draw a broken face.
import { describe, expect, test } from "bun:test";
import type { Worker } from "@/api/caw";
import { BODIES, COLORS, deriveFace, EYES, faceFor, isKnownFace, STARTING_FACES } from "./faces";

const worker = (name: string, avatar: Worker["avatar"] = null): Pick<Worker, "name" | "avatar"> => ({ name, avatar });
const key = (f: { body: string; color: string; eyes: string }) => `${f.body}/${f.color}/${f.eyes}`;
const ID = /^[a-z0-9-]{1,24}$/;

describe("the list", () => {
  test("six bodies, eight colours, five eyes — the ids of the approved art — and every id fits the core's shape rule", () => {
    expect([...BODIES]).toEqual(["pebble", "dome", "egg", "gem", "cape", "hex"]);
    expect([...COLORS]).toEqual(["violet", "plum", "magenta", "rose", "olive", "teal", "slate", "ink"]);
    expect([...EYES]).toEqual(["dots", "beans", "smile", "sleepy", "one"]);
    for (const id of [...BODIES, ...COLORS, ...EYES]) expect(id).toMatch(ID);
  });
  test("isKnownFace: all three ids must be in the list", () => {
    expect(isKnownFace({ body: "egg", color: "rose", eyes: "one" })).toBe(true);
    expect(isKnownFace({ body: "egg", color: "rose", eyes: "laser" })).toBe(false);
    expect(isKnownFace({ body: "blob", color: "rose", eyes: "one" })).toBe(false);
    expect(isKnownFace({ body: "egg", color: "chartreuse", eyes: "one" })).toBe(false);
    expect(isKnownFace(null)).toBe(false);
  });
});

describe("deriveFace — from the name", () => {
  test("stable: the same name is the same face, every time; a face is always from the list", () => {
    for (const n of ["ปลา", "Ann", "นักวิเคราะห์", "", "a"]) {
      expect(deriveFace(n)).toEqual(deriveFace(n));
      expect(isKnownFace(deriveFace(n))).toBe(true);
    }
  });
  test("different names spread over the whole set: across 300 names every body, colour and eyes shows up, and no one face takes more than a few percent", () => {
    const faces = Array.from({ length: 300 }, (_, i) => deriveFace(`คนที่ ${i}`));
    expect(new Set(faces.map((f) => f.body)).size).toBe(BODIES.length);
    expect(new Set(faces.map((f) => f.color)).size).toBe(COLORS.length);
    expect(new Set(faces.map((f) => f.eyes)).size).toBe(EYES.length);
    const count = new Map<string, number>();
    for (const f of faces) count.set(key(f), (count.get(key(f)) ?? 0) + 1);
    expect(Math.max(...count.values())).toBeLessThanOrEqual(12); // 240 faces in the set; 300 names
    expect(count.size).toBeGreaterThan(120);
  });
  test("the parts do not move together: the body does not decide the colour", () => {
    const faces = Array.from({ length: 300 }, (_, i) => deriveFace(`n${i}`));
    for (const b of BODIES) expect(new Set(faces.filter((f) => f.body === b).map((f) => f.color)).size).toBeGreaterThan(3);
  });
  test("a name written two ways (composed / decomposed) is the same name", () => {
    expect(deriveFace("é")).toEqual(deriveFace("é"));
  });
});

describe("faceFor", () => {
  test("a stored avatar whose three ids are all known is the face", () => {
    expect(faceFor(worker("ปลา", { body: "gem", color: "ink", eyes: "one" }))).toEqual({ body: "gem", color: "ink", eyes: "one" });
  });
  test("not chosen (null) → derived from the name; the same worker, the same face", () => {
    expect(faceFor(worker("ใบเตย"))).toEqual(deriveFace("ใบเตย"));
    expect(faceFor(worker("ใบเตย"))).toEqual(faceFor(worker("ใบเตย")));
  });
  test("a stored id the list does not have — any one of the three — falls back to the derived face for the whole thing, never a broken one", () => {
    for (const bad of [{ body: "zzz-unknown", color: "teal", eyes: "dots" }, { body: "dome", color: "zzz", eyes: "dots" }, { body: "dome", color: "teal", eyes: "zzz" }]) {
      const f = faceFor(worker("ฝน", bad));
      expect(f).toEqual(deriveFace("ฝน"));
      expect(isKnownFace(f)).toBe(true);
    }
  });
  test("two workers with the same stored face keep it — the face is not made unique for them", () => {
    const face = { body: "egg", color: "rose", eyes: "dots" };
    expect(faceFor(worker("ก", face))).toEqual(faceFor(worker("ข", face)));
  });
});

describe("the starting team's five faces", () => {
  test("ปลา pebble/violet/dots · ใบเตย dome/teal/beans · ฝน egg/magenta/smile · แบงค์ hex/olive/sleepy · มิ้นท์ cape/plum/one — chosen, all different, all in the list", () => {
    expect(Object.entries(STARTING_FACES).map(([n, f]) => [n, key(f)])).toEqual([
      ["ปลา", "pebble/violet/dots"], ["ใบเตย", "dome/teal/beans"], ["ฝน", "egg/magenta/smile"], ["แบงค์", "hex/olive/sleepy"], ["มิ้นท์", "cape/plum/one"],
    ]);
    expect(new Set(Object.values(STARTING_FACES).map(key)).size).toBe(5);
    expect(new Set(Object.values(STARTING_FACES).map((f) => f.body)).size).toBe(5); // five different bodies, too
    expect(Object.values(STARTING_FACES).every(isKnownFace)).toBe(true);
  });
});
