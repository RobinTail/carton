import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server.browser";
import { FlatLayout } from "../components/FlatLayout.tsx";
import type { BoxParams, Layout } from "./geometry.ts";

/**
 * Serialises the very component the preview renders, so an exported file can
 * never drift from what is on screen. Only the stroke mode differs: a
 * standalone file has no viewport, so widths must be real millimetres.
 */
export function renderStandaloneSvg(layout: Layout, annotate: boolean): string {
  const markup = renderToStaticMarkup(
    createElement(FlatLayout, { layout, annotate, strokeMode: "physical" }),
  );

  // Physical page size, so the file opens at 1:1 in a cutter or a print shop.
  const sized = markup.replace(
    "<svg ",
    `<svg width="${layout.sheetWidth}mm" height="${layout.sheetHeight}mm" `,
  );

  return `<?xml version="1.0" encoding="UTF-8"?>\n${sized}\n`;
}

export function svgFileName(params: BoxParams): string {
  const { interiorLength, interiorWidth, interiorHeight } = params;
  return `carton-${interiorLength}x${interiorWidth}x${interiorHeight}.svg`;
}

export function downloadSvg(
  layout: Layout,
  params: BoxParams,
  annotate: boolean,
): void {
  const blob = new Blob([renderStandaloneSvg(layout, annotate)], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = svgFileName(params);
  anchor.click();
  URL.revokeObjectURL(url);
}
