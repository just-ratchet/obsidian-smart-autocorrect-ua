/**
 * Non-breaking prefixes / abbreviations: a period after one of these tokens is
 * (usually) NOT a sentence boundary. Used by sentence splitting and by
 * auto-capitalisation so we don't capitalise after "vs.", "U.S.", "e.g." etc.
 *
 * Stored lower-cased and without the trailing period.
 */
export const DEFAULT_ABBREVIATIONS: string[] = [
  // Latin / editorial
  "e.g", "i.e", "etc", "vs", "cf", "al", "ca", "viz", "nb", "vol", "ed", "eds",
  "pp", "p", "fig", "figs", "no", "nos", "op", "cit", "ibid",
  // Titles
  "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "rev", "hon", "gen", "col",
  "capt", "lt", "sgt", "gov", "sen", "rep", "pres",
  // Time / calendar
  "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov",
  "dec", "mon", "tue", "wed", "thu", "fri", "sat", "sun",
  // Measures / business
  "inc", "ltd", "co", "corp", "dept", "est", "approx", "min", "max", "avg",
  "misc", "dept", "univ", "assn", "bros",
  // Common acronym-with-dots handled separately (U.S., U.K., U.N., a.m., p.m.)
  "u.s", "u.k", "u.n", "a.m", "p.m", "e.u", "d.c",
  // Multi-part abbreviations that are NOT sentence ends - so the word AFTER them is
  // not wrongly capitalised ("w.r.t. the plan" keeps "the" lowercase).
  "w.r.t", "wrt", "a.k.a", "aka", "resp", "et.al", "e.t.c", "esp", "incl", "excl",
  "u.s.a", "a.d", "b.c", "b.c.e", "c.e", "ph.d", "b.a", "m.a", "b.sc", "m.sc",

  // --- Ukrainian ---------------------------------------------------------------------------
  // The list only ever SUPPRESSES a sentence boundary, so a word that is also a real word at the
  // end of a sentence ("рис", "лист", "дав", "серп", "трав") is deliberately left out: wrongly
  // keeping the next word lowercase is worse than missing an abbreviation. Single letters are
  // out too (they are initials, handled in tokenize.ts: "Т. Г. Шевченко").
  // Dotted multi-part forms: "т.д" is ONE token, the period after it is not a sentence end.
  "т.д", "т.п", "т.ч", "т.зв", "т.к", "т.н", "н.е", "до н.е", "р.х", "д.т.н", "к.т.н",
  "к.е.н", "д.е.н", "к.ф.н", "д.ф.н", "к.ю.н", "д.ю.н", "к.п.н", "д.п.н", "к.м.н", "д.м.н",
  // Cross-references, editorial
  "див", "пор", "напр", "зокр", "ін", "інш", "прим", "авт", "ред", "пер", "упоряд", "кн", "тт",
  "вип", "розд", "пп", "стор", "табл", "дод", "арк", "заг", "відп", "тел",
  // Dates, numbers, money ("у 2020 р. було", "XIX ст. був")
  "р", "рр", "вв", "ст", "тис", "млн", "млрд", "трлн", "грн", "коп", "прибл",
  // Titles and academic ranks
  "проф", "акад", "доц", "асист", "д-р", "інж", "арх", "полк", "підполк", "лейт", "св", "ім",
  "засл", "зав", "заст",
  // Places and addresses
  "вул", "просп", "пров", "бул", "пл", "наб", "км", "смт", "сел", "обл", "р-н", "буд", "кв", "оф",
  // Weekdays
  "пн", "вт", "ср", "чт", "пт", "сб", "нд", "пон", "вівт", "четв",
];

export function buildAbbreviationSet(extra: string[] = []): Set<string> {
  const s = new Set<string>();
  for (const a of DEFAULT_ABBREVIATIONS) s.add(a.toLowerCase());
  for (const a of extra) s.add(a.toLowerCase().replace(/\.$/, ""));
  return s;
}
