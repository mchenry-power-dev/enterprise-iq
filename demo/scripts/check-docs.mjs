import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { marked } from "marked";
import GithubSlugger from "github-slugger";
import { chromium } from "@playwright/test";

// A local Markdown approximation, not a claim about GitHub's current renderer.
// Temporary HTML, screenshots, and results stay outside public deliverables.
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const output = path.join(root, ".local", "docs-review");
await mkdir(output, { recursive: true });
const files = [
  "README.md",
  "AGENTS.md",
  "examples/README.md",
  ...(await readdir(path.join(root, "docs")))
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => `docs/${name}`),
];
const diagrams = [
  "enterprise-workspace.svg",
  "experience-feedback-loop.svg",
  "authorized-question-flow.svg",
];
const markdown = new Map(
  await Promise.all(
    files.map(async (file) => [
      file,
      await readFile(path.join(root, file), "utf8"),
    ]),
  ),
);
const failures = [];
const manifest = [];
const renders = [];
const svgRenders = [];
const anchors = new Map();
let relativeLinks = 0;
let externalLinks = 0;
let tables = 0;
let disclosures = 0;
const fail = (file, check, details) =>
  failures.push({ file, check, ...details });
// Preserve source hashes, but do not let a valid UTF-8 BOM hide a first heading.
const markdownInput = (body) => body.replace(/^\uFEFF/, "");
const plainHeading = (token) =>
  token.tokens
    ?.map((item) => (item.type === "html" ? "" : (item.text ?? "")))
    .join("") ?? token.text;
const escape = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

function tableCells(row) {
  let text = row.trim();
  if (text.startsWith("|")) text = text.slice(1);
  if (text.endsWith("|") && !text.endsWith("\\|")) text = text.slice(0, -1);
  return text.split(/(?<!\\)\|/).length;
}

for (const [file, body] of markdown) {
  manifest.push({
    file,
    sha256: createHash("sha256").update(body).digest("hex"),
  });
  const slugger = new GithubSlugger();
  const ids = new Set();
  const html = [];
  marked.walkTokens(marked.lexer(markdownInput(body)), (token) => {
    if (token.type === "heading") ids.add(slugger.slug(plainHeading(token)));
    if (token.type === "html") html.push(token.text);
    if (token.type === "table") {
      tables++;
      const columns = token.header.length;
      for (const [index, row] of token.raw.trim().split("\n").entries()) {
        if (tableCells(row) !== columns)
          fail(file, "table_columns", {
            row: index + 1,
            expected: columns,
            actual: tableCells(row),
          });
      }
      if (token.header.some((cell) => !cell.text.trim()))
        fail(file, "table_header", {
          message: "An empty header has no useful column label.",
        });
    }
  });
  const stack = [];
  for (const match of html
    .join("\n")
    .matchAll(/<\/?(details|summary)\b[^>]*>/gi)) {
    const closing = match[0].startsWith("</");
    const name = match[1].toLowerCase();
    if (!closing) {
      stack.push(name);
      if (name === "details") disclosures++;
    } else if (stack.pop() !== name)
      fail(file, "disclosure_markup", {
        message: "Unbalanced details/summary markup.",
      });
  }
  if (stack.length)
    fail(file, "disclosure_markup", {
      message: "Unclosed details/summary markup.",
    });
  for (const match of html
    .join("\n")
    .matchAll(/\b(?:id|name)=["']([^"']+)["']/g)) {
    if (ids.has(match[1])) fail(file, "duplicate_anchor", { anchor: match[1] });
    ids.add(match[1]);
  }
  anchors.set(file, ids);
}

async function exactFile(relative) {
  let location = root;
  for (const segment of relative.split("/")) {
    if (!segment) continue;
    if (!(await readdir(location)).includes(segment))
      throw new Error("Missing path or incorrect filename case");
    location = path.join(location, segment);
  }
}

async function checkLink(file, href) {
  if (!href) {
    fail(file, "empty_link", { href });
    return;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")) {
    externalLinks++;
    return;
  }
  relativeLinks++;
  try {
    const separator = href.indexOf("#");
    const target = separator < 0 ? href : href.slice(0, separator);
    const hash =
      separator < 0 ? "" : decodeURIComponent(href.slice(separator + 1));
    const name = decodeURIComponent(target.split("?")[0]);
    const relative = name
      ? path.posix.normalize(path.posix.join(path.posix.dirname(file), name))
      : file;
    if (name.startsWith("/") || relative.startsWith("../"))
      throw new Error("Link leaves repository-relative scope");
    await exactFile(relative);
    if (hash && anchors.has(relative) && !anchors.get(relative).has(hash))
      throw new Error(`Missing anchor: ${hash}`);
  } catch (error) {
    fail(file, "relative_link", { href, message: error.message });
  }
}

const styles = `:root{font:16px/1.65 system-ui;color:#1f2937;background:#fff;color-scheme:light dark;--border:#d5dce5;--surface:#f5f7fa;--link:#2055b4}*{box-sizing:border-box}body{margin:0}main{max-width:950px;margin:auto;padding:28px;min-width:0}h1,h2,h3{line-height:1.3;margin:28px 0 15px}h1{font-size:32px}h2{font-size:24px}h3{font-size:20px}a{color:var(--link);overflow-wrap:anywhere}p,li{overflow-wrap:anywhere}img{max-width:100%;height:auto}table{border-collapse:collapse;font-size:14px;min-width:500px;width:100%}td,th{border:1px solid var(--border);padding:10px;text-align:left;vertical-align:top}th{background:var(--surface)}.table-scroll,pre{overflow:auto;max-width:100%}pre{padding:18px;background:var(--surface);border-radius:6px}code{font-family:Consolas,monospace;font-size:.9em}details{padding:12px;border:1px solid var(--border);margin:15px 0}summary{cursor:pointer;min-height:32px}svg{max-width:100%;height:auto;display:block}hr{border:0;border-top:1px solid var(--border);margin:30px 0}.diagram-review{max-width:1440px}.diagram-review a{display:inline-block;margin-top:16px}@media(prefers-color-scheme:dark){:root{color:#e2e8f0;background:#101820;--border:#455364;--surface:#1c2835;--link:#91baff}}@media(max-width:500px){main{padding:18px}h1{font-size:28px}h2{font-size:22px}table{font-size:13px}td,th{padding:9px}}`;
function documentHtml(content, className = "") {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Enterprise IQ documentation review</title><style>${styles}</style></head><body><main class="${className}">${content}</main></body></html>`;
}
function render(body) {
  const slugger = new GithubSlugger();
  const renderer = new marked.Renderer();
  renderer.heading = function (token) {
    return `<h${token.depth} id="${slugger.slug(plainHeading(token))}">${this.parser.parseInline(token.tokens)}</h${token.depth}>`;
  };
  renderer.table = function (token) {
    return `<div class="table-scroll" tabindex="0" aria-label="Scrollable documentation table">${marked.Renderer.prototype.table.call(this, token)}</div>`;
  };
  return documentHtml(marked.parse(markdownInput(body), { renderer }));
}

const server = createServer(async (req, res) => {
  try {
    const relative =
      decodeURIComponent(new URL(req.url, "http://localhost").pathname).slice(
        1,
      ) || "README.md";
    const resolved = path.resolve(root, relative);
    if (
      !resolved.startsWith(root + path.sep) ||
      relative
        .split("/")
        .some((segment) => segment === ".git" || segment === ".env")
    )
      throw new Error();
    if (relative.startsWith("_review/")) {
      const name = relative.slice(8);
      if (!diagrams.includes(name)) throw new Error();
      const svg = await readFile(path.join(root, "diagrams", name), "utf8");
      res.setHeader("Content-Type", "text/html;charset=utf-8");
      res.end(
        documentHtml(
          `${svg}<a href="/diagrams/${escape(name)}">Open original scalable SVG</a>`,
          "diagram-review",
        ),
      );
    } else if (markdown.has(relative)) {
      res.setHeader("Content-Type", "text/html;charset=utf-8");
      res.end(render(markdown.get(relative)));
    } else {
      res.setHeader(
        "Content-Type",
        { ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg" }[
          path.extname(relative)
        ] ?? "application/octet-stream",
      );
      res.end(await readFile(resolved));
    }
  } catch {
    res.statusCode = 404;
    res.end("Not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
const page = await browser.newPage();
await page.route("**/*", (route) =>
  new URL(route.request().url()).origin === new URL(base).origin
    ? route.continue()
    : route.abort(),
);
page.on("pageerror", (error) =>
  fail("renderer", "browser_error", { message: error.message }),
);

async function renderedState() {
  return page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    missingImages: [...document.images]
      .filter((image) => !image.complete || image.naturalWidth === 0)
      .map((image) => image.getAttribute("src")),
    unlabelledImages: [...document.images]
      .filter((image) => !image.getAttribute("alt")?.trim())
      .map((image) => image.getAttribute("src")),
    duplicateIds: [...document.querySelectorAll("[id]")]
      .map((node) => node.id)
      .filter((id, index, all) => all.indexOf(id) !== index),
    tables: [...document.querySelectorAll("table")].map((table) => ({
      columns: table.querySelectorAll("thead th").length,
      rows: table.querySelectorAll("tbody tr").length,
      contained: !!table.closest(".table-scroll"),
    })),
    disclosures: [...document.querySelectorAll("details")].map((details) => ({
      summaries: details.querySelectorAll(":scope > summary").length,
      firstChild: details.firstElementChild?.tagName,
      hasContent:
        details.textContent.trim().length >
        (details.querySelector("summary")?.textContent.trim().length ?? 0),
    })),
  }));
}

try {
  for (const scheme of ["light", "dark"])
    for (const width of [1000, 360]) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      for (const file of files) {
        await page.goto(base + file, { waitUntil: "networkidle" });
        const state = await renderedState();
        const stem = file.replaceAll("/", "-").replace(/\.md$/, "");
        renders.push({ file, width, scheme, ...state });
        if (
          state.overflow ||
          state.missingImages.length ||
          state.unlabelledImages.length ||
          state.duplicateIds.length
        )
          fail(file, "render", { width, scheme, ...state });
        if (
          state.tables.some(
            (table) => !table.columns || !table.rows || !table.contained,
          )
        )
          fail(file, "table_render", { width, scheme });
        if (
          state.disclosures.some(
            (details) =>
              details.summaries !== 1 ||
              details.firstChild !== "SUMMARY" ||
              !details.hasContent,
          )
        )
          fail(file, "disclosure_render", { width, scheme });
        if (scheme === "light" && width === 1000) {
          const links = await page
            .locator("a[href],img[src]")
            .evaluateAll((nodes) =>
              nodes.map((node) =>
                node.getAttribute(node.tagName === "IMG" ? "src" : "href"),
              ),
            );
          for (const href of links) await checkLink(file, href);
        }
        await page.screenshot({
          path: path.join(output, `${stem}-${width}-${scheme}.png`),
          fullPage: true,
        });
        for (const [index, details] of (
          await page.locator("details").all()
        ).entries()) {
          const summary = details.locator(":scope > summary");
          await summary.focus();
          await page.keyboard.press("Enter");
          if (!(await details.evaluate((node) => node.open)))
            fail(file, "disclosure_keyboard", { index, width, scheme });
        }
        if (state.disclosures.length) {
          if ((await renderedState()).overflow)
            fail(file, "expanded_disclosure_overflow", { width, scheme });
          await page.screenshot({
            path: path.join(output, `${stem}-${width}-${scheme}-expanded.png`),
            fullPage: true,
          });
        }
      }
      for (const name of diagrams) {
        await page.goto(base + "_review/" + name, { waitUntil: "networkidle" });
        const svgState = await page.locator("svg").evaluate((svg) => {
          const view = svg.viewBox.baseVal;
          return {
            title: svg.querySelector("title")?.textContent,
            description: svg.querySelector("desc")?.textContent,
            viewBox: { width: view.width, height: view.height },
            clippedText: [...svg.querySelectorAll("text")]
              .filter((text) => {
                const box = text.getBBox();
                return (
                  box.x < view.x - 1 ||
                  box.y < view.y - 1 ||
                  box.x + box.width > view.x + view.width + 1 ||
                  box.y + box.height > view.y + view.height + 1
                );
              })
              .map((text) => text.textContent),
          };
        });
        const state = await renderedState();
        svgRenders.push({
          file: `diagrams/${name}`,
          width,
          scheme,
          ...svgState,
          overflow: state.overflow,
        });
        if (
          !svgState.title ||
          !svgState.description ||
          svgState.clippedText.length ||
          state.overflow
        )
          fail(name, "svg_render", {
            width,
            scheme,
            ...svgState,
            overflow: state.overflow,
          });
        await page.screenshot({
          path: path.join(output, `${name}-${width}-${scheme}.png`),
          fullPage: true,
        });
      }
    }
  for (const name of diagrams) {
    await page.emulateMedia({ colorScheme: "light" });
    await page.setViewportSize({ width: 1440, height: 1400 });
    await page.goto(base + "_review/" + name);
    await page.screenshot({
      path: path.join(output, `${name}-1440-light.png`),
      fullPage: true,
    });
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

const result = {
  checkedAt: new Date().toISOString(),
  method:
    "Local marked/GitHub-slugger render in Chromium; not GitHub UI verification",
  runtime: process.version,
  browser: browser.version(),
  markdownFiles: files.length,
  relativeLinks,
  externalLinksNotFetched: externalLinks,
  tables,
  disclosures,
  markdownRenders: renders.length,
  svgRenders: svgRenders.length,
  additionalNativeSvgCaptures: 3,
  profiles: { widths: [1000, 360], schemes: ["light", "dark"] },
  failures,
  manifest,
  renders,
  diagrams: svgRenders,
};
await writeFile(
  path.join(output, "results.json"),
  JSON.stringify(result, null, 2),
);
console.log(
  JSON.stringify(
    { ...result, manifest: undefined, renders: undefined, diagrams: undefined },
    null,
    2,
  ),
);
if (failures.length) process.exitCode = 1;
