import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  BarChart3,
  BookOpen,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Database,
  Home as HomeIcon,
  Menu,
  Search,
  Settings2,
  Sparkles,
  UserRound,
  X,
  BriefcaseBusiness,
} from "lucide-react";
import { Home, Catalog, ReportWorkspace, type PageProps } from "./HomeReport";
import { Button, Dialog, defaultFilters, type Filters } from "./ui";
import { useDemoStore } from "./state/useDemoStore";
import {
  effectiveExperience,
  toggleFavorite,
  saveItem,
  recordRecent,
} from "./state/model.mjs";
import {
  REPORTS,
  DOCUMENTS,
  QUERY_DEFINITIONS,
  getResource,
  canAccess,
} from "./domain/catalog.mjs";
import MyWorkspace, { RecoveryPanel } from "./Workspace";
const DataExplorer = lazy(() => import("./DataExplorer"));
const Knowledge = lazy(() =>
  import("./KnowledgeAsk").then((m) => ({ default: m.Knowledge })),
);
const AskIQ = lazy(() =>
  import("./KnowledgeAsk").then((m) => ({ default: m.AskIQ })),
);
const ExperienceSettings = lazy(() =>
  import("./Admin").then((m) => ({ default: m.ExperienceSettings })),
);
const UsageAnalytics = lazy(() =>
  import("./Admin").then((m) => ({ default: m.UsageAnalytics })),
);
const SourceDirectory = lazy(() =>
  import("./Admin").then((m) => ({ default: m.SourceDirectory })),
);
import "./styles.css";
declare const __RELEASE__: string;
function App() {
  const store = useDemoStore();
  const { state } = store;
  const [route, setRoute] = useState(() => location.hash.slice(1) || "/home");
  const [menu, setMenu] = useState(false);
  const [about, setAbout] = useState(false);
  const [personaDialog, setPersonaDialog] = useState(false);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const dirty = useRef(false);
  const viewId = useRef("view-" + crypto.randomUUID());
  const questionId = useRef("question-" + crypto.randomUUID());
  const searchId = useRef("search-" + crypto.randomUUID());
  const scrolls = useRef<Record<string, number>>({});
  const routeRef = useRef(route);
  const workspace = state.workspace[0].toUpperCase() + state.workspace.slice(1);
  const persona =
    state.persona === "admin"
      ? "admin"
      : state.persona === "restricted"
        ? "sales"
        : "finance";
  const resolution = effectiveExperience(state, state.workspace, null, {
    moduleIds: [
      "home",
      "reports",
      "data-explorer",
      "knowledge",
      "ask-iq",
      "my-workspace",
    ],
    actionIds: ["expand", "save", "export", "chart", "ask-iq", "native-open"],
    reportIds: REPORTS.filter((r) => canAccess(r.id, persona)).map((r) => r.id),
    documentIds: DOCUMENTS.filter((r) => canAccess(r.id, persona)).map(
      (r) => r.id,
    ),
  });
  const experience = resolution.effective ?? {};
  const filters: Filters = state.ui.filters ?? defaultFilters;
  const [path, query = ""] = route.split("?");
  const params = new URLSearchParams(query);
  const pieces = path.split("/").filter(Boolean);
  const page = pieces[0] ?? "home";
  const emit = (name: string, params: any = {}, extra: any = {}) => {
    if (name === "iq_question_submitted")
      questionId.current = "question-" + crypto.randomUUID();
    if (name === "search_submitted")
      searchId.current = "search-" + crypto.randomUUID();
    store.track(name, {
      workspace: state.workspace,
      params,
      source: extra.source_system ?? "enterprise-iq",
      resourceId: pieces[1] ?? page,
      viewId: viewId.current,
      searchId: searchId.current,
      ...(name.startsWith("iq_") ? { questionId: questionId.current } : {}),
      ...(name.startsWith("search_") ? { searchId: searchId.current } : {}),
      ...extra,
    });
  };
  const navigate = (next: string) => {
    const normalized = next.startsWith("#") ? next.slice(1) : next;
    if (!normalized.startsWith("/") || normalized.startsWith("//")) return;
    if (
      dirty.current &&
      !window.confirm(
        "Discard unsaved form changes? Saved drafts are retained.",
      )
    )
      return;
    dirty.current = false;
    location.hash = normalized;
    setMenu(false);
  };
  useEffect(() => {
    const changed = () => {
      scrolls.current[routeRef.current] = window.scrollY;
      const next = location.hash.slice(1) || "/home";
      if (
        dirty.current &&
        !window.confirm(
          "Discard unsaved form changes? Saved drafts are retained.",
        )
      ) {
        history.replaceState(
          null,
          "",
          location.pathname + "#" + routeRef.current,
        );
        return;
      }
      dirty.current = false;
      routeRef.current = next;
      setRoute(next);
      setMenu(false);
      requestAnimationFrame(() =>
        window.scrollTo(0, scrolls.current[next] ?? 0),
      );
    };
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  useEffect(() => {
    const changed = (event: Event) => {
      dirty.current = (event as CustomEvent).detail;
    };
    const click = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest('a[href^="#/"]');
      if (link && dirty.current) {
        event.preventDefault();
        navigate(link.getAttribute("href")!);
      }
    };
    window.addEventListener("enterprise-iq-dirty", changed);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("enterprise-iq-dirty", changed);
      document.removeEventListener("click", click, true);
    };
  }, []);
  useEffect(() => {
    if (!location.hash) history.replaceState(null, "", "#/home");
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const candidate = getResource(pieces[1], persona);
    const r =
      (page === "reports" && candidate?.kind === "report") ||
      (page === "knowledge" && candidate?.kind === "document")
        ? candidate
        : undefined;
    if (r)
      store.update((s) =>
        recordRecent(s, { id: r.id, title: r.title, route: path }),
      );
    if (
      [
        "home",
        "reports",
        "data-explorer",
        "knowledge",
        "ask-iq",
        "my-workspace",
      ].includes(page)
    )
      emit("workspace_viewed", { module: page });
    if (page === "reports" && r) {
      viewId.current = "view-" + crypto.randomUUID();
      const source = r.source === "Looker" ? "looker" : "power-bi";
      emit("report_open_requested", {}, { source_system: source });
      requestAnimationFrame(() => {
        emit("report_initialized", {}, { source_system: source });
        emit(
          "report_rendered",
          { outcome: "success" },
          { source_system: source },
        );
      });
    }
    document.title = `${r?.title ?? ({ home: "Your analytics workspace", reports: "Reports", settings: "Experience Settings", analytics: "Usage Analytics", sources: "Source Directory", "ask-iq": "Ask IQ", "data-explorer": "Data Explorer", knowledge: "Knowledge", "my-workspace": "My Workspace" } as any)[page] ?? "Enterprise IQ"} · Enterprise IQ`;
  }, [path]);
  const shared: PageProps = {
    workspace,
    persona,
    filters,
    setFilters: (f) =>
      store.update((s) => ({ ...s, ui: { ...s.ui, filters: f } })),
    navigate,
    save: (item) => {
      try {
        const changed = store.update((s) =>
          saveItem(s, {
            ...item,
            context: item.context ?? { filters: item.filters ?? filters },
          }),
        );
        if (changed && item.kind !== "documentation")
          emit("resource_saved", { resource_type: item.kind });
        return changed;
      } catch (error) {
        setToast((error as Error).message);
        return false;
      }
    },
    favorite: (id) => {
      try {
        const changed = store.update((s) => toggleFavorite(s, id));
        if (changed)
          setToast(
            state.favorites.includes(id)
              ? "Removed from favorites"
              : "Added to favorites",
          );
      } catch (e) {
        setToast((e as Error).message);
      }
    },
    favorites: state.favorites,
    notify: setToast,
    emit,
    experience,
    recent: state.recent,
  };
  const icons: any = {
    home: HomeIcon,
    reports: BarChart3,
    "data-explorer": Database,
    knowledge: BookOpen,
    "ask-iq": Sparkles,
    "my-workspace": BriefcaseBusiness,
  };
  const names: any = {
    home: "Home",
    reports: "Reports",
    "data-explorer": "Data Explorer",
    knowledge: "Knowledge",
    "ask-iq": "Ask IQ",
    "my-workspace": "My Workspace",
    settings: "Experience Settings",
    analytics: "Usage Analytics",
    sources: "Source Directory",
    search: "Search",
  };
  return (
    <div
      className={`app theme-${experience.themeAccent ?? "navy"} density-${experience.themeDensity ?? "comfortable"}`}
    >
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#/home" aria-label="Enterprise IQ Home">
            <span className="brand-mark">
              <i />
              <i />
              <i />
            </span>
            Enterprise IQ<sup>™</sup>
          </a>
          <label className="workspace-select">
            <span className="sr-only">Workspace</span>
            <BriefcaseBusiness size={15} />
            <select
              aria-label="Workspace"
              value={state.workspace}
              onChange={(e) => {
                if (
                  dirty.current &&
                  !window.confirm(
                    "Discard unsaved form changes? Saved drafts are retained.",
                  )
                )
                  return;
                dirty.current = false;
                store.update((s) => ({ ...s, workspace: e.target.value }));
                navigate("/home");
              }}
            >
              <option value="finance">Finance</option>
              <option value="sales">Sales</option>
              <option value="operations">Operations</option>
            </select>
          </label>
          <div className="topbar-spacer" />
          <form
            className="global-search"
            onSubmit={(e) => {
              e.preventDefault();
              emit("search_submitted", { category: "all" });
              navigate(`/search?q=${encodeURIComponent(search)}`);
            }}
          >
            <Search size={16} />
            <input
              aria-label="Global search"
              placeholder="Search workspace…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>
          <Button
            className="icon-button help-button"
            aria-label="About this demo"
            onClick={() => setAbout(true)}
          >
            <CircleHelp size={19} />
          </Button>
          <button
            className="persona-control"
            onClick={(e) => {
              e.currentTarget.focus();
              setPersonaDialog(true);
            }}
            aria-label="Demo persona"
          >
            <span className="avatar">
              {persona === "admin" ? "AD" : persona === "sales" ? "SA" : "FA"}
            </span>
            <span>
              {persona === "admin"
                ? "Demo admin"
                : persona === "sales"
                  ? "Sales viewer"
                  : "Demo analyst"}
            </span>
            <ChevronDown size={14} />
          </button>
          <button
            className="mobile-toggle"
            aria-label={menu ? "Close navigation" : "Open navigation"}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <div className={`nav-wrap ${menu ? "mobile-open" : ""}`}>
        <nav className="main-nav" aria-label="Main navigation">
          {(experience.navigation ?? []).map((n: any) => {
            const Icon = icons[n.module];
            return (
              <a
                key={n.module}
                href={`#/${n.module}`}
                className={page === n.module ? "active" : ""}
                aria-current={page === n.module ? "page" : undefined}
              >
                {Icon && <Icon size={17} />}
                <span>{n.label}</span>
              </a>
            );
          })}
          <details className="admin-menu">
            <summary>
              <Settings2 size={15} />
              Demo administration
              <ChevronDown size={13} />
            </summary>
            <div className="admin-dropdown">
              <a href="#/settings">Experience Settings</a>
              <a href="#/analytics">Usage Analytics</a>
              <a href="#/sources">Source Directory</a>
              <button
                className="button text-button"
                onClick={() => setPersonaDialog(true)}
              >
                Change demo persona
              </button>
            </div>
          </details>
        </nav>
      </div>
      <main className="main" id="main-content" tabIndex={-1}>
        <div className="breadcrumbs">
          <a href="#/home">{workspace}</a>
          <ChevronRight size={12} />
          <span>{names[page] ?? "Resource"}</span>
          {pieces[1] && (
            <>
              <ChevronRight size={12} />
              <span>
                {getResource(pieces[1], persona)?.title ?? "Unavailable"}
              </span>
            </>
          )}
        </div>
        <RecoveryPanel store={store} />
        <Suspense
          fallback={
            <div className="notice" role="status">
              Opening workspace…
            </div>
          }
        >
          {page === "home" ? (
            <Home {...shared} />
          ) : page === "reports" ? (
            pieces[1] ? (
              <ReportWorkspace key={pieces[1]} id={pieces[1]} {...shared} />
            ) : (
              <Catalog {...shared} />
            )
          ) : page === "search" ? (
            <Catalog
              key={route}
              {...shared}
              all
              query={params.get("q") ?? ""}
            />
          ) : page === "data-explorer" ? (
            <DataExplorer
              {...shared}
              store={store}
              initialTemplate={params.get("template") ?? undefined}
              initialSource={
                params.get("source") === "databricks"
                  ? "Databricks"
                  : params.get("source") === "snowflake"
                    ? "Snowflake"
                    : undefined
              }
            />
          ) : page === "knowledge" ? (
            <Knowledge {...shared} id={pieces[1]} />
          ) : page === "ask-iq" ? (
            <AskIQ {...shared} />
          ) : page === "my-workspace" ? (
            <MyWorkspace
              store={store}
              workspace={state.workspace}
              navigate={navigate}
              resources={[
                ...REPORTS,
                ...DOCUMENTS,
                ...QUERY_DEFINITIONS,
              ].filter((r) => canAccess(r.id, persona))}
            />
          ) : page === "settings" ? (
            <ExperienceSettings
              key={state.workspace}
              store={store}
              workspace={state.workspace}
              navigate={navigate}
            />
          ) : page === "analytics" ? (
            <UsageAnalytics
              store={store}
              workspace={state.workspace}
              navigate={navigate}
            />
          ) : page === "sources" ? (
            <SourceDirectory
              store={store}
              workspace={state.workspace}
              navigate={navigate}
            />
          ) : (
            <div className="empty-state">
              <h1>Page unavailable</h1>
              <p>
                This link does not match a resource in the sample workspace.
              </p>
              <a href="#/home">Return Home</a>
            </div>
          )}
        </Suspense>
      </main>
      <footer className="app-footer">
        <div className="demo-indicator">
          <span />
          Interactive demo · Sample data · Simulated sources
        </div>
        <a
          href="https://github.com/mchenry-power-dev/enterprise-iq"
          target="_blank"
          rel="noreferrer"
        >
          Source & documentation ↗
        </a>
        <button className="text-button" onClick={() => setAbout(true)}>
          About Enterprise IQ
        </button>
      </footer>
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {about && (
        <Dialog
          title="One workspace. A clearer picture."
          onClose={() => setAbout(false)}
        >
          <p>
            Enterprise IQ is an interactive reference demo by McHenry Power.
            Explore reports, run governed local queries, and follow the business
            context behind a number.
          </p>
          <p>
            All records are public synthetic data. The six sources are
            simulated; Ask IQ is deterministic and does not call a language
            model. The persona selector demonstrates intended access behavior,
            not enterprise security.
          </p>
          <p>
            <a
              href="https://github.com/mchenry-power-dev/enterprise-iq/blob/main/docs/demo-guide.md"
              target="_blank"
              rel="noreferrer"
            >
              Demo guide ↗
            </a>{" "}
            ·{" "}
            <a
              href="https://github.com/mchenry-power-dev/enterprise-iq"
              target="_blank"
              rel="noreferrer"
            >
              Repository ↗
            </a>
          </p>
          <small>
            Release: <code data-testid="release">{__RELEASE__}</code>
          </small>
        </Dialog>
      )}
      {personaDialog && (
        <Dialog
          title="Choose a demo persona"
          onClose={() => setPersonaDialog(false)}
        >
          <p>
            All fixtures are public. This local role switch illustrates
            access-sensitive experiences.
          </p>
          <label>
            Demo persona
            <select
              aria-label="Demo persona role"
              value={state.persona}
              onChange={(e) => {
                store.update((s) => ({ ...s, persona: e.target.value }));
                setToast("Demo persona changed; resource access rechecked");
              }}
            >
              <option value="analyst">
                Finance analyst · full sample evidence
              </option>
              <option value="restricted">
                Sales viewer · restricted sample evidence
              </option>
              <option value="admin">Demo administrator</option>
            </select>
          </label>
          <div className="notice">
            Changing roles rechecks reports, query results, exports, and guided
            context.
          </div>
          <Button className="primary" onClick={() => setPersonaDialog(false)}>
            Done
          </Button>
        </Dialog>
      )}
    </div>
  );
}
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="main">
        <div className="panel">
          <h1>The workspace could not open</h1>
          <p>
            Your Enterprise IQ saved data has been preserved. Reload to retry,
            or use a private browser window for a fresh session.
          </p>
          <Button onClick={() => location.reload()}>Reload workspace</Button>
        </div>
      </main>
    ) : (
      this.props.children
    );
  }
}
export default function RootApp() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
