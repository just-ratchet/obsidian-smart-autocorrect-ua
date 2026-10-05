/**
 * One definition of "what counts as a letter" for the whole engine.
 *
 * The upstream plugin was English-only and scattered `[A-Za-z]` through a dozen files, which
 * silently treats every Ukrainian word as punctuation (so no suggestion, no link match, no
 * sentence case). Keep these in one place and build regexes from them.
 *
 * Latin stays in the set on purpose: Ukrainian notes routinely contain English terms, code
 * identifiers and brand names, and those must still tokenise as words.
 */

/** Character-class BODY (no brackets): Latin + the whole Ukrainian alphabet. */
export const LETTERS = "A-Za-zА-ЩЬЮЯа-щьюяІіЇїЄєҐґ";
/** Same, with digits. */
export const ALNUM = "0-9" + LETTERS;
/** Apostrophe variants seen in Ukrainian text: ASCII, typographic (U+2019) and modifier letter
 *  (U+02BC, the one Unicode actually recommends for м'яч). The backtick is NOT one: in Markdown it
 *  opens a code span, so it must end a word. */
export const APOSTROPHES = "'’ʼ";

/** Is this single character a letter (Latin or Ukrainian Cyrillic)? */
export const isLetter = (c: string): boolean => new RegExp(`^[${LETTERS}]$`).test(c);

/** Fold every apostrophe variant to the ASCII one the language models were built with. */
export function normalizeApostrophes(s: string): string {
  return s.replace(/[’ʼ‘]/g, "'");
}

/** Upper-case Ukrainian/Latin letter test for a single character. */
export const isUpperLetter = (c: string): boolean => c !== c.toLowerCase() && c === c.toUpperCase();

/** The word being typed at the END of a string (the caret sits right after it). Letters,
 *  apostrophes (м'яч) and hyphens (по-українськи) may follow the first letter. */
export const WORD_AT_END = new RegExp(`([${LETTERS}][${LETTERS}${APOSTROPHES}-]*)$`);
/** A word/digit character then whitespace at the end: the caret is just past a finished word.
 *  (`\w` would be wrong here: it is ASCII-only, so "привіт " would not match.) */
export const AFTER_WORD_CHAR = new RegExp(`[${ALNUM}_]\\s$`);
/** Like AFTER_WORD_CHAR, but a currency sign / percent / closing bracket also counts. */
export const AFTER_FINISHED_TOKEN = new RegExp(`[${ALNUM}_$€£¥₹₽₩₪฿₺₴₦₱₫₿%)]\\s$`);

/** One-letter words a SPLIT may produce. English "a"/"i" only: a Ukrainian one-letter word (в, у, з,
 *  і, й, я, о) is real, but allowing it as a split piece turns typos into nonsense - "завта" →
 *  "з авта", "старй" → "стар й", "книгв" → "книг в" - because the model scores a lone preposition
 *  as very likely anywhere. Such words stay valid as TYPED words; they just never come out of a
 *  split/re-spacing decision. */
const SINGLE_LETTER_WORDS = new Set(["a", "i"]);

/**
 * Is `piece` a fragment rather than a plausible word - a stray letter, or a piece cut at an
 * apostrophe/hyphen ("сим 'я", "по- "), which is never a reading of the text however happily the
 * language model scores it as a token?
 */
export function isFragmentPiece(piece: string): boolean {
  if (!piece) return true;
  if (/^['’ʼ-]|['’ʼ-]$/.test(piece)) return true;
  return piece.length === 1 && !SINGLE_LETTER_WORDS.has(piece.toLowerCase());
}

/** Latin letters that look identical to a Cyrillic one (lower case; callers lower-case first). */
const HOMOGLYPHS: Record<string, string> = {
  a: "а", c: "с", e: "е", i: "і", o: "о", p: "р", x: "х", y: "у", k: "к", m: "м", t: "т",
};

/**
 * Repair a token that mixes scripts by typing Latin look-alikes inside a Ukrainian word
 * ("сьогоднi" with a Latin i, "Укpаїна" with a Latin p) - the commonest Ukrainian typing slip, and
 * invisible to the eye. Returns the all-Cyrillic spelling, or null when the token is not such a
 * case: pure Cyrillic, pure Latin (an English word - "to" must NOT become "то"), or a mix with a
 * Latin letter that has no look-alike. Case is the caller's business (pass lower case).
 */
export function repairHomoglyphs(word: string): string | null {
  if (!/[а-щьюяіїєґ]/.test(word) || !/[a-z]/.test(word)) return null;
  let out = "";
  for (const ch of word) {
    if (/[a-z]/.test(ch)) {
      const h = HOMOGLYPHS[ch];
      if (!h) return null;
      out += h;
    } else out += ch;
  }
  return out;
}

/**
 * Ukrainian writes an apostrophe before я, ю, є, ї after б п в м ф р ("м'яч", "п'ять", "сім'я") and
 * after a prefix ending in a consonant ("під'їзд", "об'єкт", "з'єднання"). It is also the single most
 * commonly dropped character, because it lives on a different key. This lists the spellings with ONE
 * apostrophe inserted at each such spot; the caller keeps the one the language model knows.
 * (Word-initial letters are never preceded by an apostrophe, so position 0 and 1 are skipped.)
 */
export function apostropheVariants(word: string): string[] {
  const out: string[] = [];
  if (/['’ʼ]/.test(word)) return out;
  // prefix-final consonants that take an apostrophe before я ю є ї: б п в м ф р, and з/д/н/к in
  // prefixes (з'єднання, під'їзд, від'їзд, об'єкт, роз'яснення, к'язь is not a word) - the caller's
  // vocabulary check is what keeps the spurious ones out.
  for (let i = 1; i < word.length; i++) {
    if (!/[яюєї]/.test(word[i])) continue;
    if (!/[бпвмфрзднкс]/.test(word[i - 1])) continue;
    out.push(word.slice(0, i) + "'" + word.slice(i));
  }
  return out;
}
