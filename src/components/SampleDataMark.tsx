// ข้อมูลตัวอย่าง — ไม่ได้ต่อกับ CAW จริง (D-058, TASK-B-059): on sample data (CAW_API=mock) every page says so, in a slim bar that stays at the
// top while the page scrolls. On http there is no element at all. Server-rendered and read per request (`connection()`), so a build made on
// one mode never shows the other's answer and there is no client flash. It sits in the root layout, outside CawRoot, so it carries the
// colour variables (both schemes, tokens.ts) and the font itself.
import { connection } from "next/server";
import { onSampleData } from "@/api";
import { themeCss } from "@/theme/tokens";
import { sampleData, sampleDataHint } from "@/words";
import s from "./sample-data.module.css";

// the hint's command part (after "ใช้ข้อมูลจริง: ") is set as code — something to type (TASK-B-060); the words are the REQ's, split, not new
const [hintLabel, hintCommand] = [sampleDataHint.slice(0, sampleDataHint.indexOf(": ") + 2), sampleDataHint.slice(sampleDataHint.indexOf(": ") + 2)];

export async function SampleDataMark() {
  await connection();
  if (!onSampleData()) return null;
  return (
    <>
    <style>{themeCss()}</style>
    <p className={s.mark} role="status" data-sample-data>
      <span>{sampleData}</span>
      <span className={s.hint}>{hintLabel}<code className={s.code}>{hintCommand}</code></span>
    </p>
    </>
  );
}
