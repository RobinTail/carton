import type { Layout } from "../lib/geometry.ts";
import "./Summary.css";

const format = (value: number) => String(Number(value.toFixed(2)));

/** The computed result of the current parameters, shown beneath the drawing. */
export function Summary({ layout }: { layout: Layout }) {
  const { exterior } = layout;

  return (
    <dl className="summary">
      <div className="summary__stat">
        <dt>Exterior</dt>
        <dd>
          {format(exterior.length)} × {format(exterior.width)} ×{" "}
          {format(exterior.height)} mm
        </dd>
      </div>
      <div className="summary__stat">
        <dt>Flat sheet</dt>
        <dd>
          {format(layout.sheetWidth)} × {format(layout.sheetHeight)} mm
        </dd>
      </div>
      <div className="summary__stat">
        <dt>Flap height</dt>
        <dd>{format(layout.flapHeight)} mm</dd>
      </div>
    </dl>
  );
}
