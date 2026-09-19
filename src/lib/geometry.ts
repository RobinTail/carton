/**
 * Flat-layout geometry for a regular slotted container (RSC).
 *
 * The sheet is laid out left to right as
 *   [glue tab] [front] [side] [back] [side]
 * with a row of flaps above and below the four wall panels. All values are
 * millimetres; the origin is the top-left corner of the sheet.
 */

export interface BoxParams {
  /** Clear interior length, measured inside the damping liner. */
  interiorLength: number;
  interiorWidth: number;
  interiorHeight: number;
  /** Thickness of a single cardboard wall. */
  cardboardThickness: number;
  /** Thickness of the damping liner, applied to all six interior faces. */
  dampingThickness: number;
  /** Whether the sheet carries a glue tab on its left edge. */
  glueTab: boolean;
  glueTabWidth: number;
}

export type PanelKind = "wall" | "flap" | "tab";

export interface Panel {
  id: string;
  label: string;
  kind: PanelKind;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FoldLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Layout {
  sheetWidth: number;
  sheetHeight: number;
  /** Outside dimensions of the folded box. */
  exterior: { length: number; width: number; height: number };
  /** Height of a single flap; two opposing flaps butt in the middle. */
  flapHeight: number;
  /** SVG path `d` strings for every cut line. */
  cuts: string[];
  folds: FoldLine[];
  panels: Panel[];
  /** X ordinates of the vertical bands: tab | front | side | back | side. */
  columns: number[];
  /** Y ordinates of the horizontal bands: top flaps | walls | bottom flaps. */
  rows: number[];
}

export const DEFAULT_PARAMS: BoxParams = {
  interiorLength: 300,
  interiorWidth: 200,
  interiorHeight: 150,
  cardboardThickness: 3,
  dampingThickness: 5,
  glueTab: true,
  glueTabWidth: 30,
};

export type ParamErrors = Partial<Record<keyof BoxParams, string>>;

/** Blocking problems — the layout cannot be drawn while any of these are present. */
export function validate(params: BoxParams): ParamErrors {
  const errors: ParamErrors = {};

  const positive = [
    "interiorLength",
    "interiorWidth",
    "interiorHeight",
  ] as const;
  for (const key of positive) {
    const value = params[key];
    if (!Number.isFinite(value)) errors[key] = "Enter a number";
    else if (value <= 0) errors[key] = "Must be greater than 0";
  }

  const nonNegative = ["cardboardThickness", "dampingThickness"] as const;
  for (const key of nonNegative) {
    const value = params[key];
    if (!Number.isFinite(value)) errors[key] = "Enter a number";
    else if (value < 0) errors[key] = "Cannot be negative";
  }

  if (params.glueTab) {
    if (!Number.isFinite(params.glueTabWidth))
      errors.glueTabWidth = "Enter a number";
    else if (params.glueTabWidth <= 0)
      errors.glueTabWidth = "Must be greater than 0";
  }

  return errors;
}

/** Non-blocking advice about a layout that is drawable but awkward to assemble. */
export function warn(params: BoxParams, layout: Layout): ParamErrors {
  const warnings: ParamErrors = {};

  if (params.glueTab && params.glueTabWidth > layout.flapHeight) {
    warnings.glueTabWidth =
      "Wider than the flaps — the tab will foul the closure";
  }
  if (params.dampingThickness * 2 >= params.interiorWidth) {
    warnings.dampingThickness = "Liner fills the whole interior width";
  }

  return warnings;
}

/** Snap to micrometre precision so float dust never reaches the SVG output. */
const mm = (value: number) => Math.round(value * 1000) / 1000;

export function computeLayout(params: BoxParams): Layout {
  const {
    interiorLength,
    interiorWidth,
    interiorHeight,
    cardboardThickness,
    dampingThickness,
    glueTab,
    glueTabWidth,
  } = params;

  // Two cardboard walls plus two layers of damping liner on each axis.
  const shell = 2 * dampingThickness + 2 * cardboardThickness;
  const L = mm(interiorLength + shell);
  const W = mm(interiorWidth + shell);
  const H = mm(interiorHeight + shell);
  const flapHeight = mm(W / 2);
  const tab = glueTab ? mm(glueTabWidth) : 0;

  const x0 = 0;
  const x1 = tab;
  const x2 = mm(x1 + L);
  const x3 = mm(x2 + W);
  const x4 = mm(x3 + L);
  const x5 = mm(x4 + W);

  const y0 = 0;
  const y1 = flapHeight;
  const y2 = mm(y1 + H);
  const y3 = mm(y2 + flapHeight);

  const sheetWidth = x5;
  const sheetHeight = y3;

  const cuts: string[] = [];
  const folds: FoldLine[] = [];

  if (glueTab) {
    // Chamfered outer profile of the tab; the right-hand side is a fold, not a cut.
    const chamfer = mm(Math.min(tab, flapHeight * 0.5));
    cuts.push(
      `M ${x1} ${y1} L ${x0} ${mm(y1 + chamfer)} L ${x0} ${mm(y2 - chamfer)} L ${x1} ${y2}`,
    );
    folds.push({ x1, y1, x2: x1, y2 });
  } else {
    // Without a tab the left edge of the front panel is an open edge.
    cuts.push(`M ${x1} ${y1} L ${x1} ${y2}`);
  }

  // Outer perimeter of the top and bottom flap rows.
  cuts.push(`M ${x1} ${y1} L ${x1} ${y0} L ${x5} ${y0} L ${x5} ${y1}`);
  cuts.push(`M ${x1} ${y2} L ${x1} ${y3} L ${x5} ${y3} L ${x5} ${y2}`);

  // Far right edge, glued to the tab (or left open when there is none).
  cuts.push(`M ${x5} ${y1} L ${x5} ${y2}`);

  // Slots separating adjacent flaps, stopping exactly at the horizontal folds.
  const seams = [x2, x3, x4];
  for (const x of seams) {
    cuts.push(`M ${x} ${y0} L ${x} ${y1}`);
    cuts.push(`M ${x} ${y2} L ${x} ${y3}`);
    folds.push({ x1: x, y1, x2: x, y2 });
  }

  // Flap hinges, spanning the wall panels only.
  folds.push({ x1, y1, x2: x5, y2: y1 });
  folds.push({ x1, y1: y2, x2: x5, y2 });

  const wallLabels = ["Front", "Side", "Back", "Side"];
  const wallBounds = [
    [x1, x2],
    [x2, x3],
    [x3, x4],
    [x4, x5],
  ];

  const panels: Panel[] = [];

  if (glueTab) {
    panels.push({
      id: "tab",
      label: "Glue tab",
      kind: "tab",
      x: x0,
      y: y1,
      width: tab,
      height: H,
    });
  }

  wallBounds.forEach(([start, end], index) => {
    const label = wallLabels[index];
    const width = end - start;
    panels.push({
      id: `wall-${index}`,
      label,
      kind: "wall",
      x: start,
      y: y1,
      width,
      height: H,
    });
    panels.push({
      id: `flap-top-${index}`,
      label: `${label} flap`,
      kind: "flap",
      x: start,
      y: y0,
      width,
      height: flapHeight,
    });
    panels.push({
      id: `flap-bottom-${index}`,
      label: `${label} flap`,
      kind: "flap",
      x: start,
      y: y2,
      width,
      height: flapHeight,
    });
  });

  return {
    sheetWidth,
    sheetHeight,
    exterior: { length: L, width: W, height: H },
    flapHeight,
    cuts,
    folds,
    panels,
    columns: [x0, x1, x2, x3, x4, x5],
    rows: [y0, y1, y2, y3],
  };
}
