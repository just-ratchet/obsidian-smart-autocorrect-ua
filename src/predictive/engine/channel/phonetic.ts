/**
 * Phonetic channel path (#3). A compact key collapses words to how they sound, so
 * cognitive/spelling errors that geometry can't explain become cheap. Ukrainian words
 * ("прівіт"->"привіт", "Украіна"->"Україна", "шо"/"що") use a Ukrainian key; Latin words keep
 * the original Metaphone-style one ("fone"->"phone", "definately"->"definitely"). The predictor takes min(channelCost, phoneticCost).
 */
import { structuralEdit } from "./editDistance.ts";

const VOWELS = new Set(["A", "E", "I", "O", "U"]);

const CYRILLIC = /[А-Яа-яІіЇїЄєҐґ]/;

/** Word-final voiced → voiceless: the spelling slips people actually make ("дуп" for "дуб"). */
const DEVOICE: Record<string, string> = { б: "п", д: "т", г: "х", ґ: "к", ж: "ш", з: "с" };

/**
 * Phonetic key for Ukrainian. Collapses what is written inconsistently but sounds (nearly) the
 * same: unstressed е/и and the и/і/ї mix-ups ("прівіт", "Украіна"), the apostrophe and soft sign
 * (silent as letters), "ться/тся" → "ця", щ ≈ шч, ґ ≈ г, final devoicing, doubled consonants.
 * Vowels are kept (unlike the English key) because Ukrainian vowel letters change the word.
 */
function ukrainianPhoneticKey(word: string): string {
  let w = word
    .toLowerCase()
    .replace(/['’ʼ`´ь-]/g, "") // apostrophe, soft sign and hyphen carry no sound of their own
    .replace(/[^а-щюяіїєґ]/g, "");
  if (!w) return "";
  w = w
    .replace(/щ/g, "шч")
    .replace(/ся$/, "с") // the reflexive ending is written -ся or -сь: "вчитися" ≈ "вчитись"
    .replace(/тс/g, "ц")
    .replace(/ґ/g, "г")
    .replace(/[еиії]/g, "и");
  w = w.replace(/(.)\1+/g, "$1"); // doubled letters: "життя" ≈ "житя"
  const last = w[w.length - 1];
  if (DEVOICE[last]) w = w.slice(0, -1) + DEVOICE[last];
  return w;
}

const KEY_CACHE = new Map<string, string>();
const KEY_CACHE_MAX = 20000;

/** Reduced phonetic key. Not full Double Metaphone, but effective and cheap. Memoised: the
 *  predictor asks for the SAME typed word's key once per candidate. */
export function phoneticKey(word: string): string {
  let k = KEY_CACHE.get(word);
  if (k === undefined) {
    k = computePhoneticKey(word);
    if (KEY_CACHE.size >= KEY_CACHE_MAX) KEY_CACHE.clear();
    KEY_CACHE.set(word, k);
  }
  return k;
}

function computePhoneticKey(word: string): string {
  if (CYRILLIC.test(word)) return ukrainianPhoneticKey(word);
  let w = word.toUpperCase().replace(/[^A-Z]/g, "");
  if (!w) return "";

  // Leading silent clusters: drop the first (silent) letter.
  w = w.replace(/^(KN|GN|PN|WR|AE|PS)/, (m) => m.slice(1));
  if (w.startsWith("WH")) w = "W" + w.slice(2);
  if (w.startsWith("X")) w = "S" + w.slice(1);

  // Digraph rewrites (order matters).
  w = w
    .replace(/PH/g, "F")
    .replace(/GH/g, "")
    .replace(/CK/g, "K")
    .replace(/SCH/g, "SK")
    .replace(/SH/g, "X")
    .replace(/TH/g, "T")
    .replace(/CH/g, "X")
    .replace(/MB$/g, "M");

  const first = w[0];
  let out = first; // keep the first character verbatim (even if a vowel)
  for (let i = 1; i < w.length; i++) {
    const c = w[i];
    const next = w[i + 1] ?? "";
    if (VOWELS.has(c)) continue; // vowels dropped after the first char
    let mapped = c;
    switch (c) {
      case "C":
        mapped = "EIY".includes(next) ? "S" : "K";
        break;
      case "Q":
        mapped = "K";
        break;
      case "V":
        mapped = "F";
        break;
      case "Z":
        mapped = "S";
        break;
      case "G":
        mapped = "EIY".includes(next) ? "J" : "K";
        break;
      case "D":
        mapped = "T";
        break;
      case "X":
        mapped = "KS";
        break;
      case "W":
      case "Y":
      case "H":
        mapped = VOWELS.has(next) ? c : ""; // only kept before a vowel
        break;
      default:
        mapped = c;
    }
    out += mapped;
  }
  // collapse consecutive duplicates.
  return out.replace(/(.)\1+/g, "$1");
}

/**
 * Phonetic cost (nats) of `typed` vs `intended` = an estimate of −log P(typed |
 * intended) along the "sounds alike" channel. Defined only when the two words
 * genuinely sound the same - identical phonetic key - otherwise Infinity, so the
 * keyboard-geometry channel handles it instead. (A dropped/added consonant sound
 * changes the key, e.g. "worf"→WRF vs "were"→WR, so those are NOT sound-alikes:
 * that's the difference between a real homophone and a keyboard slip.)
 *
 * When the words do sound alike, the cost is PROPORTIONAL to how much the
 * spelling was actually distorted (structural edit distance), at a per-edit rate
 * cheaper than keyboard geometry - sounding alike discounts each edit, it doesn't
 * make the whole word free. So "definately"→"definitely" (1 edit) is cheap, while
 * a same-sounding but badly-mangled "peoppe"→"pop" (3 edits) is dearer than the
 * closer "people" and loses the posterior on its own - no edit-count cutoff.
 */
export function phoneticCost(typed: string, intended: string, perEdit = 0.9): number {
  const a = phoneticKey(typed);
  const b = phoneticKey(intended);
  if (!a || !b || a !== b) return Infinity; // must sound the same
  return perEdit * structuralEdit(typed, intended);
}
