/**
 * Guards the Ukrainian translation: the catalogue is complete and well-formed, and no
 * user-visible string bypasses it.
 *
 * Two classes of bug this exists for, both of which shipped once:
 *  - a string passed straight to a UI call (`setName("Tidy currency amounts")`) is invisible to the
 *    catalogue, so it stays English forever and no test of the catalogue can notice;
 *  - a translation that drifts from its source (a lost {placeholder}, a label that says "space"
 *    for a comma).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const ts = require("typescript") as typeof import("typescript");
const SRC = join(import.meta.dirname, "..", "src");
const I18N = join(SRC, "predictive", "i18n.ts");

/** Parse the `en` and `uk` object literals out of i18n.ts without importing it (it reads `window`). */
function catalogues(): { en: Map<string, string>; uk: Map<string, string> } {
  const sf = ts.createSourceFile(I18N, readFileSync(I18N, "utf8"), ts.ScriptTarget.Latest, true);
  const out: Record<string, Map<string, string>> = {};
  const visit = (n: import("typescript").Node) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && (n.name.text === "en" || n.name.text === "uk")) {
      let init = n.initializer;
      if (init && ts.isAsExpression(init)) init = init.expression;
      if (init && ts.isObjectLiteralExpression(init)) {
        const m = new Map<string, string>();
        for (const p of init.properties) {
          if (!ts.isPropertyAssignment(p)) continue;
          const key = ts.isStringLiteral(p.name) ? p.name.text : p.name.getText();
          // Values may be `"a" + "b"` concatenations; the compiler's own folding is not available,
          // so evaluate the (literal-only) expression.
          const val = evalLiteral(p.initializer);
          m.set(key, val);
        }
        out[n.name.text] = m;
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return { en: out.en, uk: out.uk };
}

function evalLiteral(e: import("typescript").Expression): string {
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken)
    return evalLiteral(e.left) + evalLiteral(e.right);
  if (ts.isParenthesizedExpression(e)) return evalLiteral(e.expression);
  throw new Error("i18n values must be string literals: " + e.getText());
}

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
const CYRILLIC = /[А-Яа-яІіЇїЄєҐґ]/;

test("every English key has a Ukrainian translation, and no stray ones exist", () => {
  const { en, uk } = catalogues();
  assert.ok(en.size > 250, `catalogue looks truncated (${en.size} keys)`);
  assert.deepEqual([...en.keys()].filter((k) => !uk.has(k)), [], "untranslated keys");
  assert.deepEqual([...uk.keys()].filter((k) => !en.has(k)), [], "Ukrainian keys with no English source");
});

test("translations keep the same {placeholders} as their source", () => {
  const { en, uk } = catalogues();
  for (const [k, v] of en) assert.equal(placeholders(uk.get(k) ?? ""), placeholders(v), `placeholders differ in "${k}"`);
});

test("translations are actually Ukrainian (not a copy of the English)", () => {
  const { en, uk } = catalogues();
  // Pure format strings / paths / key names that have nothing to translate.
  const exempt = new Set(["dict.heading", "ui.ph.TemplatesNjournal", "statusBar.text", "time.minutes"]);
  const untranslated = [...uk]
    .filter(([k, v]) => !exempt.has(k) && !CYRILLIC.test(v))
    .map(([k, v]) => `${k}: ${v.slice(0, 50)}`);
  assert.deepEqual(untranslated, [], "values with no Cyrillic at all");
  const same = [...uk].filter(([k, v]) => !exempt.has(k) && v === en.get(k) && /[a-z]{4}/i.test(v)).map(([k]) => k);
  assert.deepEqual(same, [], "values identical to the English source");
});

// ---- no user-visible literal may bypass t() ---------------------------------------------------

/** Calls whose argument is shown to the user. */
const TEXT_SINKS = new Set(["setName", "setDesc", "setText", "setButtonText", "setPlaceholder", "setTitle", "setTooltip", "addOption", "appendText"]);
/** Object-literal properties whose value is shown to the user. */
const TEXT_PROPS = new Set(["title", "body", "confirmText", "hint", "text", "display", "label"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = join(dir, d.name);
    if (d.isDirectory()) return d.name === "engine" || d.name === "generated" ? [] : sourceFiles(p);
    return d.name.endsWith(".ts") && d.name !== "i18n.ts" && d.name !== "tutorialImages.ts" ? [p] : [];
  });
}

/** Product names are the same in every language. */
const BRAND = new Set(["Smart Autocorrect", "Smart Autocorrect UA"]);

test("no user-visible string in the UI code bypasses the translation catalogue", () => {
  const offenders: string[] = [];
  for (const file of [...sourceFiles(join(SRC, "predictive")), join(SRC, "main.ts")]) {
    const sf = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    const flag = (n: import("typescript").Node, text: string) => {
      const { line } = sf.getLineAndCharacterOfPosition(n.getStart());
      offenders.push(`${file.slice(SRC.length + 1)}:${line + 1}: ${text.slice(0, 70)}`);
    };
    const literalText = (e: import("typescript").Expression): string | null => {
      if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
      if (ts.isTemplateExpression(e)) return e.head.text + e.templateSpans.map((s) => s.literal.text).join("");
      if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        const l = literalText(e.left), r = literalText(e.right);
        return l !== null || r !== null ? (l ?? "") + (r ?? "") : null;
      }
      return null;
    };
    const check = (n: import("typescript").Node, e: import("typescript").Expression) => {
      const text = literalText(e);
      if (text !== null && !BRAND.has(text) && /[A-Za-z]{3,}/.test(text) && /\s|[A-Z][a-z]+[A-Z]/.test(text.trim()) && !/^[#/.\w-]+$/.test(text)) flag(n, text);
    };
    const visit = (n: import("typescript").Node) => {
      if (ts.isCallExpression(n)) {
        const callee = n.expression;
        const name = ts.isPropertyAccessExpression(callee) ? callee.name.text : ts.isIdentifier(callee) ? callee.text : "";
        if (TEXT_SINKS.has(name) && n.arguments[0]) check(n, n.arguments[0]);
      }
      if (ts.isNewExpression(n) && n.expression.getText() === "Notice" && n.arguments?.[0]) check(n, n.arguments[0]);
      if (ts.isPropertyAssignment(n) && ts.isIdentifier(n.name)) {
        if (n.name.text === "name" && ts.isObjectLiteralExpression(n.parent) && n.parent.properties.some((p) => ts.isPropertyAssignment(p) && p.name.getText() === "id"))
          check(n, n.initializer); // addCommand({ id, name })
        if (TEXT_PROPS.has(n.name.text)) check(n, n.initializer);
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  assert.deepEqual(offenders, [], "user-visible strings that do not go through t():\n" + offenders.join("\n"));
});

// ---- the UI is Ukrainian whatever language Obsidian runs in -----------------------------------

test("t() answers in Ukrainian even when Obsidian is set to English", async () => {
  const g = globalThis as unknown as { window?: unknown };
  const before = g.window;
  g.window = { localStorage: { getItem: (k: string) => (k === "language" ? "en" : null) } };
  try {
    const { t } = await import("../src/predictive/i18n.ts");
    assert.equal(t("cmd.revert"), "Скасувати виправлення");
    assert.ok(CYRILLIC.test(t("assets.title")), "assets.title should be Ukrainian");
    assert.equal(t("dict.heading", { title: "Слова", count: 3 }), "Слова (3)");
  } finally {
    g.window = before;
  }
});
