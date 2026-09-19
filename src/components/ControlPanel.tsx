import type { BoxParams, ParamErrors } from "../lib/geometry.ts";
import { NumberField } from "./NumberField.tsx";
import "./ControlPanel.css";

export interface ControlPanelProps {
  params: BoxParams;
  errors: ParamErrors;
  warnings: ParamErrors;
  annotate: boolean;
  onChange: <K extends keyof BoxParams>(key: K, value: BoxParams[K]) => void;
  onAnnotateChange: (annotate: boolean) => void;
  onReset: () => void;
}

export function ControlPanel({
  params,
  errors,
  warnings,
  annotate,
  onChange,
  onAnnotateChange,
  onReset,
}: ControlPanelProps) {
  return (
    <form className="controls" onSubmit={(event) => event.preventDefault()}>
      <fieldset className="controls__group">
        <legend>Interior</legend>
        <p className="controls__note">
          Clear space required inside the damping liner.
        </p>
        <NumberField
          label="Length"
          value={params.interiorLength}
          error={errors.interiorLength}
          warning={warnings.interiorLength}
          onChange={(value) => onChange("interiorLength", value)}
        />
        <NumberField
          label="Width"
          value={params.interiorWidth}
          error={errors.interiorWidth}
          warning={warnings.interiorWidth}
          onChange={(value) => onChange("interiorWidth", value)}
        />
        <NumberField
          label="Height"
          value={params.interiorHeight}
          error={errors.interiorHeight}
          warning={warnings.interiorHeight}
          onChange={(value) => onChange("interiorHeight", value)}
        />
      </fieldset>

      <fieldset className="controls__group">
        <legend>Material</legend>
        <NumberField
          label="Cardboard"
          value={params.cardboardThickness}
          step={0.5}
          hint="Thickness of a single wall."
          error={errors.cardboardThickness}
          warning={warnings.cardboardThickness}
          onChange={(value) => onChange("cardboardThickness", value)}
        />
        <NumberField
          label="Damping"
          value={params.dampingThickness}
          step={0.5}
          hint="Liner on all six interior faces."
          error={errors.dampingThickness}
          warning={warnings.dampingThickness}
          onChange={(value) => onChange("dampingThickness", value)}
        />
      </fieldset>

      <fieldset className="controls__group">
        <legend>Assembly</legend>
        <label className="switch">
          <input
            type="checkbox"
            checked={params.glueTab}
            onChange={(event) => onChange("glueTab", event.target.checked)}
          />
          <span>Glue tab</span>
        </label>
        <NumberField
          label="Tab width"
          value={params.glueTabWidth}
          disabled={!params.glueTab}
          error={errors.glueTabWidth}
          warning={warnings.glueTabWidth}
          onChange={(value) => onChange("glueTabWidth", value)}
        />
      </fieldset>

      <fieldset className="controls__group">
        <legend>Drawing</legend>
        <label className="switch">
          <input
            type="checkbox"
            checked={annotate}
            onChange={(event) => onAnnotateChange(event.target.checked)}
          />
          <span>Dimension annotations</span>
        </label>
        <p className="controls__note">
          Included in the exported file when switched on.
        </p>
      </fieldset>

      <button type="button" className="controls__reset" onClick={onReset}>
        Reset to defaults
      </button>
    </form>
  );
}
