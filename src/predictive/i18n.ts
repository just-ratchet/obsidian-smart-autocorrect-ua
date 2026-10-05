/**
 * Minimal i18n for the plugin UI.
 *
 * Obsidian has no plugin translation API: the app's own language lives in
 * localStorage under "language" (the same key the Obsidian UI reads), so that is what
 * we follow. A user running Obsidian in Ukrainian gets Ukrainian strings; everyone
 * else keeps the original English, which is also the fallback for any key a locale
 * has not translated yet.
 *
 * USAGE
 *   import { t } from "./i18n";
 *   new Setting(el).setName(t("settings.predictions.name"))
 *
 * Keys are dotted and grouped by where they appear. Adding a string means adding it
 * to `en` (the source of truth for what exists) and then to each locale; a missing
 * translation falls back rather than throwing, so a half-translated locale still
 * ships a working UI.
 */

const en = {
  // --- consent / first-run asset download ---
  "assets.title": "Download the language model",
  "assets.body":
    "To give you the best predictions, Smart Autocorrect uses a language model ({size} MB). " +
    "It's too big to ship inside the plugin, so it's fetched once from GitHub and then runs " +
    "entirely on your device.",
  "assets.skip":
    "You can skip this and start right away - the plugin still works and learns from your " +
    "own notes, and you can download the model anytime from settings.",
  "assets.notNow": "Not now",
  "assets.download": "Download {size} MB",
  "assets.starting": "Smart Autocorrect: starting download…",
  "assets.downloading": "Downloading {label}…",
  "assets.installed": "Smart Autocorrect: language model installed.",
  "assets.alreadyInstalled": "Smart Autocorrect: language model is already installed.",
  "assets.partial":
    "Smart Autocorrect: downloaded {got} of {total} files. Retry from the plugin settings.",
  "assets.failed": "Could not download {file}: {message}",

  // --- model purposes, shown in the consent dialog ---
  "assets.purpose.lstm": "next-word prediction, phrase completion and capitalisation",
  "assets.purpose.ngram": "word-frequency model used for autocorrect scoring",
  "assets.purpose.wordlist": "known-word list that stops real words being 'corrected'",

  // --- dictionary manager ---
  "dict.title": "Personal dictionary",
  "dict.empty": "No words yet. Words you add from the editor appear here.",
  "dict.remove": "Remove",
  "dict.add": "Add",
  "dict.addPlaceholder": "Add a word…",
  "dict.heading": "{title} ({count})",

  // --- editor commands / menu items ---
  "cmd.addToDictionary": "Add to dictionary",
  "cmd.revert": "Undo correction",
  "cmd.acceptSuggestion": "Accept suggestion",
  "cmd.formatCurrency": "Format currency",
} as const;

export type MessageKey = keyof typeof en;

const uk: Partial<Record<MessageKey, string>> = {
  "assets.title": "Завантажити мовну модель",
  "assets.body":
    "Щоб давати найкращі підказки, Smart Autocorrect використовує мовну модель ({size} МБ). " +
    "Вона завелика, щоб постачатися разом із плагіном, тому завантажується один раз із GitHub " +
    "і далі працює цілком на вашому пристрої.",
  "assets.skip":
    "Можете пропустити це й почати одразу — плагін працює й навчається на ваших власних " +
    "нотатках, а модель можна завантажити будь-коли з налаштувань.",
  "assets.notNow": "Не зараз",
  "assets.download": "Завантажити {size} МБ",
  "assets.starting": "Smart Autocorrect: починаю завантаження…",
  "assets.downloading": "Завантажую {label}…",
  "assets.installed": "Smart Autocorrect: мовну модель встановлено.",
  "assets.alreadyInstalled": "Smart Autocorrect: мовна модель уже встановлена.",
  "assets.partial":
    "Smart Autocorrect: завантажено {got} з {total} файлів. Повторіть спробу в налаштуваннях плагіна.",
  "assets.failed": "Не вдалося завантажити {file}: {message}",

  "assets.purpose.lstm": "передбачення наступного слова, завершення фраз і великі літери",
  "assets.purpose.ngram": "частотна модель слів для оцінювання автовиправлень",
  "assets.purpose.wordlist": "список відомих слів, щоб справжні слова не «виправлялися»",

  "dict.title": "Особистий словник",
  "dict.empty": "Поки що слів немає. Слова, додані з редактора, з’являтимуться тут.",
  "dict.remove": "Вилучити",
  "dict.add": "Додати",
  "dict.addPlaceholder": "Додати слово…",
  "dict.heading": "{title} ({count})",

  "cmd.addToDictionary": "Додати до словника",
  "cmd.revert": "Скасувати виправлення",
  "cmd.acceptSuggestion": "Прийняти підказку",
  "cmd.formatCurrency": "Форматувати валюту",
};

const LOCALES: Record<string, Partial<Record<MessageKey, string>>> = { uk };

/** Obsidian's own UI language. Read lazily so a language change is picked up on reload. */
function currentLocale(): Partial<Record<MessageKey, string>> | null {
  try {
    const lang = window.localStorage.getItem("language");
    return lang ? LOCALES[lang] ?? null : null;
  } catch {
    return null; // localStorage can be unavailable; English is a fine answer
  }
}

/**
 * Translate `key`, falling back to English. `vars` fills `{placeholders}` - done here
 * rather than by the caller so a locale may reorder them to suit its grammar.
 */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const loc = currentLocale();
  let s: string = loc?.[key] ?? en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  }
  return s;
}
