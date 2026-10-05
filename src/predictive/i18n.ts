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

  // --- settings / UI (keys generated from the source strings) ---
  "ui.name.AddWord": "Add a word",
  "ui.btn.Add": "Add",
  "ui.ph.Word": "word",
  "ui.title.AddLinkRelatedNote": "Add link to a related note",
  "ui.title.SuggestAlternatives": "Suggest alternatives",
  "ui.name.EnableSmartAutocorrect": "Enable Smart Autocorrect",
  "ui.name.GettingStarted": "Getting started",
  "ui.name.ResetSettings": "Reset settings",
  "ui.name.FactoryReset": "Factory reset",
  "ui.name.WritingStats": "Writing stats",
  "ui.name.PredictiveTextSuggestNextWord": "Predictive text (suggest the next word)",
  "ui.name.AutocorrectTyposWhenYouPress": "Autocorrect typos when you press space",
  "ui.name.AutocorrectStrengthInformationGain": "Autocorrect strength (information gain)",
  "ui.name.RemoveAccidentalDoubledWords": "Remove accidental doubled words",
  "ui.name.AutoCapitaliseSentencesNames": "Auto-capitalise sentences & names",
  "ui.name.PreferWordsFromOwnNotes": "Prefer words from my own notes",
  "ui.name.VaultInfluence": "Vault influence",
  "ui.name.NeuralVsWordFrequencyBlend": "Neural vs. word-frequency blend",
  "ui.name.TrustTypingVsContext": "Trust typing vs. context (β)",
  "ui.name.WordsArenTSentenceEnds": "Words that aren't sentence ends",
  "ui.name.PersonalDictionary": "Personal dictionary",
  "ui.name.SuggestPersonalDictionaryWords": "Suggest personal dictionary words",
  "ui.name.UndoAddsWordDictionary": "Undo adds the word to your dictionary",
  "ui.name.LearnAbbreviationsWhenYouUndo": "Learn abbreviations when you undo a capital",
  "ui.name.ForgetDictionaryWordsRemovedFrom": "Forget dictionary words removed from the vault",
  "ui.name.FilterProfanityNsfwWords": "Filter profanity & NSFW words",
  "ui.name.KeyboardTypoStrength": "Keyboard-typo strength",
  "ui.name.SoundAlikeStrength": "Sound-alike strength",
  "ui.name.FavourWordsFromNote": "Favour words from this note",
  "ui.name.SuggestionsShown": "Suggestions shown",
  "ui.name.StartSuggestingAfter": "Start suggesting after",
  "ui.name.AcceptSuggestionWith": "Accept suggestion with",
  "ui.name.TabIndentsBulletsOnlyFrom": "Tab indents bullets only from the start",
  "ui.name.TidyDoubleSpaces": "Tidy double spaces",
  "ui.name.ThousandsSeparator": "Thousands separator",
  "ui.name.EuroSignPosition": "Euro sign position",
  "ui.name.LinkingAssistance": "Linking assistance",
  "ui.name.RelatedLinkSensitivity": "Related-link sensitivity",
  "ui.name.MinimumBlockLengthLink": "Minimum block length for a link",
  "ui.name.ExcludedFoldersFiles": "Excluded folders & files",
  "ui.name.WasmSimdAcceleration": "WASM SIMD acceleration",
  "ui.name.DownloadLanguageModel": "Download language model",
  "ui.name.SuggestionStyle": "Suggestion style",
  "ui.name.KeyboardLayout": "Keyboard layout",
  "ui.name.AdaptMe": "Adapt to me",
  "ui.name.ShareFileVaultPath": "Share file (vault path)",
  "ui.name.ExportImportPersonalization": "Export / import personalization",
  "ui.name.ResetPersonalization": "Reset personalization",
  "ui.desc.MasterSwitchOffNothingRuns": "Master switch. Off = nothing runs (no autocorrect, predictions, ghost text, or link/tag suggestions), but the plugin stays installed and your settings and learned personalization are kept.",
  "ui.desc.QuickTourAcceptingSuggestionHow": "A quick tour: accepting a suggestion, how typos get fixed, undoing a correction you didn't want, and where to find your stats.",
  "ui.desc.PutEveryOptionMenuBack": "Put every option in this menu back to its default. Your personal dictionary and everything the plugin has learned about how you write are kept. Asks you to confirm first.",
  "ui.desc.WipeEverythingPluginStoresSettings": "Wipe everything this plugin stores - settings, personalization, statistics and your personal dictionary. Can't be undone.",
  "ui.desc.StreakTimeSavedMilestonesWhat": "Your streak, time saved, milestones, and what the plugin has learned. Stored with your vault, so the numbers are the same on every device.",
  "ui.desc.SuggestsLikelyNextWordsFrom": "Suggests likely next words from what you've written so far. Turn off to hide all suggestions.",
  "ui.desc.FixesObviousMisspellingWhenYou": "Fixes an obvious misspelling when you finish a word with a space or punctuation, like a phone keyboard. Wrong correction? Just undo (Ctrl/Cmd-Z) — your word comes back and it won't be changed again.",
  "ui.desc.LeansSuggestionsTowardWordsPhrasing": "Leans suggestions toward the words and phrasing you already use.",
  "ui.desc.HowMuchOwnNotesOutweigh": "How much your own notes outweigh the general dictionary. Higher = more personalised, lower = more generic.",
  "ui.desc.HowMuchNeuralLstmNext": "How much the neural (LSTM) next-word model influences suggestions and corrections, vs the word-frequency model. 0 = word-frequency only; 1 = neural only. Only applies when a neural model is installed.",
  "ui.desc.WhenTypoAmbiguousHigherTrusts": "When a typo is ambiguous: higher trusts the exact letters you typed, lower trusts what the sentence expects.",
  "ui.desc.OfferDictionaryWordsAsCompletions": "Offer your dictionary words as completions too, not just protect them from autocorrect.",
  "ui.desc.GivesSmallBoostWordsYou": "Gives a small boost to words you've already used in the note you're writing, so suggestions stay on topic. 0 turns it off.",
  "ui.desc.HowManySuggestionsAppearPopup": "How many suggestions appear in the popup at once.",
  "ui.desc.WhichGroupingUseInsideCurrency": "Which grouping to use inside a currency amount.",
  "ui.desc.EuroOneSignWhoseSide": "The euro is the one sign whose side genuinely varies by locale. Everything else follows its own convention.",
  "ui.desc.WhichKeysCountAsNear": "Which keys count as near each other, so typo correction knows which slips are likely.",
  "ui.desc.ClearAllLearnedAdaptationKeyboard": "Clear all learned adaptation (keyboard model, ranking, protected words).",
  "ui.btn.ShowMe": "Show me",
  "ui.btn.ResetSettings": "Reset settings",
  "ui.btn.FactoryReset": "Factory reset",
  "ui.btn.SeeStats": "See your stats",
  "ui.btn.ResetStatistics": "Reset statistics",
  "ui.btn.ManageDictionary": "Manage dictionary",
  "ui.btn.Download": "Download",
  "ui.btn.Export": "Export",
  "ui.btn.ImportReplace": "Import (replace)",
  "ui.btn.ImportMerge": "Import (merge)",
  "ui.btn.Reset": "Reset",
  "ui.ph.TemplatesNjournal": "Templates\\nJournal/*",
  "ui.btn.Back": "Back",
  "ui.btn.Skip": "Skip",
  "ui.title.DismissSuggestion": "Dismiss this suggestion",
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

  // --- settings / UI ---
  "ui.name.AddWord": "Додати слово",
  "ui.btn.Add": "Додати",
  "ui.ph.Word": "слово",
  "ui.title.AddLinkRelatedNote": "Додати посилання на дотичну нотатку",
  "ui.title.SuggestAlternatives": "Запропонувати відповідники",
  "ui.name.EnableSmartAutocorrect": "Увімкнути Smart Autocorrect",
  "ui.name.GettingStarted": "Початок роботи",
  "ui.name.ResetSettings": "Скинути налаштування",
  "ui.name.FactoryReset": "Повне скидання",
  "ui.name.WritingStats": "Статистика письма",
  "ui.name.PredictiveTextSuggestNextWord": "Передбачення тексту (підказувати наступне слово)",
  "ui.name.AutocorrectTyposWhenYouPress": "Виправляти одруківки після пробілу",
  "ui.name.AutocorrectStrengthInformationGain": "Сила автовиправлення (приріст інформації)",
  "ui.name.RemoveAccidentalDoubledWords": "Вилучати випадково здвоєні слова",
  "ui.name.AutoCapitaliseSentencesNames": "Великі літери в реченнях і назвах",
  "ui.name.PreferWordsFromOwnNotes": "Надавати перевагу словам із моїх нотаток",
  "ui.name.VaultInfluence": "Вплив сховища",
  "ui.name.NeuralVsWordFrequencyBlend": "Баланс нейромережі та частот слів",
  "ui.name.TrustTypingVsContext": "Довіра до набраного проти контексту (β)",
  "ui.name.WordsArenTSentenceEnds": "Слова, що не завершують речення",
  "ui.name.PersonalDictionary": "Особистий словник",
  "ui.name.SuggestPersonalDictionaryWords": "Підказувати слова з особистого словника",
  "ui.name.UndoAddsWordDictionary": "Скасування додає слово до словника",
  "ui.name.LearnAbbreviationsWhenYouUndo": "Вивчати скорочення, коли ви скасовуєте велику літеру",
  "ui.name.ForgetDictionaryWordsRemovedFrom": "Забувати слова, вилучені зі сховища",
  "ui.name.FilterProfanityNsfwWords": "Фільтрувати нецензурні та NSFW слова",
  "ui.name.KeyboardTypoStrength": "Сила клавіатурних одруківок",
  "ui.name.SoundAlikeStrength": "Сила співзвучності",
  "ui.name.FavourWordsFromNote": "Віддавати перевагу словам із цієї нотатки",
  "ui.name.SuggestionsShown": "Кількість підказок",
  "ui.name.StartSuggestingAfter": "Починати підказувати після",
  "ui.name.AcceptSuggestionWith": "Приймати підказку клавішею",
  "ui.name.TabIndentsBulletsOnlyFrom": "Tab робить відступ лише на початку рядка",
  "ui.name.TidyDoubleSpaces": "Прибирати подвійні пробіли",
  "ui.name.ThousandsSeparator": "Розділювач тисяч",
  "ui.name.EuroSignPosition": "Розташування знака євро",
  "ui.name.LinkingAssistance": "Допомога з посиланнями",
  "ui.name.RelatedLinkSensitivity": "Чутливість дотичних посилань",
  "ui.name.MinimumBlockLengthLink": "Найменша довжина блоку для посилання",
  "ui.name.ExcludedFoldersFiles": "Виключені теки та файли",
  "ui.name.WasmSimdAcceleration": "Прискорення WASM SIMD",
  "ui.name.DownloadLanguageModel": "Завантажити мовну модель",
  "ui.name.SuggestionStyle": "Вигляд підказок",
  "ui.name.KeyboardLayout": "Розкладка клавіатури",
  "ui.name.AdaptMe": "Пристосовуватися до мене",
  "ui.name.ShareFileVaultPath": "Файл обміну (шлях у сховищі)",
  "ui.name.ExportImportPersonalization": "Експорт / імпорт персоналізації",
  "ui.name.ResetPersonalization": "Скинути персоналізацію",
  "ui.desc.MasterSwitchOffNothingRuns": "Головний вмикач. Вимкнено = не працює нічого (ні автовиправлення, ні передбачення, ні текст-привид, ні підказки посилань і теґів), але плагін лишається встановленим, а ваші налаштування та вивчена персоналізація зберігаються.",
  "ui.desc.QuickTourAcceptingSuggestionHow": "Короткий огляд: як прийняти підказку, як виправляються одруківки, як скасувати непотрібне виправлення і де знайти статистику.",
  "ui.desc.PutEveryOptionMenuBack": "Повернути всі налаштування цього меню до типових значень. Ваш особистий словник і все, що плагін вивчив про ваш стиль, зберігається. Спершу запитає підтвердження.",
  "ui.desc.WipeEverythingPluginStoresSettings": "Стерти все, що зберігає плагін — налаштування, персоналізацію, статистику й особистий словник. Скасувати не можна.",
  "ui.desc.StreakTimeSavedMilestonesWhat": "Ваша серія, збережений час, досягнення та те, що вивчив плагін. Зберігається разом зі сховищем, тож числа однакові на всіх пристроях.",
  "ui.desc.SuggestsLikelyNextWordsFrom": "Підказує ймовірні наступні слова на основі написаного. Вимкніть, щоб сховати всі підказки.",
  "ui.desc.FixesObviousMisspellingWhenYou": "Виправляє очевидну помилку, коли ви завершуєте слово пробілом або знаком пунктуації, як на клавіатурі телефона. Виправило неправильно? Просто скасуйте (Ctrl/Cmd-Z) — ваше слово повернеться й більше не змінюватиметься.",
  "ui.desc.LeansSuggestionsTowardWordsPhrasing": "Схиляє підказки до слів і зворотів, якими ви вже користуєтеся.",
  "ui.desc.HowMuchOwnNotesOutweigh": "Наскільки ваші нотатки переважують загальний словник. Більше = персональніше, менше = загальніше.",
  "ui.desc.HowMuchNeuralLstmNext": "Наскільки нейромережева (LSTM) модель наступного слова впливає на підказки та виправлення порівняно з частотною моделлю. 0 = лише частоти; 1 = лише нейромережа. Діє тільно за встановленої нейромоделі.",
  "ui.desc.WhenTypoAmbiguousHigherTrusts": "Коли одруківка неоднозначна: більше — довіряти саме набраним літерам, менше — тому, що передбачає речення.",
  "ui.desc.OfferDictionaryWordsAsCompletions": "Пропонувати слова зі словника також як завершення, а не лише захищати їх від автовиправлення.",
  "ui.desc.GivesSmallBoostWordsYou": "Трохи підвищує слова, які ви вже вживали в нотатці, щоб підказки лишалися в темі. 0 вимикає.",
  "ui.desc.HowManySuggestionsAppearPopup": "Скільки підказок показувати у вікні водночас.",
  "ui.desc.WhichGroupingUseInsideCurrency": "Яке групування використовувати в грошових сумах.",
  "ui.desc.EuroOneSignWhoseSide": "Євро — єдиний знак, чия сторона справді залежить від локалі. Решта має власну усталену форму.",
  "ui.desc.WhichKeysCountAsNear": "Які клавіші вважати сусідніми, щоб виправлення знало, які описки ймовірні.",
  "ui.desc.ClearAllLearnedAdaptationKeyboard": "Стерти все вивчене пристосування (модель клавіатури, ранжування, захищені слова).",
  "ui.btn.ShowMe": "Показати",
  "ui.btn.ResetSettings": "Скинути налаштування",
  "ui.btn.FactoryReset": "Повне скидання",
  "ui.btn.SeeStats": "Переглянути статистику",
  "ui.btn.ResetStatistics": "Скинути статистику",
  "ui.btn.ManageDictionary": "Керувати словником",
  "ui.btn.Download": "Завантажити",
  "ui.btn.Export": "Експортувати",
  "ui.btn.ImportReplace": "Імпорт (замінити)",
  "ui.btn.ImportMerge": "Імпорт (об’єднати)",
  "ui.btn.Reset": "Скинути",
  "ui.ph.TemplatesNjournal": "Templates\\nJournal/*",
  "ui.btn.Back": "Назад",
  "ui.btn.Skip": "Пропустити",
  "ui.title.DismissSuggestion": "Відхилити цю підказку",
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
