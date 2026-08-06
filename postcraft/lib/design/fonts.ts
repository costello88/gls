import { readFileSync } from "fs";
import path from "path";

export interface FontEntry {
  name: string;
  data: Buffer;
  weight: 400 | 600 | 700;
  style: "normal" | "italic";
}

let cache: FontEntry[] | null = null;

/** Bundled woff files — satori embeds glyph paths, so no system fonts are needed at runtime. */
export function loadFonts(): FontEntry[] {
  if (cache) return cache;
  const dir = path.join(process.cwd(), "lib", "design", "fonts");
  cache = [
    { name: "Inter", data: readFileSync(path.join(dir, "inter-400.woff")), weight: 400, style: "normal" },
    { name: "Inter", data: readFileSync(path.join(dir, "inter-700.woff")), weight: 700, style: "normal" },
    { name: "Fraunces", data: readFileSync(path.join(dir, "fraunces-600.woff")), weight: 600, style: "normal" },
    { name: "Fraunces", data: readFileSync(path.join(dir, "fraunces-400-italic.woff")), weight: 400, style: "italic" },
  ];
  return cache;
}
