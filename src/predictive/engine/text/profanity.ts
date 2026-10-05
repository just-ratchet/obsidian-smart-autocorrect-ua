/**
 * Profanity / NSFW blocklist - words the assistant never proactively SUGGESTS or offers as an
 * autocorrection, and never corrects a benign word INTO. Ukrainian only: the upstream English
 * word list was removed with the rest of the English rules.
 *
 * The user can re-enable any word by adding it to their personal dictionary, or disable the
 * whole filter. IMPORTANT: this filters OUR output only - a word the user types themselves is
 * never removed or corrected away (see EngineCore).
 */

/**
 * Ukrainian obscenities. Ukrainian is heavily inflected (every root has dozens of surface
 * forms), so instead of a flat word list this matches the unambiguous obscene ROOTS as word
 * prefixes. Only roots with no innocent homograph are listed - the Scunthorpe rule:
 * euphemisms ("бляха", "курник"), anatomy ("пеніс") and ordinary insults
 * ("дурень") are deliberately absent. It is a safety net for OUR suggestions, not a censor of
 * what the user types.
 */
const PROFANE_ROOTS_UK = [
  "хуй", "хуя", "хуї", "хує", "пизд", "пізд", "єбан", "єбат", "єбіш", "єблан", "їбан", "їбат",
  "їбал", "заєб", "поєб", "виєб", "доєб", "наєб", "уєб", "розєб", "бляд", "блят",
  "педик", "гомік", "мудак", "мудил", "гондон", "залуп", "дрочи", "срак", "срат", "насра", "обсра",
  "шльонд", "шлюх", "пердол", "ссик", "виблядок", "проститутк", "підарас", "підарюг", "підорас",
];

/** Ukrainian words matched exactly: too short, or too inflection-poor, to be safe as a prefix
 *  ("курв" would also catch "курвіметр", "сучк" the wood knots "сучки"). */
const PROFANE_WORDS_UK: ReadonlySet<string> = new Set([
  "сука", "суки", "суку", "сукою", "сучка", "курва", "курви", "курву", "курвою", "курвам",
  "жопа", "жопу", "жопи", "жопою", "нахер", "нахуй", "похуй", "падла", "падло", "мразь", "мрази",
  "ублюдок", "ублюдки", "мудо", "мудак", "бля", "блять",
  // "підор"/"підар" as prefixes would also catch the dialect "підорожник" (plantain)
  "підор", "підори", "підора", "підору", "підар", "підари", "підара", "підару",
]);

/** True if the word is blocklisted and not re-enabled by the user allowlist. */
export function isProfane(word: string, allow?: ReadonlySet<string>): boolean {
  const w = word.toLowerCase();
  if (allow && allow.has(w)) return false;
  if (PROFANE_WORDS_UK.has(w)) return true;
  // Prefix test only for Cyrillic words (exact words above, inflected roots here).
  if (/^[а-щьюяіїєґ']/.test(w)) {
    for (const r of PROFANE_ROOTS_UK) if (w.startsWith(r)) return true;
  }
  return false;
}
