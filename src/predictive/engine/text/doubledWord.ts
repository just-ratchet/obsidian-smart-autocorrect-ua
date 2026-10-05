/**
 * Accidental doubled-word detection ("the the" -> "the", "і і" -> "і").
 *
 * Only a curated set of function words is ever removed, because many doublings are
 * grammatically valid and must be left alone: "had had" (past perfect), "that that"
 * ("I know that that is true"), "who who", "will will" (a name). The set below holds
 * articles, prepositions, conjunctions, the copula, and pronouns/demonstratives that
 * have no valid doubled use - so removal is safe and precise rather than a blunt
 * "collapse any repeat".
 */
export const NEVER_DOUBLED: ReadonlySet<string> = new Set([
  // articles
  "the", "a", "an",
  // conjunctions
  "and", "or", "nor", "but", "than", "then",
  // prepositions
  "of", "to", "in", "on", "at", "for", "with", "from", "into", "onto", "as", "by",
  // copula / auxiliaries with no valid doubling
  "is", "are", "was", "were", "be", "am",
  // pronouns / demonstratives
  "it", "its", "we", "they", "this", "these", "those", "i",

  // --- Ukrainian ---
  // Same rule: only words with no valid doubled use. Deliberately NOT here: "та" ("та та жінка"
  // = "that woman"), "що", "як", "не", "ні", "так", "ще", "дуже", "тому", "вона/воно" in
  // reduplication, and anything that can be repeated for emphasis or as a name.
  // prepositions
  "в", "у", "на", "з", "із", "зі", "до", "від", "по", "за", "про", "для", "при", "під", "над",
  "між", "через", "без", "біля", "після", "перед", "серед",
  // conjunctions / particles
  "і", "й", "або", "але", "чи", "щоб", "бо", "проте", "однак",
  // pronouns / demonstratives
  "я", "ми", "він", "вона", "вони", "це", "цей", "ця", "ці", "цього", "цьому", "його", "її", "їх",
]);

/**
 * True when `token` is an accidental duplicate of the word immediately before it and
 * safe to remove. Case-insensitive; both words must match and be in NEVER_DOUBLED.
 */
export function isDoubledWord(prevWord: string, token: string): boolean {
  if (!prevWord || !token) return false;
  const a = prevWord.toLowerCase();
  const b = token.toLowerCase();
  return a === b && NEVER_DOUBLED.has(b);
}
