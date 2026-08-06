/** Smoke test: render all 8 templates against a generated fixture photo. */
import sharp from "sharp";
import { writeFileSync, mkdirSync } from "fs";
import { TEMPLATES } from "@/lib/design/templates";
import { renderTemplate, dominantColor } from "@/lib/design/render";

async function main() {
  // Fixture: warm gradient "photo" with a circle subject.
  const svg = `<svg width="1600" height="1600" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#c2571f"/><stop offset="1" stop-color="#2b1a3a"/>
    </linearGradient></defs>
    <rect width="1600" height="1600" fill="url(#g)"/>
    <circle cx="800" cy="760" r="360" fill="#e8d9c4"/>
    <circle cx="800" cy="760" r="360" fill="none" stroke="#00000033" stroke-width="30"/>
  </svg>`;
  const photo = await sharp(Buffer.from(svg)).jpeg().toBuffer();

  const accent = await dominantColor(photo);
  console.log("dominant accent:", accent);

  mkdirSync("/tmp/design-smoke", { recursive: true });
  for (const t of TEMPLATES) {
    for (const format of ["feed", "story"] as const) {
      const out = await renderTemplate(
        photo,
        t.key,
        { headline: "Summer Drop 24", sub: "Limited run — this week only", accent, username: "postcraft" },
        format,
      );
      const path = `/tmp/design-smoke/${t.key}-${format}.jpg`;
      writeFileSync(path, out);
      const meta = await sharp(out).metadata();
      console.log(`${t.key} ${format}: ${meta.width}x${meta.height} ${meta.format} ${(out.length / 1024).toFixed(0)}KB`);
    }
  }
  console.log("OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
