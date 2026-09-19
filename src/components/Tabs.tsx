import "./Tabs.css";

export interface Tab<T extends string> {
  id: T;
  label: string;
}

export interface TabsProps<T extends string> {
  tabs: readonly Tab<T>[];
  active: T;
  onChange: (id: T) => void;
  /** Shared prefix for the `id`/`aria-controls` pairing with the panels. */
  idPrefix: string;
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  idPrefix,
}: TabsProps<T>) {
  // Left/right arrows move between tabs, as expected of a tablist. Focus has to
  // follow the selection, otherwise it is left on a tab that is now tabIndex -1.
  const step = (delta: number) => {
    const index = tabs.findIndex((tab) => tab.id === active);
    const next = tabs[(index + delta + tabs.length) % tabs.length];
    onChange(next.id);
    document.getElementById(`${idPrefix}-tab-${next.id}`)?.focus();
  };

  return (
    <div className="tabs" role="tablist" aria-label="Preview">
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            className="tabs__tab"
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") step(1);
              else if (event.key === "ArrowLeft") step(-1);
              else return;
              event.preventDefault();
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
