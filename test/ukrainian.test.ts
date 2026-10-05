/**
 * Ukrainian-language behaviour of the text engine. The plugin began as an English-only fork base, so
 * each case here pins something that silently did nothing (or the wrong thing) for Cyrillic:
 * word boundaries, apostrophes, capitalisation, abbreviations, caps detection, the keyboard and the
 * phonetic channel, currency, tags and link matching.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  tokenizeWords,
  tokenizeWordsCased,
  normalizeWord,
  isSentenceTerminator,
  buildAbbreviationSet,
  shouldCapitalizeNext,
  defaultSentenceCaseConfig,
  applyAutoCapitalization,
  capitalizeFirst,
  fixDoubleCapital,
  upperFromText,
  isDoubledWord,
  isProfane,
  phoneticKey,
  phoneticCost,
  keyDistance,
  foldDiacritics,
  detectCurrency,
  currencyStyleFor,
  classifyMarkdownContext,
  protectedRanges,
  findLinkSpans,
  terms,
  segmentText,
  harmonizeProperCase,
  WORD_AT_END,
  AFTER_WORD_CHAR,
  AFTER_FINISHED_TOKEN,
  isFragmentPiece,
  channelCost,
  DEFAULT_CHANNEL,
  buildModelFromText,
  decideRespace,
} from "../src/predictive/engine/index.ts";

const cfg = defaultSentenceCaseConfig();

test("words: Cyrillic letters, apostrophes and hyphens stay inside one token", () => {
  assert.deepEqual(tokenizeWords("Привіт, світе! Це м'яч і п’ять ґанків."), ["привіт", "світе", "це", "м'яч", "і", "п'ять", "ґанків"]);
  assert.deepEqual(tokenizeWords("по-українськи"), ["по-українськи"]);
  // The three apostrophes people actually type are one letter: all fold to the ASCII one.
  assert.equal(normalizeWord("м’яч"), "м'яч");
  assert.equal(normalizeWord("мʼяч"), "м'яч");
  assert.equal(normalizeWord("«Київ»,"), "київ");
});

test("LSTM tokens: apostrophe words are single tokens, punctuation is its own token", () => {
  assert.deepEqual(tokenizeWordsCased("Це п’ять м'ячів, так?"), ["Це", "п'ять", "м'ячів", ",", "так", "?"]);
});

test("the caret regexes see Ukrainian words (they used to match only Latin / \\w)", () => {
  assert.equal(WORD_AT_END.exec("він сказав: привіт")?.[1], "привіт");
  assert.equal(WORD_AT_END.exec("мій м'яч")?.[1], "м'яч");
  assert.equal(WORD_AT_END.exec("по-українськи")?.[1], "по-українськи");
  // Next-word prediction fires after a finished word + space. \w is ASCII-only, so "привіт " used to fail.
  assert.ok(AFTER_WORD_CHAR.test("привіт "));
  assert.ok(AFTER_FINISHED_TOKEN.test("привіт "));
  assert.ok(AFTER_FINISHED_TOKEN.test("50 ₴ "), "a hryvnia sign also counts as a finished token");
  assert.ok(!AFTER_FINISHED_TOKEN.test("привіт, "), "a comma is not a finished word");
});

test("sentences: initials and Ukrainian abbreviations do not end a sentence", () => {
  const abbr = buildAbbreviationSet();
  for (const a of ["т.д", "т.п", "т.ч", "напр", "див", "тис", "млн", "грн", "вул", "проф", "р", "ст"]) assert.ok(abbr.has(a), a);
  // "Т. Г. Шевченко": the capital after an initial is the surname, not a new sentence.
  assert.equal(isSentenceTerminator("Т.", "Г.", abbr), false);
  assert.equal(isSentenceTerminator("Г.", "Шевченко", abbr), false);
  assert.equal(isSentenceTerminator("Т.Г.", "Шевченко", abbr), false);
  assert.equal(isSentenceTerminator("т.д.", "Він", abbr), false);
  assert.equal(isSentenceTerminator("2020", undefined, abbr), false);
  // ...while a real sentence end still is one.
  assert.equal(isSentenceTerminator("додому.", "Він", abbr), true);
  assert.equal(isSentenceTerminator("так!", "Він", abbr), true);
});

test("auto-capitalisation: Ukrainian sentence starts, and not after abbreviations", () => {
  assert.equal(shouldCapitalizeNext("", cfg), true);
  assert.equal(shouldCapitalizeNext("Ми прийшли додому. ", cfg), true);
  assert.equal(shouldCapitalizeNext("Що це? ", cfg), true);
  assert.equal(shouldCapitalizeNext("Він купив хліб, молоко і т.д. ", cfg), false);
  assert.equal(shouldCapitalizeNext("див. ", cfg), false);
  assert.equal(shouldCapitalizeNext("у 2020 р. ", cfg), false);
  assert.equal(shouldCapitalizeNext("Поет Т. ", cfg), true, "after a lone initial the surname is capitalised anyway");
  assert.equal(shouldCapitalizeNext("- ", cfg), true, "first word of a list item");
  assert.equal(applyAutoCapitalization("привіт", "", cfg), "Привіт");
  assert.equal(applyAutoCapitalization("привіт", "Ми прийшли. ", cfg), "Привіт");
  assert.equal(applyAutoCapitalization("привіт", "ми кажемо ", cfg), "привіт");
  // A custom abbreviation from settings is honoured.
  const custom = defaultSentenceCaseConfig(["т.зв."]);
  assert.equal(shouldCapitalizeNext("це т.зв. ", custom), false);
});

test("capitalisation helpers know Cyrillic", () => {
  assert.equal(capitalizeFirst("їжак"), "Їжак");
  assert.equal(capitalizeFirst("«їжак»"), "«Їжак»");
  assert.equal(capitalizeFirst("ґанок"), "Ґанок");
  assert.equal(fixDoubleCapital("ПРивіт"), "Привіт");
  assert.equal(fixDoubleCapital("ЗСУ"), "ЗСУ", "an acronym is left alone");
  assert.equal(fixDoubleCapital("Привіт"), "Привіт");
  // The English "i" -> "I" rule is off: a lone Latin i in Ukrainian text is a mistyped "і".
  assert.equal(applyAutoCapitalization("i", "ми ", cfg), "i");
  assert.equal(harmonizeProperCase("національний Банк України"), "Національний Банк України");
  assert.equal(harmonizeProperCase("Банк і Київ"), "Банк і Київ");
});

test("caps mode: Cyrillic shouting is detected, a lone acronym is not", () => {
  assert.equal(upperFromText("ПРИВІТ ВСІМ "), true);
  assert.equal(upperFromText("ПРИВ"), true);
  assert.equal(upperFromText("це ЗСУ "), false);
  assert.equal(upperFromText("привіт "), false);
});

test("doubled words: only function words that are never validly doubled", () => {
  assert.equal(isDoubledWord("в", "в"), true);
  assert.equal(isDoubledWord("На", "на"), true);
  assert.equal(isDoubledWord("і", "і"), true);
  assert.equal(isDoubledWord("та", "та"), false, "«та та жінка» is valid Ukrainian");
  assert.equal(isDoubledWord("дуже", "дуже"), false);
  assert.equal(isDoubledWord("не", "не"), false);
  assert.equal(isDoubledWord("книга", "книга"), false);
});

test("profanity filter covers Ukrainian roots and inflections, not innocent look-alikes", () => {
  for (const w of ["хуйня", "Пизда", "єбаний", "блядь", "мудак", "курва", "сука"]) assert.equal(isProfane(w), true, w);
  for (const w of ["курвіметр", "сучки", "хутір", "хуртовина", "хуліган", "пізно", "підорожник", "підорожчання", "срібло", "мудрий", "привіт"]) assert.equal(isProfane(w), false, w);
  assert.equal(isProfane("сука", new Set(["сука"])), false, "the personal allowlist wins");
});

test("keyboard: Cyrillic is measured on ЙЦУКЕН whatever layout is selected", () => {
  for (const layout of ["uk", "qwerty", "qwertz", "azerty", "dvorak"] as const) {
    assert.ok(keyDistance("а", "в", layout) <= 1, `а/в adjacent (${layout})`);
    assert.ok(keyDistance("й", "ю", layout) > 5, `й/ю far apart (${layout})`);
  }
  // Latin letters in a Ukrainian note keep a Latin layout, and "uk" means QWERTY for them.
  assert.ok(keyDistance("a", "s", "uk") <= 1);
  assert.ok(keyDistance("a", "p", "uk") > 5);
  const near = channelCost("п", "р", DEFAULT_CHANNEL);
  const far = channelCost("п", "ю", DEFAULT_CHANNEL);
  assert.ok(near < far, "an adjacent-key slip is a cheaper explanation than a distant one");
});

test("й and ї are letters, not accented и and і", () => {
  assert.equal(foldDiacritics("Мій їжак"), "мій їжак");
  assert.notEqual(foldDiacritics("мій"), foldDiacritics("миі"));
  assert.equal(foldDiacritics("Café"), "cafe", "Latin accents still fold");
});

test("phonetics: Ukrainian sound-alikes share a key, different words do not", () => {
  const same = [["привіт", "прівіт"], ["Україна", "Украіна"], ["життя", "житя"], ["м'яч", "мяч"], ["щастя", "шчастя"], ["вчитися", "вчитись"]];
  for (const [a, b] of same) assert.equal(phoneticKey(a), phoneticKey(b), `${a} ~ ${b}`);
  const different = [["кіт", "кит"], ["мама", "мати"], ["дім", "дам"]];
  // кіт/кит collapse by design (и/і are the classic Ukrainian slip), the rest must stay apart.
  assert.equal(phoneticKey("кіт"), phoneticKey("кит"));
  for (const [a, b] of different.slice(1)) assert.notEqual(phoneticKey(a), phoneticKey(b), `${a} !~ ${b}`);
  assert.ok(Number.isFinite(phoneticCost("прівіт", "привіт")), "a sound-alike has a finite phonetic cost");
  assert.equal(phoneticCost("привіт", "собака"), Infinity);
  // The English key still works for Latin words.
  assert.equal(phoneticKey("phone"), phoneticKey("fone"));
});

test("currency: hryvnia amounts use a space for thousands and the sign after the number", () => {
  const style = currencyStyleFor("space");
  const opts = { format: true, wordToSymbol: true, style };
  const nb = " ";
  assert.deepEqual(detectCurrency("1000 грн", opts), { start: 0, text: `1${nb}000 ₴` });
  assert.deepEqual(detectCurrency("купив за 25000 гривень", opts), { start: 9, text: `25${nb}000 ₴` });
  assert.deepEqual(detectCurrency("50 USD", opts), { start: 0, text: `$50` });
  assert.deepEqual(detectCurrency("100 євро", opts), { start: 0, text: "€100" });
  assert.deepEqual(detectCurrency("2000 доларів", opts), { start: 0, text: `$2${nb}000` });
  assert.deepEqual(detectCurrency("1000₴", opts), { start: 0, text: `1${nb}000 ₴` });
  assert.equal(detectCurrency("1000 книг", opts), null, "an ordinary word after a number is not a currency");
  assert.equal(detectCurrency("слово1000 грн", opts), null, "glued to a word: left alone");
  // Decimal comma is the Ukrainian mark.
  assert.deepEqual(detectCurrency("1234,5 грн", opts), { start: 0, text: `1${nb}234,50 ₴` });
  // The old comma/period styles still work.
  assert.deepEqual(detectCurrency("1000 грн", { ...opts, style: currencyStyleFor("comma") }), { start: 0, text: "1,000 ₴" });
});

test("markdown: a Ukrainian #tag is a tag, so no word suggestions inside it", () => {
  assert.equal(classifyMarkdownContext("Це #нотатка").zone, "tag");
  assert.equal(classifyMarkdownContext("Це #проєкт/ідея").zone, "tag");
  assert.equal(classifyMarkdownContext("Це звичайний текст").zone, "text");
  const text = "Тут #тег та слово";
  const ranges = protectedRanges(text);
  assert.ok(ranges.some(([a, b]) => text.slice(a, b).trim() === "#тег"), "the tag is a protected range");
});

test("link matching and related-note terms work on Cyrillic", () => {
  const lookup = (phrase: string) => (phrase === "київ" ? { target: "Київ", display: "Київ" } : phrase === "історія україни" ? { target: "Історія України", display: "Історія України" } : null);
  const spans = findLinkSpans("Я люблю Київ. Також читаю Історія України щовечора.", lookup);
  assert.deepEqual(spans.map((s) => s.text), ["Київ", "Історія України"]);
  // Stop words are Ukrainian too: a note literally titled "і" must not underline every conjunction.
  assert.deepEqual(findLinkSpans("мама і тато", (p) => (p === "і" ? { target: "і", display: "і" } : null)), []);
  assert.deepEqual(terms("Київ — це столиця України, і це місто"), ["київ", "столиця", "україни", "місто"]);
});

test("segmentation counts Ukrainian words (so notes are not 'empty' to the link suggester)", () => {
  const segs = segmentText("# Заголовок\n\nЦе перший абзац нашої нотатки про Київ і про його історію.\n");
  assert.ok(segs.length >= 1, "a Ukrainian paragraph is a segment");
});

test("split/respace never strands a one-letter or apostrophe-cut piece", () => {
  for (const bad of ["в", "з", "й", "'я", "я'", "по-", "-ка"]) assert.equal(isFragmentPiece(bad), true, bad);
  for (const good of ["до", "він", "м'яч"]) assert.equal(isFragmentPiece(good), false, good);
});

test("respacing: a lone Ukrainian preposition is never glued to the next word", () => {
  // "вікно" is far likelier than "в ікно" in this corpus - exactly the situation that makes a
  // naive "which arrangement reads best" merge wrong, because "в ікно" is perfectly good Ukrainian.
  const corpus = Array.from({ length: 40 }, () => "Вона відчинила вікно і подивилась на вулицю. Біля вікно було тихо.").join("\n");
  const model = buildModelFromText(corpus);
  assert.equal(decideRespace(model, "в", "ікно", ["вона", "дивиться"]), null);
  assert.equal(decideRespace(model, "з", "мінити", []), null);
});
