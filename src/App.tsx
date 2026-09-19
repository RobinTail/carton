import { lazy, Suspense, useEffect, useState } from "react";
import { ControlPanel } from "./components/ControlPanel.tsx";
import { FlatLayout } from "./components/FlatLayout.tsx";
import { Summary } from "./components/Summary.tsx";
import { Tabs, type Tab } from "./components/Tabs.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { PreviewNotice } from "./components/PreviewNotice.tsx";
import { isWebGLAvailable } from "./lib/webgl.ts";
import {
  computeLayout,
  validate,
  warn,
  DEFAULT_PARAMS,
  type BoxParams,
} from "./lib/geometry.ts";
import { decodeParams, encodeParams } from "./lib/urlState.ts";
import "./App.css";

// three.js is an order of magnitude heavier than the rest of the app, so it
// only downloads once someone actually opens the 3D tab.
const Box3D = lazy(() =>
  import("./components/Box3D.tsx").then((m) => ({ default: m.Box3D })),
);

type ShareState = "idle" | "copied" | "failed";

const SHARE_LABEL: Record<ShareState, string> = {
  idle: "Share link",
  copied: "Copied!",
  failed: "Copy failed",
};

type View = "flat" | "model";

const VIEWS: readonly Tab<View>[] = [
  { id: "flat", label: "Flat" },
  { id: "model", label: "3D" },
];

export default function App() {
  const [params, setParams] = useState<BoxParams>(() =>
    decodeParams(window.location.search),
  );
  const [view, setView] = useState<View>("flat");
  const [annotate, setAnnotate] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [shared, setShared] = useState<ShareState>("idle");

  useEffect(() => {
    window.history.replaceState(null, "", encodeParams(params));
  }, [params]);

  useEffect(() => {
    if (shared === "idle") return;
    const timer = setTimeout(() => setShared("idle"), 2500);
    return () => clearTimeout(timer);
  }, [shared]);

  const errors = validate(params);
  const valid = Object.keys(errors).length === 0;
  const layout = valid ? computeLayout(params) : null;
  const warnings = layout ? warn(params, layout) : {};

  const update = <K extends keyof BoxParams>(key: K, value: BoxParams[K]) => {
    setParams((current) => ({ ...current, [key]: value }));
  };

  // Serialising the SVG pulls in react-dom/server, which is far too heavy to
  // sit in the initial bundle for a button most visits never press.
  const download = async () => {
    if (!layout) return;
    setExporting(true);
    try {
      const { downloadSvg } = await import("./lib/exportSvg.ts");
      downloadSvg(layout, params, annotate);
    } finally {
      setExporting(false);
    }
  };

  // The URL already tracks every parameter, so sharing is just copying it.
  // Clipboard access needs a secure context and can still be refused.
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShared("copied");
    } catch {
      setShared("failed");
    }
  };

  return (
    <div className="app">
      <header className="app__header">
        <h1>Carton</h1>
        <p>
          Flat cut-and-fold layout for a regular slotted container, sized from
          the interior dimensions you need to protect.
        </p>
      </header>

      <main className="app__body">
        <aside className="app__sidebar">
          <ControlPanel
            params={params}
            errors={errors}
            warnings={warnings}
            annotate={annotate}
            onChange={update}
            onAnnotateChange={setAnnotate}
            onReset={() => setParams(DEFAULT_PARAMS)}
          />
        </aside>

        <section className="app__preview">
          <div className="preview">
            <div className="preview__toolbar">
              <Tabs
                tabs={VIEWS}
                active={view}
                onChange={setView}
                idPrefix="preview"
              />
              {view === "flat" ? (
                <Legend />
              ) : isWebGLAvailable() ? (
                <p className="preview__hint">Drag to rotate · scroll to zoom</p>
              ) : null}
              <div className="preview__actions">
                <button
                  type="button"
                  className="button button--ghost"
                  data-state={shared === "idle" ? undefined : shared}
                  aria-live="polite"
                  onClick={share}
                >
                  {SHARE_LABEL[shared]}
                </button>
                <button
                  type="button"
                  className="button button--primary"
                  disabled={!layout || exporting}
                  onClick={download}
                >
                  {exporting ? "Preparing…" : "Download SVG"}
                </button>
              </div>
            </div>
            <div
              className="preview__paper"
              role="tabpanel"
              id={`preview-panel-${view}`}
              aria-labelledby={`preview-tab-${view}`}
              data-view={view}
            >
              {!layout ? (
                <p className="preview__empty">
                  Correct the highlighted fields to draw the layout.
                </p>
              ) : view === "flat" ? (
                <FlatLayout layout={layout} annotate={annotate} />
              ) : !isWebGLAvailable() ? (
                <PreviewNotice title="3D preview unavailable">
                  This browser cannot open a WebGL context, usually because
                  hardware acceleration is switched off. The Flat tab and the
                  SVG export work regardless.
                </PreviewNotice>
              ) : (
                <ErrorBoundary
                  fallback={
                    <PreviewNotice title="The 3D preview failed to start">
                      The model could not be rendered on this device. The Flat
                      tab and the SVG export are unaffected.
                    </PreviewNotice>
                  }
                >
                  <Suspense
                    fallback={
                      <p className="preview__empty">Loading the model…</p>
                    }
                  >
                    <Box3D layout={layout} params={params} />
                  </Suspense>
                </ErrorBoundary>
              )}
            </div>
            {layout && <Summary layout={layout} />}
          </div>
        </section>
      </main>
    </div>
  );
}

function Legend() {
  return (
    <ul className="legend">
      <li>
        <span
          className="legend__swatch legend__swatch--cut"
          aria-hidden="true"
        />
        Cut
      </li>
      <li>
        <span
          className="legend__swatch legend__swatch--fold"
          aria-hidden="true"
        />
        Fold
      </li>
    </ul>
  );
}
