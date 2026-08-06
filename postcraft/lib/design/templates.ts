/**
 * The local design template engine — 8 hand-designed layouts that turn one
 * photo + a headline into finished Instagram graphics. Deterministic, free,
 * and always available regardless of AI provider keys.
 */

import { h as el, type SatoriElement } from "./el";

export interface TemplateBrief {
  headline: string;
  sub?: string;
  accent: string; // hex, derived from the photo's dominant color or brand
  username?: string;
}

export interface PhotoTreatment {
  brightness?: number; // sharp modulate
  saturation?: number;
  grayscale?: boolean;
}

export interface TemplateSpec {
  key: string;
  label: string;
  /** overlay: photo is full-bleed under the rendered tree. window: tree is the base, photo composited into photoRect. */
  mode: "overlay" | "window";
  photo: PhotoTreatment;
  photoRect?: (w: number, h: number) => { left: number; top: number; width: number; height: number };
  tree: (w: number, h: number, brief: TemplateBrief) => SatoriElement;
}

const INK = "#0a0a0c";
const PAPER = "#f4f1ea";

/** Scale helper: templates are designed against 1080-wide canvases. */
const s = (w: number, v: number) => Math.round((v * w) / 1080);

function fit(headline: string, base: number, w: number): number {
  // Shrink type for long headlines so nothing clips.
  const len = headline.length;
  const factor = len <= 18 ? 1 : len <= 32 ? 0.78 : len <= 48 ? 0.6 : 0.48;
  return Math.round(s(w, base) * factor);
}

export const TEMPLATES: TemplateSpec[] = [
  {
    key: "scrim-headline",
    label: "Scrim",
    mode: "overlay",
    photo: { brightness: 1.02, saturation: 1.05 },
    tree: (w, h, b) =>
      h_root(w, h, [
        el("div", {
          position: "absolute",
          left: 0,
          top: `${Math.round(h * 0.55)}px`,
          width: `${w}px`,
          height: `${h - Math.round(h * 0.55)}px`,
          background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.82) 70%)",
        }),
        el(
          "div",
          {
            position: "absolute",
            left: `${s(w, 72)}px`,
            bottom: `${s(w, 84)}px`,
            width: `${w - s(w, 144)}px`,
            display: "flex",
            flexDirection: "column",
          },
          el("div", { width: `${s(w, 88)}px`, height: `${s(w, 10)}px`, background: b.accent, marginBottom: `${s(w, 36)}px` }),
          el(
            "div",
            {
              fontFamily: "Fraunces",
              fontWeight: 600,
              fontSize: `${fit(b.headline, 104, w)}px`,
              color: "#ffffff",
              lineHeight: 1.05,
              letterSpacing: "-0.01em",
            },
            b.headline,
          ),
          b.sub
            ? el(
                "div",
                {
                  fontFamily: "Inter",
                  fontSize: `${s(w, 34)}px`,
                  color: "rgba(255,255,255,0.78)",
                  marginTop: `${s(w, 28)}px`,
                  lineHeight: 1.4,
                },
                b.sub,
              )
            : null,
        ),
      ]),
  },

  {
    key: "editorial-frame",
    label: "Editorial",
    mode: "overlay",
    photo: { brightness: 0.62, saturation: 0.82 },
    tree: (w, h, b) =>
      h_root(w, h, [
        el("div", {
          position: "absolute",
          left: `${s(w, 48)}px`,
          top: `${s(w, 48)}px`,
          width: `${w - s(w, 96)}px`,
          height: `${h - s(w, 96)}px`,
          border: "2px solid rgba(255,255,255,0.85)",
        }),
        el(
          "div",
          {
            position: "absolute",
            left: 0,
            top: `${s(w, 104)}px`,
            width: `${w}px`,
            display: "flex",
            justifyContent: "center",
          },
          el(
            "div",
            {
              fontFamily: "Inter",
              fontWeight: 700,
              fontSize: `${s(w, 26)}px`,
              letterSpacing: "0.32em",
              color: b.accent,
            },
            (b.username ? `@${b.username}` : "FEATURED").toUpperCase(),
          ),
        ),
        el(
          "div",
          {
            position: "absolute",
            left: `${s(w, 110)}px`,
            top: 0,
            width: `${w - s(w, 220)}px`,
            height: `${h}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          },
          el(
            "div",
            {
              fontFamily: "Fraunces",
              fontWeight: 600,
              fontSize: `${fit(b.headline, 96, w)}px`,
              color: "#ffffff",
              lineHeight: 1.12,
              textAlign: "center",
            },
            b.headline,
          ),
        ),
        b.sub
          ? el(
              "div",
              {
                position: "absolute",
                left: 0,
                bottom: `${s(w, 110)}px`,
                width: `${w}px`,
                display: "flex",
                justifyContent: "center",
              },
              el(
                "div",
                { fontFamily: "Inter", fontSize: `${s(w, 30)}px`, color: "rgba(255,255,255,0.75)" },
                b.sub,
              ),
            )
          : null,
      ]),
  },

  {
    key: "badge-pop",
    label: "Badge",
    mode: "overlay",
    photo: { brightness: 1.04, saturation: 1.12 },
    tree: (w, h, b) =>
      h_root(w, h, [
        el(
          "div",
          {
            position: "absolute",
            right: `${s(w, 64)}px`,
            top: `${s(w, 64)}px`,
            width: `${s(w, 210)}px`,
            height: `${s(w, 210)}px`,
            borderRadius: "50%",
            background: b.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: "rotate(-10deg)",
          },
          el(
            "div",
            {
              fontFamily: "Inter",
              fontWeight: 700,
              fontSize: `${s(w, 40)}px`,
              letterSpacing: "0.06em",
              color: INK,
              textAlign: "center",
            },
            badgeText(b),
          ),
        ),
        el(
          "div",
          {
            position: "absolute",
            left: `${s(w, 56)}px`,
            bottom: `${s(w, 72)}px`,
            maxWidth: `${w - s(w, 200)}px`,
            background: "#ffffff",
            borderLeft: `${s(w, 14)}px solid ${b.accent}`,
            padding: `${s(w, 40)}px ${s(w, 48)}px`,
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
          },
          el(
            "div",
            {
              fontFamily: "Fraunces",
              fontWeight: 600,
              fontSize: `${fit(b.headline, 72, w)}px`,
              color: INK,
              lineHeight: 1.1,
            },
            b.headline,
          ),
          b.sub
            ? el(
                "div",
                { fontFamily: "Inter", fontSize: `${s(w, 30)}px`, color: "#55524b", marginTop: `${s(w, 18)}px` },
                b.sub,
              )
            : null,
        ),
      ]),
  },

  {
    key: "split-panel",
    label: "Split",
    mode: "window",
    photo: { saturation: 1.06 },
    photoRect: (w, h) => ({ left: 0, top: 0, width: w, height: Math.round(h * 0.62) }),
    tree: (w, h, b) => {
      const panelTop = Math.round(h * 0.62);
      return h_root(w, h, [
        el("div", { position: "absolute", left: 0, top: 0, width: `${w}px`, height: `${h}px`, background: INK }),
        el(
          "div",
          {
            position: "absolute",
            left: `${s(w, 72)}px`,
            top: `${panelTop + s(w, 64)}px`,
            width: `${w - s(w, 144)}px`,
            display: "flex",
            flexDirection: "column",
          },
          el(
            "div",
            {
              fontFamily: "Fraunces",
              fontWeight: 600,
              fontSize: `${fit(b.headline, 88, w)}px`,
              color: PAPER,
              lineHeight: 1.08,
            },
            b.headline,
          ),
          el("div", { width: `${s(w, 120)}px`, height: `${s(w, 10)}px`, background: b.accent, marginTop: `${s(w, 36)}px` }),
          b.sub
            ? el(
                "div",
                {
                  fontFamily: "Inter",
                  fontSize: `${s(w, 32)}px`,
                  color: "rgba(244,241,234,0.65)",
                  marginTop: `${s(w, 30)}px`,
                  lineHeight: 1.45,
                },
                b.sub,
              )
            : null,
        ),
        b.username
          ? el(
              "div",
              {
                position: "absolute",
                right: `${s(w, 72)}px`,
                bottom: `${s(w, 52)}px`,
                fontFamily: "Inter",
                fontWeight: 700,
                fontSize: `${s(w, 24)}px`,
                letterSpacing: "0.22em",
                color: "rgba(244,241,234,0.5)",
              },
              `@${b.username}`.toUpperCase(),
            )
          : null,
      ]);
    },
  },

  {
    key: "polaroid",
    label: "Polaroid",
    mode: "window",
    photo: { saturation: 0.96 },
    photoRect: (w, h) => {
      const m = s(w, 110);
      const pw = w - m * 2;
      const ph = Math.round(Math.min(pw, h * 0.62));
      return { left: m, top: s(w, 150), width: pw, height: ph };
    },
    tree: (w, h, b) => {
      const m = s(w, 110);
      const pw = w - m * 2;
      const ph = Math.round(Math.min(pw, h * 0.62));
      return h_root(w, h, [
        el("div", { position: "absolute", left: 0, top: 0, width: `${w}px`, height: `${h}px`, background: PAPER }),
        el("div", {
          position: "absolute",
          left: `${m - s(w, 26)}px`,
          top: `${s(w, 150) - s(w, 26)}px`,
          width: `${pw + s(w, 52)}px`,
          height: `${ph + s(w, 52)}px`,
          background: "#ffffff",
          boxShadow: "0 30px 80px rgba(10,10,12,0.22)",
        }),
        el(
          "div",
          {
            position: "absolute",
            left: `${m}px`,
            top: `${s(w, 150) + ph + s(w, 70)}px`,
            width: `${pw}px`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          },
          el(
            "div",
            {
              fontFamily: "Fraunces",
              fontStyle: "italic",
              fontSize: `${fit(b.headline, 64, w)}px`,
              color: INK,
              textAlign: "center",
              lineHeight: 1.2,
            },
            b.headline,
          ),
          el(
            "div",
            {
              fontFamily: "Inter",
              fontWeight: 700,
              fontSize: `${s(w, 22)}px`,
              letterSpacing: "0.3em",
              color: b.accent,
              marginTop: `${s(w, 30)}px`,
            },
            (b.sub ?? (b.username ? `@${b.username}` : "")).toUpperCase(),
          ),
        ),
      ]);
    },
  },

  {
    key: "neon-echo",
    label: "Neon",
    mode: "overlay",
    photo: { brightness: 0.55, saturation: 1.25 },
    tree: (w, h, b) => {
      const size = fit(b.headline, 128, w);
      const top = Math.round(h * 0.4);
      return h_root(w, h, [
        el(
          "div",
          {
            position: "absolute",
            left: `${s(w, 66)}px`,
            top: `${top + s(w, 10)}px`,
            width: `${w - s(w, 120)}px`,
            fontFamily: "Inter",
            fontWeight: 700,
            fontSize: `${size}px`,
            lineHeight: 1.02,
            color: "rgba(255,255,255,0.28)",
          },
          b.headline.toUpperCase(),
        ),
        el(
          "div",
          {
            position: "absolute",
            left: `${s(w, 56)}px`,
            top: `${top}px`,
            width: `${w - s(w, 120)}px`,
            fontFamily: "Inter",
            fontWeight: 700,
            fontSize: `${size}px`,
            lineHeight: 1.02,
            color: b.accent,
          },
          b.headline.toUpperCase(),
        ),
        b.sub
          ? el(
              "div",
              {
                position: "absolute",
                left: `${s(w, 60)}px`,
                bottom: `${s(w, 80)}px`,
                fontFamily: "Inter",
                fontSize: `${s(w, 30)}px`,
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.85)",
              },
              b.sub.toUpperCase(),
            )
          : null,
      ]);
    },
  },

  {
    key: "caption-bar",
    label: "Caption bar",
    mode: "overlay",
    photo: { brightness: 1.0, saturation: 1.04 },
    tree: (w, h, b) =>
      h_root(w, h, [
        el(
          "div",
          {
            position: "absolute",
            left: 0,
            bottom: 0,
            width: `${w}px`,
            padding: `${s(w, 34)}px ${s(w, 56)}px`,
            background: "rgba(10,10,12,0.88)",
            display: "flex",
            alignItems: "center",
          },
          el("div", {
            width: `${s(w, 18)}px`,
            height: `${s(w, 18)}px`,
            borderRadius: "50%",
            background: b.accent,
            marginRight: `${s(w, 28)}px`,
          }),
          el(
            "div",
            {
              fontFamily: "Inter",
              fontWeight: 700,
              fontSize: `${s(w, 34)}px`,
              color: PAPER,
              flexGrow: 1,
            },
            b.headline,
          ),
          b.username
            ? el(
                "div",
                {
                  fontFamily: "Inter",
                  fontSize: `${s(w, 24)}px`,
                  letterSpacing: "0.14em",
                  color: "rgba(244,241,234,0.55)",
                },
                `@${b.username}`,
              )
            : null,
        ),
      ]),
  },

  {
    key: "type-stack",
    label: "Type stack",
    mode: "window",
    photo: { saturation: 1.08 },
    photoRect: (w, h) => {
      const pw = Math.round(w * 0.56);
      const ph = Math.round(h * 0.46);
      return { left: w - pw - s(w, 64), top: h - ph - s(w, 120), width: pw, height: ph };
    },
    tree: (w, h, b) => {
      const words = b.headline.split(/\s+/).slice(0, 4);
      return h_root(w, h, [
        el("div", { position: "absolute", left: 0, top: 0, width: `${w}px`, height: `${h}px`, background: INK }),
        el(
          "div",
          {
            position: "absolute",
            left: `${s(w, 64)}px`,
            top: `${s(w, 72)}px`,
            fontFamily: "Inter",
            fontWeight: 700,
            fontSize: `${s(w, 24)}px`,
            letterSpacing: "0.3em",
            color: "rgba(244,241,234,0.5)",
          },
          (b.username ? `@${b.username}` : "POSTCRAFT").toUpperCase(),
        ),
        el(
          "div",
          {
            position: "absolute",
            left: `${s(w, 60)}px`,
            top: `${s(w, 150)}px`,
            width: `${w - s(w, 120)}px`,
            display: "flex",
            flexDirection: "column",
          },
          ...words.map((word, i) =>
            el(
              "div",
              {
                fontFamily: "Fraunces",
                fontWeight: 600,
                fontSize: `${fit(words.join(" "), 116, w)}px`,
                lineHeight: 1.04,
                color: i === 0 ? b.accent : PAPER,
              },
              word,
            ),
          ),
        ),
        b.sub
          ? el(
              "div",
              {
                position: "absolute",
                left: `${s(w, 64)}px`,
                bottom: `${s(w, 64)}px`,
                width: `${Math.round(w * 0.34)}px`,
                fontFamily: "Inter",
                fontSize: `${s(w, 28)}px`,
                lineHeight: 1.45,
                color: "rgba(244,241,234,0.65)",
              },
              b.sub,
            )
          : null,
      ]);
    },
  },
];

function badgeText(b: TemplateBrief): string {
  const raw = (b.sub ?? "NEW").trim();
  const first = raw.split(/\s+/).slice(0, 2).join(" ");
  return (first.length <= 10 ? first : "NEW").toUpperCase();
}

function h_root(w: number, hgt: number, children: Array<SatoriElement | null>): SatoriElement {
  return el(
    "div",
    {
      display: "flex",
      position: "relative",
      width: `${w}px`,
      height: `${hgt}px`,
    },
    ...children,
  );
}

export function getTemplate(key: string): TemplateSpec | undefined {
  return TEMPLATES.find((t) => t.key === key);
}
