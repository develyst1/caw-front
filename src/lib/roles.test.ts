// The skills a role brings (REQ-014 R6, SPEC-A-008 § v1.10: the core does not derive skills — the screen fills them from the picked roles).
import { describe, expect, test } from "bun:test";
import { ROLE_SKILLS, skillsFor } from "./roles";

describe("skillsFor", () => {
  test("each role brings its own role skill", () => {
    expect(ROLE_SKILLS).toEqual({ PM: ["role-pm"], BA: ["role-ba"], SA: ["role-sa"], FE: ["role-fe"], BE: ["role-be"], QA: ["role-qa"], other: [] });
  });
  test("the union in the order the roles were picked, no repeats", () => {
    expect(skillsFor(["PM", "BA"])).toEqual(["role-pm", "role-ba"]);
    expect(skillsFor(["BE", "FE"])).toEqual(["role-be", "role-fe"]);
    expect(skillsFor(["FE", "BE", "FE"])).toEqual(["role-fe", "role-be"]);
  });
  test("`other` brings nothing; no roles, no skills", () => {
    expect(skillsFor(["other"])).toEqual([]);
    expect(skillsFor(["QA", "other"])).toEqual(["role-qa"]);
    expect(skillsFor([])).toEqual([]);
  });
});
