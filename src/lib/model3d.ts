import type { BoxParams, Layout, PanelKind } from "./geometry.ts";

/**
 * Turns a flat {@link Layout} into the assembled box as a set of positioned
 * slabs: walls up, bottom flaps folded and lapped, top flaps splayed open.
 *
 * Millimetres throughout, Y up, footprint centred on the origin, resting on
 * Y = 0. Pure — no three.js here, so the fold can be asserted in Node the same
 * way `computeLayout` is.
 */

/** Shade of a slab, so the lap order and the interior read at a glance. */
export type Tone = "outer" | "inner";

export interface Slab {
  id: string;
  label: string;
  kind: PanelKind;
  tone: Tone;
  size: [number, number, number];
  position: [number, number, number];
  rotation: [number, number, number];
}

export interface BoxModel {
  slabs: Slab[];
  /** Overall bounding extent, used to frame the camera. */
  extent: [number, number, number];
  /** True when the front and back flaps are the pair that butts in the middle. */
  frontBackIsOuter: boolean;
}

const SPLAY = Math.PI / 4;
/** Horizontal and vertical reach of a flap hinged open at 45°. */
const REACH = Math.SQRT1_2;
/**
 * Millimetres trimmed off each flap of the pair that would otherwise meet
 * dead-on, opening the seam between them to 2 mm. Real board needs clearance
 * here too, or the two fight at the fold.
 */
const CLEARANCE = 1;

export function buildModel(layout: Layout, params: BoxParams): BoxModel {
  const { length: L, width: W, height: H } = layout.exterior;
  const { flapHeight } = layout;
  const t = params.cardboardThickness;

  // Mid-planes of the four walls, which is where every flap is hinged.
  const midX = L / 2 - t / 2;
  const midZ = W / 2 - t / 2;
  // Flaps are inset by one board at each end so they clear the standing walls
  // they fold between — the relief a real die-cut slot provides.
  const flapL = Math.max(L - 2 * t, 0);
  const flapW = Math.max(W - 2 * t, 0);

  // The pair spanning the shorter footprint axis is the pair that butts in the
  // middle, and in a real RSC that pair is the outer one, taped along the seam.
  const frontBackIsOuter = W <= L;
  const outerY = t / 2;
  const innerY = t + t / 2;
  const frontBackY = frontBackIsOuter ? outerY : innerY;
  const sideY = frontBackIsOuter ? innerY : outerY;
  const frontBackTone: Tone = frontBackIsOuter ? "outer" : "inner";
  const sideTone: Tone = frontBackIsOuter ? "inner" : "outer";

  const slabs: Slab[] = [];

  // --- Walls ---------------------------------------------------------------
  // Front and back span the full length; the sides fit between them.
  slabs.push(
    wall("wall-front", "Front", [L, H, t], [0, H / 2, midZ]),
    wall("wall-back", "Back", [L, H, t], [0, H / 2, -midZ]),
    wall("wall-right", "Side", [t, H, flapW], [midX, H / 2, 0]),
    wall("wall-left", "Side", [t, H, flapW], [-midX, H / 2, 0]),
  );

  // --- Bottom flaps --------------------------------------------------------
  // A flap starts at the *inner* face of the wall it hangs from. Running it to
  // the outer plane instead would bury one board's depth inside the wall, and
  // the two would share an outer face and a bottom face — which z-fights.
  const flapDepth = Math.max(flapHeight - t, 0);

  // A pair that meets dead-on renders as one unbroken surface, so the seam —
  // the thing the lap order is read from — disappears. Taking CLEARANCE off
  // each of those two opens it up. Only the pair that would actually touch is
  // trimmed, so the other keeps `layout.flapGap` exactly as the summary reports.
  const frontBackDepth = Math.max(flapDepth - (W <= L ? CLEARANCE : 0), 0);
  const sideDepth = Math.max(flapDepth - (L <= W ? CLEARANCE : 0), 0);

  // Near edge pinned to the wall's inner face; only the tip moves.
  const reachZ = W / 2 - t - frontBackDepth / 2;
  const reachX = L / 2 - t - sideDepth / 2;

  slabs.push(
    flap(
      "flap-bottom-front",
      "Front flap",
      frontBackTone,
      [flapL, t, frontBackDepth],
      [0, frontBackY, reachZ],
    ),
    flap(
      "flap-bottom-back",
      "Back flap",
      frontBackTone,
      [flapL, t, frontBackDepth],
      [0, frontBackY, -reachZ],
    ),
    flap(
      "flap-bottom-right",
      "Side flap",
      sideTone,
      [sideDepth, t, flapW],
      [reachX, sideY, 0],
    ),
    flap(
      "flap-bottom-left",
      "Side flap",
      sideTone,
      [sideDepth, t, flapW],
      [-reachX, sideY, 0],
    ),
  );

  // --- Top flaps, splayed 45° outward --------------------------------------
  const rise = (flapHeight / 2) * REACH;
  const topY = H + rise;

  slabs.push(
    topFlap(
      "flap-top-front",
      "Front flap",
      [flapL, flapHeight, t],
      [0, topY, midZ + rise],
      [SPLAY, 0, 0],
    ),
    topFlap(
      "flap-top-back",
      "Back flap",
      [flapL, flapHeight, t],
      [0, topY, -(midZ + rise)],
      [-SPLAY, 0, 0],
    ),
    topFlap(
      "flap-top-right",
      "Side flap",
      [t, flapHeight, flapW],
      [midX + rise, topY, 0],
      [0, 0, -SPLAY],
    ),
    topFlap(
      "flap-top-left",
      "Side flap",
      [t, flapHeight, flapW],
      [-(midX + rise), topY, 0],
      [0, 0, SPLAY],
    ),
  );

  // --- Glue tab ------------------------------------------------------------
  // In the blank the tab hangs off the front panel's left edge, which is the
  // edge the last side panel closes against, so it lies inside that side wall.
  //
  // It starts above the folded bottom rather than at y = 0. Run to the floor it
  // would pass through both flap layers and share its downward face with them,
  // which z-fights when the box is viewed from below. Resting it on the stack
  // is also the truer read: the flaps fold in underneath the tab.
  if (params.glueTab) {
    const depth = Math.min(params.glueTabWidth, flapW);
    const base = 2 * t;
    const height = Math.max(H - base, 0);
    slabs.push({
      id: "tab",
      label: "Glue tab",
      kind: "tab",
      tone: "inner",
      size: [t, height, depth],
      position: [-(L / 2 - 1.5 * t), base + height / 2, W / 2 - t - depth / 2],
      rotation: [0, 0, 0],
    });
  }

  const splayReach = flapHeight * REACH;

  return {
    slabs,
    extent: [L + 2 * splayReach, H + splayReach, W + 2 * splayReach],
    frontBackIsOuter,
  };
}

function wall(
  id: string,
  label: string,
  size: [number, number, number],
  position: [number, number, number],
): Slab {
  return {
    id,
    label,
    kind: "wall",
    tone: "outer",
    size,
    position,
    rotation: [0, 0, 0],
  };
}

function flap(
  id: string,
  label: string,
  tone: Tone,
  size: [number, number, number],
  position: [number, number, number],
): Slab {
  return { id, label, kind: "flap", tone, size, position, rotation: [0, 0, 0] };
}

function topFlap(
  id: string,
  label: string,
  size: [number, number, number],
  position: [number, number, number],
  rotation: [number, number, number],
): Slab {
  return {
    id,
    label,
    kind: "flap",
    tone: "outer",
    size,
    position,
    rotation,
  };
}
