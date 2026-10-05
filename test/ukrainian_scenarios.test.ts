/**
 * Table of Ukrainian control scenarios, one block per autocorrect rule (at least five cases each):
 * "input -> expected". It complements ukrainian.test.ts, which pins individual regressions, by
 * giving the whole rule set a single reviewable list (spec FR-004..FR-009, FR-017; SC-002, SC-005).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  tokenizeWords,
  normalizeWord,
  isSentenceTerminator,
  buildAbbreviationSet,
  shouldCapitalizeNext,
  defaultSentenceCaseConfig,
  applyAutoCapitalization,
  apostropheVariants,
  repairHomoglyphs,
  foldDiacritics,
  classifyMarkdownContext,
  protectedRanges,
  decideCorrection,
  Engine,
} from "../src/predictive/engine/index.ts";

const cfg = defaultSentenceCaseConfig();
const abbr = buildAbbreviationSet();

/** Run `fn` over every [input, expected] pair and name the offending input on failure. */
function table<I, O>(cases: [I, O][], fn: (input: I) => O) {
  for (const [input, expected] of cases) assert.deepEqual(fn(input), expected, `input: ${JSON.stringify(input)}`);
}

// ---- rule: capital letter at the start of a sentence ------------------------------------------

test("rule «великі літери»: the first word of a sentence is capitalised", () => {
  table<[string, string], string>(
    [
      [["привіт", ""], "Привіт"],
      [["як", "Привіт. "], "Як"],
      [["так", "Це правда? "], "Так"],
      [["ні", "Ура! "], "Ні"],
      [["їжак", "Він побачив ліс. "], "Їжак"],
      [["ґанок", "Це дім. "], "Ґанок"],
      [["слово", "ми кажемо "], "слово"],
    ],
    ([word, before]) => applyAutoCapitalization(word, before, cfg),
  );
});

// ---- rule: abbreviations never end a sentence --------------------------------------------------

test("rule «скорочення»: a full stop after an abbreviation is not a sentence end", () => {
  table<[string, string], boolean>(
    [
      [["т.д.", "Він"], false],
      [["т.п.", "Вона"], false],
      [["напр.", "Київ"], false],
      [["грн.", "Це"], false],
      [["ст.", "Було"], false],
      [["проф.", "Іваненко"], false],
      [["додому.", "Він"], true],
      [["вчора.", "Було"], true],
    ],
    ([token, next]) => isSentenceTerminator(token, next, abbr),
  );
  assert.equal(shouldCapitalizeNext("Купили хліб, молоко і т.д. ", cfg), false);
  assert.equal(shouldCapitalizeNext("у XIX ст. ", cfg), false);
});

// ---- rule: apostrophe --------------------------------------------------------------------------

test("rule «апостроф»: ', ’ and ʼ are one letter inside a word", () => {
  table<string, string>(
    [
      ["м'яч", "м'яч"],
      ["м’яч", "м'яч"],
      ["мʼяч", "м'яч"],
      ["п'ять", "п'ять"],
      ["п’ять", "п'ять"],
      ["сім’я", "сім'я"],
      ["об'єкт", "об'єкт"],
    ],
    normalizeWord,
  );
  assert.deepEqual(tokenizeWords("м'яч п’ять сімʼя"), ["м'яч", "п'ять", "сім'я"]);
  table<string, boolean>(
    [
      ["мяч", true],
      ["пять", true],
      ["сімя", true],
      ["обєкт", true],
      ["зєднання", true],
      ["м'яч", false],
    ],
    (w) => apostropheVariants(w).length > 0,
  );
});

// ---- rule: Ukrainian letters are word letters --------------------------------------------------

test("rule «літери і, ї, є, ґ»: they stay inside words and are not folded away", () => {
  table<string, string[]>(
    [
      ["їжак", ["їжак"]],
      ["Європа", ["європа"]],
      ["ґанок", ["ґанок"]],
      ["Київ і Львів", ["київ", "і", "львів"]],
      ["мій їжак", ["мій", "їжак"]],
      ["Україна, Європа!", ["україна", "європа"]],
    ],
    tokenizeWords,
  );
  assert.equal(foldDiacritics("Мій їжак"), "мій їжак");
  assert.equal(foldDiacritics("ґудзик"), "ґудзик");
  assert.equal(foldDiacritics("єдиний"), "єдиний");
});

// ---- rule: Latin look-alikes in Ukrainian words ------------------------------------------------

test("rule «латинські двійники»: look-alikes are repaired, genuine English is left alone", () => {
  table<string, string | null>(
    [
      ["сьогоднi", "сьогодні"],
      ["привiт", "привіт"],
      ["укpаїна", "україна"],
      ["to", null],
      ["hello", null],
      ["привіт", null],
    ],
    repairHomoglyphs,
  );
});

// ---- rule: do not touch code, links, frontmatter, English --------------------------------------

test("rule «не чіпати»: protected Markdown zones are never suggested into", () => {
  table<string, boolean>(
    [
      ["Використай `git comm", true],
      ["```python\nприв", true],
      ["Дивись [[Моя нота", true],
      ["Дивись https://example.com/пр", true],
      ["---\ntitle: пр", true],
      ["Це звичайний текст пр", false],
    ],
    (text) => classifyMarkdownContext(text).suppressPrediction,
  );
  const text = "Код `привіт` і [[Нота|алiас]] тут";
  const ranges = protectedRanges(text);
  assert.ok(ranges.some(([a, b]) => text.slice(a, b).includes("привіт")), "inline code is a protected range");
  assert.ok(ranges.some(([a, b]) => text.slice(a, b).includes("Нота")), "a wikilink is a protected range");
});

test("rule «не чіпати»: English and mixed tokens are not corrected", () => {
  const corpus = Array.from({ length: 30 }, () => "Це дуже гарний проєкт для ґанку. Єдиний варіант тут.").join("\n");
  const e = Engine.fromText(corpus);
  const run = (typed: string) => decideCorrection(e.model, e.index, typed, [], { skipLatin: true });
  for (const w of ["git", "README", "obsidian", "TypeScript", "markdown"]) {
    const r = run(w);
    assert.equal(r.correct, false, w);
    assert.equal(r.to, w, `${w} must come back unchanged`);
  }
});

// ---- spelling (2019): valid forms are not "corrected" -----------------------------------------

test("rule «правопис 2019»: valid modern forms are left unchanged", () => {
  const corpus = Array.from({ length: 30 }, () => "Це дуже гарний проєкт для ґанку. Єдиний варіант тут. Ґудзик на пальті.").join("\n");
  const e = Engine.fromText(corpus);
  const run = (typed: string) => decideCorrection(e.model, e.index, typed, [], { skipLatin: true });
  for (const w of ["проєкт", "єдиний", "ґанку", "ґудзик", "варіант"]) assert.equal(run(w).correct, false, w);
});

// ---- Russian letters are not silently "fixed" --------------------------------------------------

test("Russian-only letters are not turned into Ukrainian ones", () => {
  for (const w of ["ы", "э", "ъ", "ё", "что", "только"]) {
    assert.equal(repairHomoglyphs(w), null, w);
    assert.ok(!/[іїєґ]/.test(normalizeWord(w)), `${w} must not gain Ukrainian letters`);
  }
});
