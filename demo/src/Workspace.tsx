import { useEffect, useRef, useState } from "react";
import type { DemoStore, PageProps } from "./state/useDemoStore";
import {
  createCollection,
  renameCollection,
  toggleFavorite,
  isSavedVisible,
  restoreSavedContext,
} from "./state/model.mjs";
import "./admin.css";

export function downloadJSON(value: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ConfirmDialog({
  title,
  children,
  onConfirm,
  onClose,
  confirmLabel = "Confirm",
}: {
  title: string;
  children: React.ReactNode;
  onConfirm: () => void;
  onClose: () => void;
  confirmLabel?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    dialog.current?.showModal();
    return () => {
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="confirm-dialog"
      onCancel={onClose}
      aria-labelledby="confirm-title"
    >
      <h2 id="confirm-title">{title}</h2>
      {children}
      <div className="toolbar">
        <button className="button secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          className="button primary"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

export function RecoveryPanel({ store }: { store: DemoStore }) {
  const [reset, setReset] = useState(false);
  if (store.storage.status === "persistent" && !store.conflict) return null;
  return (
    <aside
      className="notice storage-notice"
      aria-label="Browser storage status"
    >
      <strong>
        {store.storage.status === "recovery"
          ? "Saved-data recovery"
          : store.conflict
            ? "Changes in another tab"
            : "Session-only storage"}
      </strong>
      <p>{store.conflict?.message ?? store.storage.message}</p>
      <div className="toolbar">
        {store.conflict?.remote && (
          <button
            className="button secondary"
            onClick={() => store.resolveConflict("remote")}
          >
            Use other tab’s version
          </button>
        )}
        {store.conflict && store.storage.status !== "recovery" && (
          <button
            className="button secondary"
            onClick={() => store.resolveConflict("local")}
          >
            Keep this tab’s version
          </button>
        )}
        <button
          className="button secondary"
          onClick={() =>
            downloadJSON(
              store.storage.recoveryRaw
                ? { preservedData: store.storage.recoveryRaw }
                : store.state,
              "enterprise-iq-local-backup.json",
            )
          }
        >
          Export local backup
        </button>
        {store.storage.status === "recovery" && (
          <>
            <button className="button secondary" onClick={store.useSessionOnly}>
              Continue in this session
            </button>
            <button
              className="button secondary"
              onClick={(e) => {
                e.currentTarget.focus();
                setReset(true);
              }}
            >
              Reset Enterprise IQ data
            </button>
          </>
        )}
      </div>
      {reset && (
        <ConfirmDialog
          title="Reset Enterprise IQ data?"
          confirmLabel="Reset demo data"
          onClose={() => setReset(false)}
          onConfirm={store.reset}
        >
          <p>
            This removes this demo’s saved items, configuration versions, and
            local recording. Other applications on this browser are unaffected.
            Export a backup first to preserve unreadable data.
          </p>
        </ConfirmDialog>
      )}
    </aside>
  );
}

const fallbackResources = [
  ["finance-report", "Finance Performance", "report"],
  ["sales-report", "Sales Performance", "report"],
  ["credits-report", "Credits & Adjustments", "report"],
  ["regional-report", "Regional Revenue", "report"],
  ["product-report", "Product Mix", "report"],
  ["revenue-definition", "Gross vs. net revenue", "documentation"],
  ["close-note", "September close note", "documentation"],
  ["credits-policy", "Credits policy", "documentation"],
  ["refresh-lineage", "Refresh and lineage", "documentation"],
  ["department-guide", "Department guidance", "documentation"],
].map(([id, title, kind]) => ({ id, title, kind }));

export default function MyWorkspace({
  store,
  navigate,
  resources = fallbackResources,
}: PageProps) {
  const [tab, setTab] = useState("saved");
  const [query, setQuery] = useState("");
  const [collection, setCollection] = useState("all");
  const [newName, setNewName] = useState("");
  const [rename, setRename] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reset, setReset] = useState(false);
  const [removed, setRemoved] = useState<any>(null);
  const { state } = store;
  const act = (operation: () => boolean, success: string) => {
    try {
      if (operation()) {
        setMessage(success);
        setError("");
        return true;
      }
    } catch (e) {
      setError((e as Error).message);
    }
    return false;
  };
  const routeFor = (item: any) =>
    item.route ??
    (item.kind === "query"
      ? `/data-explorer?template=${item.id}`
      : `/${item.kind === "report" ? "reports" : "knowledge"}/${item.id}`);
  const permittedIds = resources.map((item) => item.id);
  const permittedSaved = state.saved.filter((item: any) =>
    isSavedVisible(item, permittedIds),
  );
  const permittedRecent = state.recent.filter((item: any) =>
    isSavedVisible(item, permittedIds),
  );
  const permittedFavorites = state.favorites.filter((id: string) =>
    permittedIds.includes(id),
  );
  const backup = {
    ...state,
    saved: permittedSaved,
    recent: permittedRecent,
    favorites: permittedFavorites,
    ui: {
      ...state.ui,
      queryHistory: (state.ui.queryHistory ?? []).filter((item: any) =>
        permittedIds.includes(item.template),
      ),
    },
  };
  const open = (item: any) => {
    const target = { ...item, route: routeFor(item) };
    try {
      if (
        store.update((s: any) => restoreSavedContext(s, target, permittedIds))
      )
        navigate(target.route);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  let items =
    tab === "favorites"
      ? resources.filter((item) => state.favorites.includes(item.id))
      : tab === "recent"
        ? permittedRecent
        : permittedSaved;
  items = items.filter(
    (item: any) =>
      (collection === "all" || item.collectionId === collection) &&
      item.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  return (
    <div className="workspace-page page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Your working context</p>
          <h1>My Workspace</h1>
          <p className="muted">
            Keep the reports, questions, and evidence you want to return to.
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() =>
            downloadJSON(
              {
                saved: permittedSaved,
                collections: state.collections,
                favorites: permittedFavorites,
              },
              "enterprise-iq-workspace.json",
            )
          }
        >
          Export workspace
        </button>
      </header>
      <div className="tabs" aria-label="Workspace views">
        {[
          ["saved", "Saved items"],
          ["favorites", "Favorites"],
          ["collections", "Collections"],
          ["recent", "Recently viewed"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            aria-pressed={tab === id}
            onClick={() => {
              setTab(id);
              setCollection("all");
            }}
          >
            {label}{" "}
            <span className="count">
              {id === "favorites"
                ? permittedFavorites.length
                : id === "recent"
                  ? permittedRecent.length
                  : id === "collections"
                    ? state.collections.length
                    : permittedSaved.length}
            </span>
          </button>
        ))}
      </div>
      {message && (
        <p className="notice" role="status">
          {message}
          {removed && (
            <button
              className="text-button"
              onClick={() => {
                act(
                  () =>
                    store.update((s: any) => ({
                      ...s,
                      saved: [
                        removed,
                        ...s.saved.filter(
                          (entry: any) => entry.id !== removed.id,
                        ),
                      ],
                    })),
                  "Item restored.",
                );
                setRemoved(null);
              }}
            >
              Undo remove
            </button>
          )}
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {tab === "collections" && (
        <section className="panel">
          <div className="section-heading">
            <h2>Your collections</h2>
            <p className="muted">
              Group saved report views, queries, and investigations.
            </p>
          </div>
          <form
            className="toolbar"
            onSubmit={(e) => {
              e.preventDefault();
              const created = act(
                () => store.update((s: any) => createCollection(s, newName)),
                "Collection created.",
              );
              if (created) setNewName("");
            }}
          >
            <label className="field">
              Collection name
              <input
                value={newName}
                maxLength={80}
                placeholder="e.g. September review"
                onChange={(e) => setNewName(e.target.value)}
              />
            </label>
            <button className="button primary" type="submit">
              Create collection
            </button>
          </form>
          <div className="collection-list">
            {state.collections.map((item: any) => (
              <div className="collection-row" key={item.id}>
                {rename?.id === item.id ? (
                  <form
                    className="toolbar"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const renamed = act(
                        () =>
                          store.update((s: any) =>
                            renameCollection(s, item.id, rename!.name),
                          ),
                        "Collection renamed.",
                      );
                      if (renamed) setRename(null);
                    }}
                  >
                    <label className="field">
                      Rename collection
                      <input
                        autoFocus
                        value={rename!.name}
                        onChange={(e) =>
                          setRename({ id: item.id, name: e.target.value })
                        }
                        maxLength={80}
                      />
                    </label>
                    <button className="button primary">Save name</button>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => setRename(null)}
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    <button
                      className="text-button"
                      onClick={() =>
                        setCollection(collection === item.id ? "all" : item.id)
                      }
                      aria-pressed={collection === item.id}
                    >
                      {item.name}{" "}
                      <span className="muted">
                        {
                          permittedSaved.filter(
                            (entry: any) => entry.collectionId === item.id,
                          ).length
                        }{" "}
                        items
                      </span>
                    </button>
                    <button
                      className="button secondary"
                      onClick={() =>
                        setRename({ id: item.id, name: item.name })
                      }
                    >
                      Rename
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      <div className="toolbar">
        <label className="field search-field">
          Find a saved resource
          <input
            type="search"
            placeholder="Search your workspace"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {(tab === "saved" || tab === "collections") && (
          <label className="field">
            Collection
            <select
              value={collection}
              onChange={(e) => setCollection(e.target.value)}
            >
              <option value="all">All collections</option>
              {state.collections.map((item: any) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="saved-list">
        {items.map((item: any) => (
          <article className="card saved-item" key={item.id}>
            <div>
              <span className="eyebrow">{item.kind ?? "Recently viewed"}</span>
              <h2>
                <button className="text-button" onClick={() => open(item)}>
                  {item.title}
                </button>
              </h2>
              {item.context?.period && (
                <p className="muted">
                  Sample period {item.context.period} · USD · US entity
                </p>
              )}
              {item.savedAt && (
                <p className="muted">
                  Saved{" "}
                  {new Date(item.savedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              )}
            </div>
            <div className="toolbar">
              <button className="button secondary" onClick={() => open(item)}>
                Open
              </button>
              {tab === "favorites" ? (
                <button
                  className="button secondary"
                  onClick={() =>
                    act(
                      () =>
                        store.update((s: any) => toggleFavorite(s, item.id)),
                      "Favorite removed.",
                    )
                  }
                >
                  Remove favorite
                </button>
              ) : (
                tab !== "recent" && (
                  <>
                    <label className="field compact-field">
                      Move to collection
                      <select
                        value={item.collectionId ?? ""}
                        onChange={(e) =>
                          act(
                            () =>
                              store.update((s: any) => ({
                                ...s,
                                saved: s.saved.map((entry: any) =>
                                  entry.id === item.id
                                    ? {
                                        ...entry,
                                        collectionId: e.target.value || null,
                                      }
                                    : entry,
                                ),
                              })),
                            "Collection updated.",
                          )
                        }
                      >
                        <option value="">Unfiled</option>
                        {state.collections.map((entry: any) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="button secondary"
                      onClick={() => {
                        setRemoved(item);
                        act(
                          () =>
                            store.update((s: any) => ({
                              ...s,
                              saved: s.saved.filter(
                                (entry: any) => entry.id !== item.id,
                              ),
                            })),
                          "Saved item removed.",
                        );
                      }}
                    >
                      Remove
                    </button>
                  </>
                )
              )}
            </div>
          </article>
        ))}
      </div>
      {!items.length && (
        <section className="empty-state panel">
          <h2>
            {query
              ? "No matching items"
              : tab === "recent"
                ? "Your next step starts here"
                : tab === "favorites"
                  ? "Keep useful reports close"
                  : "Save your investigation"}
          </h2>
          <p>
            {query
              ? "Try a shorter search or another collection."
              : "Open a report, run a governed query, or explore Ask IQ. Save your view to pick up where you left off."}
          </p>
          <div className="toolbar">
            <button
              className="button primary"
              onClick={() => navigate("/reports")}
            >
              Explore reports
            </button>
            <button
              className="button secondary"
              onClick={() => navigate("/ask-iq")}
            >
              Investigate revenue
            </button>
          </div>
        </section>
      )}
      <section className="panel storage-settings">
        <h2>Data in this browser</h2>
        <p className="muted">
          Your saved work stays in this browser.{" "}
          {store.storage.status === "persistent"
            ? "Changes survive reloads."
            : "Storage is unavailable; changes last for this tab’s session."}{" "}
          Reset affects Enterprise IQ only.
        </p>
        <div className="toolbar">
          <button
            className="button secondary"
            onClick={() =>
              downloadJSON(backup, "enterprise-iq-local-backup.json")
            }
          >
            Export local backup
          </button>
          <button className="button secondary" onClick={() => setReset(true)}>
            Reset Enterprise IQ data
          </button>
        </div>
      </section>
      {reset && (
        <ConfirmDialog
          title="Reset Enterprise IQ data?"
          confirmLabel="Reset demo data"
          onClose={() => setReset(false)}
          onConfirm={() => {
            store.reset();
            setMessage("Enterprise IQ data reset to sample defaults.");
          }}
        >
          <p>
            This removes saved items, collections, configuration versions, and
            your local recording from this browser. It does not affect other
            demos. Export a backup first if you want to keep a copy.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
