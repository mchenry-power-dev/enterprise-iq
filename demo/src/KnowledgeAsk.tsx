import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bookmark,
  Check,
  FileText,
  Search,
  Sparkles,
  Star,
} from "lucide-react";
import type { PageProps } from "./HomeReport";
import { Badge, Button, DataTable, Empty, FiltersBar, PageHead } from "./ui";
import {
  DOCUMENTS,
  REPORTS,
  canAccess,
  searchCatalog,
} from "./domain/catalog.mjs";
import {
  EVIDENCE_SCENARIOS,
  GUIDED_QUESTIONS,
  resourceHref,
  runGuidedQuestion,
} from "./domain/answers.mjs";
import { money, periodLabel } from "./domain/data.mjs";
type DocumentSection = { id: string; title: string; paragraphs: string[] };
let knowledgeSearch = { search: "", source: "All" };

function contextLabel(filters: PageProps["filters"]) {
  return [
    periodLabel(filters.period),
    "USD",
    "Aster Manufacturing US",
    filters.region === "All" ? "All regions" : filters.region,
    filters.product === "All" ? "All products" : filters.product,
  ].join(" · ");
}

export function Knowledge(props: PageProps & { id?: string }) {
  const { id, persona, filters, navigate } = props;
  const [search, setSearch] = useState(
    () =>
      new URLSearchParams(window.location.hash.split("?")[1]).get("q") ??
      knowledgeSearch.search,
  );
  const [source, setSource] = useState(
    () =>
      new URLSearchParams(window.location.hash.split("?")[1]).get("source") ??
      knowledgeSearch.source,
  );
  const doc = DOCUMENTS.find(
    (item) => item.id === id && canAccess(item.id, persona),
  );
  const results = searchCatalog(search, { persona, source, kind: "document" });
  useEffect(() => {
    knowledgeSearch = { search, source };
    if (!id)
      window.history.replaceState(
        null,
        "",
        `#/knowledge${search || source !== "All" ? `?q=${encodeURIComponent(search)}&source=${encodeURIComponent(source)}` : ""}`,
      );
  }, [search, source, id]);
  useEffect(() => {
    if (!doc) return;
    props.emit(
      doc.id === "revenue-definition"
        ? "definition_opened"
        : "documentation_opened",
      {},
      { source_system: doc.source.toLowerCase() },
    );
    const section = new URLSearchParams(window.location.hash.split("?")[1]).get(
      "section",
    );
    if (section)
      document
        .getElementById(`doc-section-${section}`)
        ?.scrollIntoView({ block: "start" });
  }, [id, persona]);
  const saveDoc = () => {
    if (!doc || !canAccess(doc.id, props.persona)) return;
    const saved = props.save({
      id: `doc-${doc.id}`,
      title: doc.title,
      kind: "documentation",
      route: `/knowledge/${doc.id}`,
      context: { filters: { ...filters } },
      filters: { ...filters },
    });
    if (saved) props.notify("Document saved to My Workspace");
  };
  if (id && !doc)
    return (
      <Empty title="Document unavailable">
        This resource is unknown or unavailable for the selected demo persona.{" "}
        <a href="#/knowledge">Return to Knowledge</a>
      </Empty>
    );
  if (doc)
    return (
      <div className="knowledge-detail">
        <Button
          className="text-button back-link"
          onClick={() =>
            navigate(
              `/knowledge${knowledgeSearch.search || knowledgeSearch.source !== "All" ? `?q=${encodeURIComponent(knowledgeSearch.search)}&source=${encodeURIComponent(knowledgeSearch.source)}` : ""}`,
            )
          }
        >
          <ArrowLeft size={16} />
          All knowledge
        </Button>
        <PageHead
          eyebrow="BUSINESS CONTEXT"
          title={doc.title}
          description={doc.description}
          actions={
            <>
              <Button
                aria-label={`${props.favorites.includes(doc.id) ? "Unfavorite" : "Favorite"} ${doc.title}`}
                aria-pressed={props.favorites.includes(doc.id)}
                onClick={() => props.favorite(doc.id)}
              >
                <Star
                  size={17}
                  fill={
                    props.favorites.includes(doc.id) ? "currentColor" : "none"
                  }
                />
                Favorite
              </Button>
              <Button onClick={saveDoc}>
                <Bookmark size={17} />
                Save document
              </Button>
            </>
          }
        />
        <div className="report-source">
          <Badge>{doc.source} · Sample document</Badge>
          <span>{doc.owner}</span>
          <span>
            Version {doc.version} · As of {doc.asOf}
          </span>
        </div>
        <aside
          className="context-panel document-context"
          aria-label="Investigation context"
        >
          <div>
            <strong>Your investigation context</strong>
            <p>{contextLabel(filters)}</p>
          </div>
          <a href="#/reports/finance-report">
            <ArrowLeft size={15} />
            Return to Finance report
          </a>
          {canAccess("credits-by-period", persona) && (
            <a href="#/data-explorer?template=credits-by-period">
              Inspect credits query
              <ArrowRight size={15} />
            </a>
          )}
        </aside>
        <article className="panel document-body">
          <nav className="document-toc" aria-label="In this document">
            <span>On this page</span>
            {doc.sections.map((section: DocumentSection) => (
              <a
                key={section.id}
                href={`#/knowledge/${doc.id}?section=${section.id}`}
                onClick={(event) => {
                  event.preventDefault();
                  window.history.replaceState(
                    null,
                    "",
                    `#/knowledge/${doc.id}?section=${section.id}`,
                  );
                  const target = document.getElementById(
                    `doc-section-${section.id}`,
                  );
                  target?.focus({ preventScroll: true });
                  target?.scrollIntoView({ block: "start" });
                }}
              >
                {section.title}
              </a>
            ))}
          </nav>
          {doc.sections.map((section: DocumentSection) => (
            <section
              className="document-section"
              key={section.id}
              id={`doc-section-${section.id}`}
              tabIndex={-1}
            >
              <h2>{section.title}</h2>
              {section.paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </section>
          ))}
          <footer className="document-footer">
            <FileText size={16} />
            <span>
              Original public reference content · {doc.source} sample adapter
            </span>
          </footer>
        </article>
        <section className="document-next">
          <div>
            <p className="eyebrow">KEEP THE INVESTIGATION MOVING</p>
            <h2>Put the definition to work</h2>
          </div>
          <div className="toolbar">
            {doc.id !== "close-note" && canAccess("close-note", persona) && (
              <Button onClick={() => navigate("/knowledge/close-note")}>
                Read close note
                <ArrowRight size={16} />
              </Button>
            )}
            <Button className="primary" onClick={() => navigate("/ask-iq")}>
              Explain with Ask IQ
              <ArrowRight size={16} />
            </Button>
          </div>
        </section>
        <section className="panel related-documents">
          <h2>Related reports</h2>
          <div className="toolbar">
            {REPORTS.filter(
              (report) =>
                doc.relatedIds.includes(report.id) &&
                canAccess(report.id, persona),
            ).map((report) => (
              <a key={report.id} href={`#/reports/${report.id}`}>
                {report.title}
                <ArrowRight size={15} />
              </a>
            ))}
          </div>
        </section>
      </div>
    );
  return (
    <>
      <PageHead
        eyebrow="DEFINITIONS & GUIDANCE"
        title="Knowledge"
        description="Understand what a number means, where it comes from, and how to use it."
      />
      <form
        className="catalog-tools"
        onSubmit={(event) => {
          event.preventDefault();
          props.emit("search_submitted", { category: "knowledge" });
          props.emit("search_results_shown", {
            visible_count: results.length,
            coverage_complete: true,
          });
        }}
      >
        <label className="search-input">
          <Search size={18} />
          <input
            aria-label="Search knowledge"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search definitions, close notes, and guidance"
          />
        </label>
        <label className="knowledge-source">
          Source
          <select
            value={source}
            onChange={(event) => setSource(event.target.value)}
          >
            <option>All</option>
            <option>Confluence</option>
            <option>SharePoint</option>
          </select>
        </label>
        <Button type="submit">Search</Button>
      </form>
      <p className="result-count">
        {results.length} permitted sample documents · Safe text rendered inside
        the workspace
      </p>
      {results.length ? (
        <div className="knowledge-grid">
          {results.map((item: any) => (
            <article className="panel knowledge-card" key={item.id}>
              <div className="spread">
                <Badge>{item.source}</Badge>
                <BookOpen size={20} />
              </div>
              <h2>
                <a
                  href={`#/knowledge/${item.id}`}
                  onClick={() =>
                    props.emit("search_result_opened", {
                      resource_type: "documentation",
                    })
                  }
                >
                  {item.title}
                  <ArrowRight size={17} />
                </a>
              </h2>
              <p>{item.description}</p>
              <div className="card-meta">
                <span>{item.owner}</span>
                <span>
                  Version {item.version} · {item.asOf}
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="No matching documents">
          Try “revenue”, “credits”, or “refresh”, or{" "}
          <button
            className="text-button"
            onClick={() => {
              setSearch("");
              setSource("All");
            }}
          >
            clear the filters
          </button>
          .
        </Empty>
      )}
    </>
  );
}

function initialQuestion() {
  const question = new URLSearchParams(window.location.hash.split("?")[1]).get(
    "question",
  );
  return GUIDED_QUESTIONS.some((item) => item.id === question)
    ? question
    : null;
}

export function AskIQ(props: PageProps) {
  const { filters, setFilters, persona, navigate } = props;
  const [question, setQuestion] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(initialQuestion);
  const [requestVersion, setRequestVersion] = useState(0);
  const [scenario, setScenario] = useState(() => {
    const value = new URLSearchParams(window.location.hash.split("?")[1]).get(
      "scenario",
    );
    return EVIDENCE_SCENARIOS.some((item) => item.id === value)
      ? value!
      : "baseline";
  });
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const answer: any = useMemo(
    () =>
      submitted
        ? runGuidedQuestion(submitted, { filters, persona, scenario })
        : null,
    [
      submitted,
      requestVersion,
      filters.period,
      filters.entity,
      filters.region,
      filters.product,
      persona,
      scenario,
    ],
  );
  useEffect(() => {
    if (!answer) return;
    props.emit("iq_answer_presented", {
      outcome: ["reconciled", "supported"].includes(answer.status)
        ? "success"
        : "partial",
    });
    const supportedQuestion = GUIDED_QUESTIONS.find(
      (item) => item.question === answer.question,
    );
    if (supportedQuestion)
      window.history.replaceState(
        null,
        "",
        `#/ask-iq?question=${supportedQuestion.id}&scenario=${scenario}`,
      );
    else window.history.replaceState(null, "", "#/ask-iq");
    setFeedback("");
  }, [answer]);
  const ask = (text: string) => {
    if (!text.trim()) {
      setError("Choose a suggested question or enter a supported question.");
      return;
    }
    setError("");
    setSubmitted(text.trim());
    setRequestVersion((value) => value + 1);
    props.emit("iq_question_submitted");
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    ask(question);
  };
  const saveAnswer = () => {
    if (!answer || answer.status === "unsupported") return;
    const item = GUIDED_QUESTIONS.find(
      (entry) => entry.question === answer.question,
    );
    if (!item) return;
    const saved = props.save({
      id: `investigation-${item.id}-${filters.period}-${filters.region}-${filters.product}-${scenario}`,
      title: `Revenue investigation · ${periodLabel(filters.period)}`,
      kind: "investigation",
      route: `/ask-iq?question=${item.id}&scenario=${scenario}`,
      context: { filters: { ...filters }, question: item.id, scenario },
      filters: { ...filters },
    });
    if (saved) props.notify("Investigation saved to My Workspace");
  };
  const openCitation = (citation: any) => {
    const type = citation.href.includes("/reports/")
      ? "report"
      : citation.href.includes("/data-explorer")
        ? "query"
        : "documentation";
    props.emit(
      "iq_source_opened",
      { resource_type: type },
      {
        source_system: String(citation.platform ?? "enterprise-iq")
          .toLowerCase()
          .replace("power bi", "power-bi"),
      },
    );
    navigate(citation.href.replace(/^#/, ""));
  };
  return (
    <div className="ask-page">
      <PageHead
        eyebrow="FOLLOW THE EVIDENCE"
        title="Ask IQ"
        description="Connect the numbers with their definitions, supporting records, and source context."
        actions={<Badge>Guided demo · No live LLM</Badge>}
      />
      <FiltersBar filters={filters} onChange={setFilters} />
      <section className="panel ask-composer" aria-label="Guided questions">
        <div className="ask-introduction">
          <div className="ask-mark">
            <Sparkles size={21} />
          </div>
          <div>
            <h2>A clearer answer starts with the right context.</h2>
            <p>
              Choose a guided question about the synthetic revenue
              investigation.
            </p>
          </div>
        </div>
        <div className="question-grid">
          {GUIDED_QUESTIONS.map((item) => (
            <button
              className={`question-button ${submitted === item.id ? "selected" : ""}`}
              key={item.id}
              onClick={() => {
                setQuestion(item.question);
                ask(item.id);
              }}
            >
              <span>{item.title}</span>
              <ArrowRight size={17} />
            </button>
          ))}
        </div>
        <form className="ask-form" onSubmit={submit}>
          <label htmlFor="guided-question">
            Or enter one of the supported questions
          </label>
          <div className="ask-input-row">
            <textarea
              id="guided-question"
              rows={2}
              maxLength={300}
              value={question}
              onChange={(event) => {
                setQuestion(event.target.value);
                setError("");
              }}
              placeholder="Why do Finance and Sales show different revenue?"
              aria-describedby="ask-scope"
            />
            <Button className="primary" type="submit">
              Ask IQ
              <ArrowRight size={17} />
            </Button>
          </div>
          <p id="ask-scope">
            Supported scope: gross vs. net revenue, credits, freshness, and
            related resources. Answers use deterministic evidence checks.
          </p>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </form>
        <details className="evidence-controls">
          <summary>Try a different evidence scenario</summary>
          <label>
            Evidence available
            <select
              value={scenario}
              onChange={(event) => setScenario(event.target.value)}
            >
              {EVIDENCE_SCENARIOS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <p>
            Changing evidence, scope, or demo persona immediately rechecks the
            displayed answer.
          </p>
        </details>
      </section>
      {answer ? (
        <section
          className="panel answer-panel"
          aria-label="Guided answer"
          aria-live="polite"
        >
          <div className="section-head">
            <div>
              <p className="eyebrow">
                {answer.status === "reconciled"
                  ? "THE FIGURES RECONCILE"
                  : answer.status === "supported"
                    ? "SUPPORTED GUIDANCE"
                    : answer.status === "unsupported"
                      ? "SUPPORTED SCOPE"
                      : "EVIDENCE NEEDS REVIEW"}
              </p>
              <h2>{answer.conclusion}</h2>
            </div>
            {answer.status === "reconciled" && (
              <span className="answer-check">
                <Check size={20} />
                <span className="sr-only">Reconciled</span>
              </span>
            )}
          </div>
          <p className="answer-context">{contextLabel(filters)}</p>
          {answer.calculation && (
            <div
              className="answer-calculation"
              aria-label="Revenue calculation"
            >
              <div>
                <span>Gross revenue v1</span>
                <strong>{money(answer.calculation.amounts.grossCents)}</strong>
              </div>
              <span aria-hidden="true">−</span>
              <div>
                <span>Period credits v1</span>
                <strong>
                  {money(answer.calculation.amounts.creditsCents)}
                </strong>
              </div>
              <span aria-hidden="true">=</span>
              <div>
                <span>Net revenue v2</span>
                <strong>
                  {money(answer.calculation.amounts.calculatedNetCents)}
                </strong>
              </div>
            </div>
          )}
          <p className="answer-text">{answer.answer}</p>
          {answer.breakdown && (
            <DataTable
              rows={answer.breakdown}
              columns={[
                { key: "name", label: "Credit reason" },
                { key: "creditsCents", label: "Posted credits", money: true },
              ]}
              caption="Supporting credits in the selected scope"
            />
          )}
          {answer.citations.length > 0 && (
            <div className="answer-evidence">
              <h3>Evidence you can inspect</h3>
              <div className="citation-grid">
                {answer.citations.map((citation: any, index: number) => (
                  <button
                    className="citation-link"
                    key={citation.id}
                    onClick={() => openCitation(citation)}
                  >
                    <span className="citation-number">{index + 1}</span>
                    <span>
                      <strong>{citation.title}</strong>
                      <small>{citation.platform} · Sample source</small>
                    </span>
                    <ArrowRight size={16} />
                  </button>
                ))}
              </div>
            </div>
          )}
          {answer.status !== "unsupported" && (
            <footer className="answer-actions">
              <Button className="primary" onClick={saveAnswer}>
                <Bookmark size={17} />
                Save investigation
              </Button>
              <a href="#/reports/finance-report">
                Return to report
                <ArrowRight size={16} />
              </a>
              {answer.followUps?.map((item: any) => (
                <a key={item.label} href={item.href}>
                  {item.label}
                  <ArrowRight size={15} />
                </a>
              ))}
            </footer>
          )}
          {answer.status !== "unsupported" && (
            <div className="answer-feedback">
              <span>Was this guidance useful?</span>
              {["helpful", "unhelpful"].map((rating) => (
                <Button
                  key={rating}
                  aria-pressed={feedback === rating}
                  onClick={() => {
                    if (feedback === rating) return;
                    setFeedback(rating);
                    props.emit("iq_feedback_submitted", { rating });
                    props.notify("Feedback selected for this answer");
                  }}
                >
                  {rating === "helpful" ? "Useful" : "Needs more context"}
                </Button>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="ask-empty">
          <BookOpen size={24} />
          <p>
            Your answer will include the calculation, its reporting scope, and
            links to the permitted evidence.
          </p>
        </section>
      )}
    </div>
  );
}
