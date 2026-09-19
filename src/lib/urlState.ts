import { DEFAULT_PARAMS, type BoxParams } from "./geometry.ts";

/** Short query keys, so a shared link stays readable. */
const KEYS = {
  interiorLength: "l",
  interiorWidth: "w",
  interiorHeight: "h",
  cardboardThickness: "t",
  dampingThickness: "d",
  glueTabWidth: "tab",
} as const;

/** An absent `tab` key means the glue tab is switched off. */
export function encodeParams(params: BoxParams): string {
  const search = new URLSearchParams();
  search.set(KEYS.interiorLength, String(params.interiorLength));
  search.set(KEYS.interiorWidth, String(params.interiorWidth));
  search.set(KEYS.interiorHeight, String(params.interiorHeight));
  search.set(KEYS.cardboardThickness, String(params.cardboardThickness));
  search.set(KEYS.dampingThickness, String(params.dampingThickness));
  if (params.glueTab)
    search.set(KEYS.glueTabWidth, String(params.glueTabWidth));
  return `?${search}`;
}

export function decodeParams(search: string): BoxParams {
  const query = new URLSearchParams(search);
  if ([...query.keys()].length === 0) return DEFAULT_PARAMS;

  const read = (key: string, fallback: number) => {
    const raw = query.get(key);
    if (raw === null) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  };

  const glueTab = query.has(KEYS.glueTabWidth);

  return {
    interiorLength: read(KEYS.interiorLength, DEFAULT_PARAMS.interiorLength),
    interiorWidth: read(KEYS.interiorWidth, DEFAULT_PARAMS.interiorWidth),
    interiorHeight: read(KEYS.interiorHeight, DEFAULT_PARAMS.interiorHeight),
    cardboardThickness: read(
      KEYS.cardboardThickness,
      DEFAULT_PARAMS.cardboardThickness,
    ),
    dampingThickness: read(
      KEYS.dampingThickness,
      DEFAULT_PARAMS.dampingThickness,
    ),
    glueTab,
    glueTabWidth: read(KEYS.glueTabWidth, DEFAULT_PARAMS.glueTabWidth),
  };
}
