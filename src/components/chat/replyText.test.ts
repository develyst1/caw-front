// C-2 (TASK-B-100, D-094): a reply that sent an amendment does not repeat the amendment box's sentence, and never shows the Blueprint message id.
import { describe, expect, test } from "bun:test";
import { chat } from "@/words";
import { replyText } from "./Chat";

const amendment = { blueprintMessageId: "c34d320e-1111-4222-8333-444455556666", link: "http://127.0.0.1:3100/p/x/chat" };

describe("replyText", () => {
  test("drops a first line that starts with the amendment sentence, with its id", () => {
    const text = `${chat.notInSpec} (ข้อความ Blueprint: ${amendment.blueprintMessageId})\nเสนอการ์ด 1 ใบ`;
    expect(replyText({ text, amendment })).toBe("เสนอการ์ด 1 ใบ");
    expect(replyText({ text, amendment })).not.toContain(amendment.blueprintMessageId);
  });
  test("leaves the text alone when the reply sent no amendment, or when its first line is something else", () => {
    const text = `${chat.notInSpec}\nอื่น ๆ`;
    expect(replyText({ text, amendment: null })).toBe(text);
    expect(replyText({ text: "สวัสดี\nบรรทัดสอง", amendment })).toBe("สวัสดี\nบรรทัดสอง");
  });
});
