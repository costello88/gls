/** Tiny helper to build satori element trees without JSX. */

export interface SatoriElement {
  type: string;
  props: Record<string, unknown> & { children?: SatoriChild | SatoriChild[] };
}

export type SatoriChild = SatoriElement | string | null;

export function h(
  type: string,
  style: Record<string, string | number> = {},
  ...children: SatoriChild[]
): SatoriElement {
  const props: SatoriElement["props"] = { style };
  const kids = children.filter((c): c is SatoriElement | string => c !== null && c !== "");
  if (kids.length === 1) props.children = kids[0];
  else if (kids.length > 1) props.children = kids;
  return { type, props };
}
