import { Anuphan } from "next/font/google";

// CAW's one family, Anuphan — the same as Blueprint's clean-blue, so moving between the two apps keeps one voice (direction § 1).
export const cawFont = Anuphan({ weight: ["400", "500", "600", "700"], subsets: ["thai", "latin"], display: "swap" });
