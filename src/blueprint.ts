// Where "open this part in Blueprint" goes (REQ-011 R3): a link a screen builds from the project's `blueprintProjectId` and the card's
// anchor key — caw-back sends no URL (CardContext has none), and CAW never fetches Blueprint itself.
const BLUEPRINT_URL = process.env.BLUEPRINT_URL || "http://127.0.0.1:3100";

export const blueprintPartHref = (blueprintProjectId: string, key: string) =>
  `${BLUEPRINT_URL}/p/${blueprintProjectId}/web?part=${encodeURIComponent(key)}`;
