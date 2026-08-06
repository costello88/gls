import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { loadFonts } from "./fonts";
import { getTemplate, type TemplateBrief } from "./templates";
import { SURFACE_DIMENSIONS } from "@/lib/types";

export type RenderFormat = "feed" | "story";

/** Dominant color of the photo, nudged toward something usable as an accent. */
export async function dominantColor(imageBuf: Buffer): Promise<string> {
  try {
    const { dominant } = await sharp(imageBuf).stats();
    const { r, g, b } = dominant;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturationish = max === 0 ? 0 : (max - min) / max;
    // Too gray or too dark to carry a design — fall back to the house accent.
    if (saturationish < 0.25 || max < 60) return "#ff4d1c";
    // Brighten toward a poster-worthy tone.
    const boost = (v: number) => Math.min(255, Math.round(v * (200 / max)));
    return `#${[boost(r), boost(g), boost(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  } catch {
    return "#ff4d1c";
  }
}

async function overlayPng(
  templateKey: string,
  width: number,
  height: number,
  brief: TemplateBrief,
): Promise<Buffer> {
  const template = getTemplate(templateKey);
  if (!template) throw new Error(`Unknown template: ${templateKey}`);
  const svg = await satori(template.tree(width, height, brief) as Parameters<typeof satori>[0], {
    width,
    height,
    fonts: loadFonts() as unknown as Parameters<typeof satori>[1]["fonts"],
  });
  return new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng();
}

/**
 * Render one template over/around the photo. Output is always JPEG
 * (Instagram rejects PNG) at the exact surface dimensions.
 */
export async function renderTemplate(
  imageBuf: Buffer,
  templateKey: string,
  brief: TemplateBrief,
  format: RenderFormat,
): Promise<Buffer> {
  const template = getTemplate(templateKey);
  if (!template) throw new Error(`Unknown template: ${templateKey}`);
  const { width, height } = SURFACE_DIMENSIONS[format];

  let photo = sharp(imageBuf).rotate(); // respect EXIF orientation
  const t = template.photo;
  if (t.grayscale) photo = photo.grayscale();
  if (t.brightness || t.saturation) {
    photo = photo.modulate({ brightness: t.brightness ?? 1, saturation: t.saturation ?? 1 });
  }

  const overlay = await overlayPng(templateKey, width, height, brief);

  if (template.mode === "overlay") {
    const base = await photo.resize(width, height, { fit: "cover" }).toBuffer();
    return sharp(base)
      .composite([{ input: overlay }])
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();
  }

  // window mode: overlay is the base; photo is placed into its rect on top.
  const rect = template.photoRect!(width, height);
  const photoBuf = await photo.resize(rect.width, rect.height, { fit: "cover" }).toBuffer();
  return sharp(overlay)
    .composite([{ input: photoBuf, left: rect.left, top: rect.top }])
    .flatten({ background: "#0a0a0c" })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}

/** Normalize any AI-generated image to Instagram-ready JPEG at surface dimensions. */
export async function normalizeToFormat(imageBuf: Buffer, format: RenderFormat): Promise<Buffer> {
  const { width, height } = SURFACE_DIMENSIONS[format];
  return sharp(imageBuf)
    .resize(width, height, { fit: "cover" })
    .flatten({ background: "#0a0a0c" })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}
