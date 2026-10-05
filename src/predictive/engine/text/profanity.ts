/**
 * Profanity / NSFW blocklist - words the assistant never proactively SUGGESTS or
 * offers as an autocorrection, and never corrects a benign word INTO.
 *
 * GENERATED at build time by classifying the model vocab with an LLM (see
 * build_model/profanity_blocklist.json). Curated to avoid false positives (the
 * Scunthorpe problem): clinical anatomy, drug names, religious names, ordinary
 * negative words, and benign homographs are deliberately absent. One flat set -
 * profanity, slurs, and explicit sexual terms are treated identically.
 *
 * The user can re-enable any word by adding it to their personal dictionary, or
 * disable the whole filter. IMPORTANT: this filters OUR output only - a word the
 * user types themselves is never removed or corrected away (see EngineCore).
 */
export const PROFANITY: ReadonlySet<string> = new Set([
  "aryans", "asshole", "bastard", "bawdy", "bestiality", "bint", "bitches", "blackamoor",
  "bondage", "boobs", "brainfuck", "brothel", "bugger", "bullshit", "chav", "clitoral",
  "cock", "coon", "coons", "cum", "cunnilingus", "cunt", "dike", "dominatrix",
  "dyke", "ejaculation", "erotic", "fag", "faggot", "fap", "fica", "flasher",
  "fondling", "fuck", "fucked", "fucking", "gonad", "gypsies", "gypsy", "hajji",
  "honky", "hooker", "horny", "incest", "jap", "kafir", "kike", "klan",
  "kraut", "lewdness", "lust", "masturbating", "masturbation", "mestizo", "milf", "nazi",
  "negro", "negroes", "negros", "nig", "nigga", "nigger", "niggers", "niggr",
  "nigra", "nigro", "nob", "nonce", "nude", "nudes", "orgasm", "orgasms",
  "orgy", "paki", "pedophile", "pedophilia", "perversion", "pimp", "pimps", "piss",
  "pissed", "pogrom", "polak", "poof", "poon", "porn", "porno", "pornographic",
  "pornography", "prick", "prostitute", "prostitution", "pussy", "putz", "queer", "queers",
  "rape", "raped", "rapes", "raping", "rapist", "retard", "retarded", "retards",
  "screwing", "sexting", "sexy", "shit", "shite", "shitty", "shota", "skinhead",
  "slag", "slut", "smut", "smuts", "sodomy", "softcore", "squaw", "threesome",
  "tit", "tits", "waffen", "whore", "whores", "wop", "wtf",
]);

/**
 * Ukrainian obscenities. Ukrainian is heavily inflected (every root has dozens of surface
 * forms), so instead of a flat word list this matches the unambiguous obscene ROOTS as word
 * prefixes. Only roots with no innocent homograph are listed - the same Scunthorpe rule as the
 * English list: euphemisms ("бляха", "курник"), anatomy ("пеніс") and ordinary insults
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
  if (PROFANITY.has(w) || PROFANE_WORDS_UK.has(w)) return true;
  // Prefix test only for Cyrillic words (the English list is exact-match by design).
  if (/^[а-щьюяіїєґ']/.test(w)) {
    for (const r of PROFANE_ROOTS_UK) if (w.startsWith(r)) return true;
  }
  return false;
}
