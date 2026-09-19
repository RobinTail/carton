import type { ReactNode } from "react";

/** A message shown in place of a preview that cannot be rendered. */
export function PreviewNotice({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="preview__notice" role="status">
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}
