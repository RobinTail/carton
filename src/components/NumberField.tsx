import { useId } from "react";

export interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string;
  error?: string;
  warning?: string;
  min?: number;
  step?: number;
  disabled?: boolean;
}

export function NumberField({
  label,
  value,
  onChange,
  hint,
  error,
  warning,
  min = 0,
  step = 1,
  disabled = false,
}: NumberFieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? warning ?? hint;

  return (
    <div
      className="field"
      data-invalid={error ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
    >
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className="field__input">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ""}
          min={min}
          step={step}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          onChange={(event) => onChange(event.target.valueAsNumber)}
        />
        <span className="field__unit" aria-hidden="true">
          mm
        </span>
      </div>
      {message && (
        <p
          id={messageId}
          className="field__message"
          data-tone={error ? "error" : warning ? "warning" : "hint"}
        >
          {message}
        </p>
      )}
    </div>
  );
}
