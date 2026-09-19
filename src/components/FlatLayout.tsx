import type { Layout, Panel } from "../lib/geometry.ts";
import "./FlatLayout.css";

/**
 * `screen` keeps stroke widths constant in device pixels however far the drawing
 * is scaled down. `physical` uses absolute millimetre widths, which is what a
 * standalone exported file needs — it has no viewport to scale against.
 */
export type StrokeMode = "screen" | "physical";

export interface FlatLayoutProps {
  layout: Layout;
  annotate?: boolean;
  strokeMode?: StrokeMode;
}

const CUT_COLOR = "#111111";
const FOLD_COLOR = "#e0312e";
const ANNOTATION_COLOR = "#8a8a99";

const format = (value: number) => String(Number(value.toFixed(2)));

export function FlatLayout({
  layout,
  annotate = false,
  strokeMode = "screen",
}: FlatLayoutProps) {
  const { sheetWidth, sheetHeight, columns, rows } = layout;

  const span = Math.max(sheetWidth, sheetHeight);
  const breathing = span * 0.02;
  const gutter = span * 0.1;
  const marginLeft = annotate ? gutter : breathing;
  // The bottom chain hangs its labels under each rule, so it needs the deeper gutter.
  const marginBottom = annotate ? gutter * 1.25 : breathing;
  const viewBox = [
    -marginLeft,
    -breathing,
    sheetWidth + marginLeft + breathing,
    sheetHeight + breathing + marginBottom,
  ]
    .map(format)
    .join(" ");

  // In screen mode the numbers are CSS pixels; in physical mode, millimetres.
  const scaling = strokeMode === "screen";
  const cutWidth = scaling ? 1.75 : 0.4;
  const foldWidth = scaling ? 1.25 : 0.25;
  const hairline = scaling ? 1 : 0.2;
  const vectorEffect = scaling ? "non-scaling-stroke" : undefined;
  const dash = scaling
    ? "6 5"
    : `${format(span * 0.008)} ${format(span * 0.007)}`;

  const fontSize = span * 0.019;
  const tick = span * 0.006;

  return (
    <svg
      className="flat-layout"
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      role="img"
      aria-label={`Flat cardboard layout, ${format(sheetWidth)} by ${format(sheetHeight)} millimetres`}
    >
      <g
        className="flat-layout__cuts"
        fill="none"
        stroke={CUT_COLOR}
        strokeWidth={cutWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect={vectorEffect}
      >
        {layout.cuts.map((d) => (
          <path key={d} d={d} vectorEffect={vectorEffect} />
        ))}
      </g>

      <g
        className="flat-layout__folds"
        fill="none"
        stroke={FOLD_COLOR}
        strokeWidth={foldWidth}
        strokeDasharray={dash}
        strokeLinecap="round"
        vectorEffect={vectorEffect}
      >
        {layout.folds.map((fold) => (
          <line
            key={`${fold.x1},${fold.y1},${fold.x2},${fold.y2}`}
            x1={fold.x1}
            y1={fold.y1}
            x2={fold.x2}
            y2={fold.y2}
            vectorEffect={vectorEffect}
          />
        ))}
      </g>

      {annotate && (
        <g
          className="flat-layout__annotations"
          fill={ANNOTATION_COLOR}
          stroke={ANNOTATION_COLOR}
          strokeWidth={hairline}
          fontSize={fontSize}
          fontFamily="system-ui, sans-serif"
          vectorEffect={vectorEffect}
        >
          {layout.panels
            .filter((panel) => panel.kind !== "flap")
            .map((panel) => (
              <PanelLabel key={panel.id} panel={panel} fontSize={fontSize} />
            ))}

          {/* Column widths along the bottom, then the overall sheet width. */}
          {columns.slice(0, -1).map((start, index) => {
            const end = columns[index + 1];
            if (end - start <= 0) return null;
            return (
              <Dimension
                key={`col-${index}`}
                axis="x"
                from={start}
                to={end}
                offset={sheetHeight + gutter * 0.3}
                tick={tick}
                fontSize={fontSize}
                vectorEffect={vectorEffect}
              />
            );
          })}
          <Dimension
            axis="x"
            from={0}
            to={sheetWidth}
            offset={sheetHeight + gutter * 0.85}
            tick={tick}
            fontSize={fontSize}
            vectorEffect={vectorEffect}
            emphasis
          />

          {/* Row heights down the left, then the overall sheet height. */}
          {rows.slice(0, -1).map((start, index) => (
            <Dimension
              key={`row-${index}`}
              axis="y"
              from={start}
              to={rows[index + 1]}
              offset={-gutter * 0.3}
              tick={tick}
              fontSize={fontSize}
              vectorEffect={vectorEffect}
            />
          ))}
          <Dimension
            axis="y"
            from={0}
            to={sheetHeight}
            offset={-gutter * 0.72}
            tick={tick}
            fontSize={fontSize}
            vectorEffect={vectorEffect}
            emphasis
          />
        </g>
      )}
    </svg>
  );
}

function PanelLabel({ panel, fontSize }: { panel: Panel; fontSize: number }) {
  const cx = panel.x + panel.width / 2;
  const cy = panel.y + panel.height / 2;
  // A glue tab is typically far narrower than its label, so stand the text on end.
  const upright = panel.width < fontSize * panel.label.length * 0.62;

  return (
    <text
      x={cx}
      y={cy}
      stroke="none"
      textAnchor="middle"
      dominantBaseline="central"
      transform={
        upright ? `rotate(-90 ${format(cx)} ${format(cy)})` : undefined
      }
    >
      {panel.label}
    </text>
  );
}

interface DimensionProps {
  axis: "x" | "y";
  from: number;
  to: number;
  /** Distance from the origin axis at which the dimension line is drawn. */
  offset: number;
  tick: number;
  fontSize: number;
  vectorEffect?: string;
  emphasis?: boolean;
}

/** An architectural-style dimension line: a rule between two ticks, with the value above it. */
function Dimension({
  axis,
  from,
  to,
  offset,
  tick,
  fontSize,
  vectorEffect,
  emphasis,
}: DimensionProps) {
  const length = Math.abs(to - from);
  if (length <= 0) return null;

  const mid = (from + to) / 2;
  const horizontal = axis === "x";

  const line = horizontal
    ? { x1: from, y1: offset, x2: to, y2: offset }
    : { x1: offset, y1: from, x2: offset, y2: to };

  const ticks = [from, to].map((at) =>
    horizontal
      ? { x1: at, y1: offset - tick, x2: at, y2: offset + tick }
      : { x1: offset - tick, y1: at, x2: offset + tick, y2: at },
  );

  // Horizontal chains read below their rule, vertical ones to the left of it.
  const textX = horizontal ? mid : offset - fontSize * 0.55;
  const textY = horizontal ? offset + tick + fontSize * 0.3 : mid;

  return (
    <g opacity={emphasis ? 1 : 0.75}>
      <line {...line} vectorEffect={vectorEffect} />
      {ticks.map((t, index) => (
        <line key={index} {...t} vectorEffect={vectorEffect} />
      ))}
      <text
        x={textX}
        y={textY}
        stroke="none"
        textAnchor="middle"
        dominantBaseline={horizontal ? "hanging" : undefined}
        fontWeight={emphasis ? 600 : 400}
        transform={
          horizontal
            ? undefined
            : `rotate(-90 ${format(textX)} ${format(textY)})`
        }
      >
        {format(length)}
      </text>
    </g>
  );
}
