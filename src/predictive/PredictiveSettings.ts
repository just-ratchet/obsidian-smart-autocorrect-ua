/**
 * Settings for the predictive/autocorrect layer, plus a renderer that adds a
 * section to the plugin's settings tab. Every feature is an independent toggle,
 * matching the design.
 */
import { PaneBuilder, renderPaneGroups } from "./settingsPane";
import { t, type MessageKey } from "./i18n";
import type { PaneGroup } from "./settingsPane";
import { parseExcludeList } from "./engine/index";
import type { KeyboardLayoutName } from "./engine/index";


/**
 * Keys offered for accepting a suggestion.
 *
 * Tab is the default and Enter is deliberately NOT also bound: Obsidian's own
 * EditorSuggest binds Enter for free, so both used to accept, and an Enter that
 * sometimes writes a newline and sometimes accepts a suggestion is a coin flip the
 * user cannot see. Exactly one key accepts, and it is the one named here - whichever
 * is chosen, the others do their normal editor job (see PredictiveSuggest.bindKeys).
 */
export const ACCEPT_KEYS = ["Tab", "Enter", "ArrowRight", "End"] as const;
export type AcceptKey = (typeof ACCEPT_KEYS)[number];

export interface PredictiveSettings {
  /** Master switch for the WHOLE plugin: when off, nothing runs - no autocorrect, no
   *  predictions/ghost, no link or tag suggestions. Leaves the plugin installed and its
   *  settings/personalization intact, so you can turn everything back on in one click. */
  pluginEnabled: boolean;

  /** master switch for context-aware predictions in the popup. */
  enablePredictions: boolean;

  /** learn from and bias toward the user's own vault. */
  personalBias: boolean;
  /** strength of the vault bias, 0..1 (mixture weight alpha). */
  alpha: number;
  /** blend of the neural (LSTM) next-word prior vs the word-frequency model,
   *  0..1: 0 = n-gram only, 1 = LSTM only. Only applies when an LSTM is loaded. */
  lstmWeight: number;

  /** Whether the one-time "download the language model" prompt has been shown. The
   *  prompt is offered once; declining is durable, and the settings pane has a button
   *  for changing your mind. */
  modelPromptShown: boolean;

  /** Whether the getting-started tour has been shown. Shown once, after the first-run
   *  download; the settings pane can reopen it at any time. */
  tutorialShown: boolean;

  /** channel "trust" weight: high => trust typed chars, low => trust context. */
  beta: number;
  /** spread (in keys) of the geometric keyboard-substitution prior. */
  channelSigma: number;
  /** physical keyboard layout for the geometric typo prior. */
  keyboardLayout: KeyboardLayoutName;
  /** max channel cost (nats) for a fuzzy neighbour to be considered. */
  maxEditCost: number;

  /** mobile-style replace-on-space. */
  autocorrectOnSpace: boolean;
  /**
   * Information-gain (nats) a correction must clear: the typed word's Shannon
   * surprisal must exceed the chosen word's by at least this much. The single
   * autocorrect-strength control. Low = correct eagerly; high = only when the
   * typed word is very unlikely vs. the chosen one.
   */
  infoGainThreshold: number;
  /** capitalise real sentence starts. */
  autoCapitalize: boolean;
  /** remove an accidental doubled function word on space ("the the" -> "the"). Only a
   *  curated set of never-validly-doubled words, so "had had"/"that that" are safe. */
  removeDoubledWords: boolean;
  /** extra abbreviations that must not trigger capitalisation. */
  extraAbbreviations: string[];

  /**
   * User dictionary: words that are correct as written and must never be
   * autocorrected or re-cased.
   *
   * CASE-SENSITIVE by design, and that is the point: it is the escape hatch for
   * spellings the model cannot represent. The model factors casing into
   * lower/Title/UPPER + a learned table of irregular forms, so anything it has not
   * seen ("kubeCTL", "myVar", "NixOS") can be pinned here exactly as written.
   * "GmbH" and "gmbh" are therefore different entries.
   */
  userDictionary: string[];
  /** Words the user added EXPLICITLY (right-click or the dictionary editor), as opposed to ones
   *  auto-learned from undoing corrections. A marker subset of userDictionary, for the editor's
   *  "added by you" vs "learned automatically" split. */
  userDictionaryUserAdded: string[];
  /** also offer dictionary words as completions, not just protect them. */
  suggestUserDictionary: boolean;
  /** when you undo a correction, add that word to the personal dictionary so it is never
   *  corrected again (the dictionary IS the "don't-touch" list). */
  undoAddsToDictionary: boolean;
  /** when you undo a sentence-initial capitalisation that followed "word.", learn "word" as an
   *  abbreviation so we stop capitalising after it (e.g. "etc.", "incl."). */
  learnAbbreviationsOnRevert: boolean;
  /** drop a personal-dictionary word once it no longer appears anywhere in the vault, so deleting
   *  the notes that used it also forgets it (the dictionary tracks words you actually write). */
  pruneDictionaryFromVault: boolean;

  /**
   * Filter profanity, slurs, and explicit/NSFW words out of what the plugin OFFERS -
   * they are never suggested and never used as an autocorrect target. On by default.
   * This never touches what the user types: a blocked word typed deliberately is left
   * exactly as written and is never "corrected" away.
   */
  filterProfanity: boolean;


  // --- matching-quality features (#1-#7) ---
  /** keyboard-geometry matching strength (higher = more keyboard-typo tolerant; 0 = off). */
  fuzzyStrength: number;
  /** phonetic (sound-alike) matching strength (higher = more sound-alike tolerant; 0 = off). */
  phoneticStrength: number;
  /** adaptive keyboard confusion model that learns the user's slips. */
  adaptiveKeyboard: boolean;
  /** learned reranker that adapts candidate order to accepts. */
  learnedRanking: boolean;
  /** real-word correction ("form"->"from" in context). */
  realWordCorrection: boolean;
  /** split/join correction ("alot"->"a lot"). */
  splitCorrection: boolean;
  /** Kneser-Ney continuation probabilities. */
  useContinuation: boolean;
  /** within-document cache weight (0 disables). */
  cacheGamma: number;
  /** vault-relative path used for export/import of personalization. NOTE this is NOT
   *  where personalization lives - the live store is always
   *  <vault>/.obsidian/plugins/<id>/personalization.json. This path is only touched by
   *  the Export/Import buttons. */
  personalizationSharePath: string;
  /** Master switch for personalization: learning AND applying what was learned.
   *  Off = the engine behaves identically for everyone, and nothing new is recorded. */
  personalizationEnabled: boolean;

  /** Key that accepts the highlighted suggestion. */
  acceptKey: AcceptKey;
  /** Collapse a double space before a word as you complete it. */
  collapseDoubleSpace: boolean;
  /** Run the neural model on the WASM-SIMD kernel (default). Off forces scalar JS. */
  wasmSimd: boolean;

  /** max number of suggestions shown in the popup (e.g. 3). */
  maxSuggestions: number;

  /** Only let Tab indent a list item when the caret is at the start of the item's content
   *  (right after the bullet), like Word - so a Tab-accept that misses because the popup
   *  closed can't accidentally indent the bullet. */
  tabIndentAtBulletStartOnly: boolean;

  // --- markdown / performance ---
  /** skip prediction/autocorrect inside code, math, links, tags, frontmatter. */
  markdownAware: boolean;
  /** run the WHOLE engine (prediction, autocorrect, model building) in a Web
   *  Worker. Off = run it inline on the main thread, which will stutter typing. */
  offMainThread: boolean;
  /** show the top prediction as dimmed inline "ghost text" (Tab to accept). */
  ghostText: boolean;

  // --- triggers / scope ---
  /** Folders or files (glob patterns allowed) where predictions AND autocorrect never
   *  run - e.g. "Templates", "Journal/*", "*.excalidraw.md". */
  excludedFolders: string[];
  /** Minimum characters typed into the CURRENT word before completions appear. 1 = as
   *  soon as you start a word; higher = only after a longer prefix (less noise).
   *  Next-word prediction right after a space is unaffected. */
  minChars: number;

  /** Suggest related notes to link, per paragraph/bullet, blending the neural model's
   *  topic fingerprint with keyword overlap. A link icon appears only where a close match
   *  exists; clicking it offers the feasible targets. Never inserts anything on its own. */
  suggestLinks: boolean;
  /** EXPERIMENTAL: faintly underline text in the note that exactly matches an existing note
   *  title/alias, so you can click it to link. Independent of the end-of-section related links. */
  underlineLinks: boolean;
  /** How eager related-link suggestions are, 1 (only very close matches) to 5 (looser). */
  relatedSensitivity: number;
  /** Minimum words in a block before it can get a link icon (keeps stray half-sentences
   *  and lines you're mid-typing free of suggestions). */
  minLinkWords: number;
  /** Suggest relevant tags as you type `#` (Obsidian-native tag autocomplete). */
  suggestTagsOnHash: boolean;
  /** Offer "Suggest alternatives" when right-clicking a word (more eloquent wording). */
  suggestAlternatives: boolean;
  /** Reflow a currency amount that already has a symbol: group thousands and put the symbol on the
   *  configured side ("$1000 " → "$1,000 "). */
  currencyFormat: boolean;
  /** After a number, convert a spelled-out currency word or ISO code to its symbol and reformat the
   *  number ("1000 euros " → "€1,000 "). */
  currencyWordToSymbol: boolean;
  /** Thousands separator for currency amounts: "comma" → $1,000 ; "period" → 1.000 € ; "none" →
   *  $1000. The decimal mark and symbol side follow from it (comma/none = English style, symbol
   *  before; period = European style, symbol after). */
  currencyThousands: "comma" | "period" | "space" | "none";
  /** Where the euro sign sits: "before" (€100) or "after" (100 €). Other currencies follow their
   *  own fixed convention; only the euro genuinely varies by locale. */
  currencyEuroPlacement: "before" | "after";
  /** Emit the ISO code instead of the symbol ("1,000 USD" rather than "$1,000"). */
  currencyUseCode: boolean;
  /** Convert a typed fraction to its Unicode glyph on a boundary ("1/2" → "½"). */
  fractionGlyphs: boolean;
  /** Keep the note's frontmatter `tags:` in sync with the #tags used in its body: add a
   *  tag when it first appears inline, remove it when its last inline use is deleted. */
  syncFrontmatterTags: boolean;
  /** Replace Obsidian's built-in `[[` link picker with this plugin's, which ranks notes by
   *  topical relevance to what you're writing and can link to a specific section. */
  replaceLinkMenu: boolean;
}

export interface PersonalizationHandlers {
  onReset: () => void | Promise<void>;
  onExport: (path: string) => void | Promise<void>;
  onImport: (path: string, merge: boolean) => void | Promise<void>;
  getStats: () => { corrections: number; accepts: number; reverts: number; charsSaved: number; streak: number; bestStreak: number; minutesSaved: number; learnListSize: number };
  /** Open the full "writing stats" dashboard. */
  onOpenStats: () => void;
  /** Open the personal-dictionary manager window. */
  onOpenDictionary: () => void;
  /** Re-open the getting-started tour. */
  onOpenTutorial: () => void;
  /** Reset all statistics (behind a confirmation). */
  onResetStats: () => void;
  /** Reset every SETTING to its default, keeping your personal dictionary and learned
   *  personalization (behind a confirmation). */
  onResetSettings: () => void;
  /** Factory reset: settings, personalization, statistics and the personal dictionary - the
   *  lot (behind a loud red confirmation). */
  onFactoryReset: () => void;
}

export interface AccelerationHandlers {
  /** Live engine status, so the pane reports what is ACTUALLY happening rather than
   *  what the toggle merely requests. */
  status: () => Promise<{ ready: boolean; accelerated: boolean; lstmLoaded: boolean }>;
  /** Re-load the neural model so a change to the WASM-SIMD toggle takes effect now. */
  reload: () => Promise<void>;
  /** How many model files are still missing, so the pane can offer to fetch them. */
  missingAssets: () => Promise<number>;
  /** Run the download (with its consent dialog). Resolves true if anything landed. */
  installAssets: () => Promise<boolean>;
}

export const DEFAULT_PREDICTIVE_SETTINGS: PredictiveSettings = {
  pluginEnabled: true,
  enablePredictions: true,
  personalBias: true,
  alpha: 0.15,
  lstmWeight: 0.6,
  // 1.5 (trust the typed letters a bit more than pure 1.0) measured best on a real-model
  // A/B: same typo recovery as 1.0 but fewer harmful mis-corrections (a far context-driven
  // word replacing a closer typo fix, e.g. "th"→"to"); ≥2 starts losing recovery.
  beta: 1.5,
  modelPromptShown: false,
  tutorialShown: false,
  channelSigma: 1.0,
  keyboardLayout: "uk",
  maxEditCost: 4.0,
  autocorrectOnSpace: true,
  infoGainThreshold: 2.5,
  autoCapitalize: true,
  removeDoubledWords: true,
  extraAbbreviations: [],
  userDictionary: [],
  userDictionaryUserAdded: [],
  suggestUserDictionary: true,
  undoAddsToDictionary: true,
  learnAbbreviationsOnRevert: true,
  pruneDictionaryFromVault: true,
  filterProfanity: true,
  fuzzyStrength: 1.0,
  phoneticStrength: 1.0,
  adaptiveKeyboard: true,
  learnedRanking: true,
  realWordCorrection: true,
  splitCorrection: true,
  useContinuation: true,
  cacheGamma: 0.15,
  personalizationSharePath: "predictive-personalization.json",
  personalizationEnabled: true,
  acceptKey: "Tab",
  collapseDoubleSpace: true,
  wasmSimd: true,
  maxSuggestions: 3,
  tabIndentAtBulletStartOnly: false,
  markdownAware: true,
  offMainThread: true,
  ghostText: false,
  excludedFolders: [],
  minChars: 1,
  suggestLinks: true,
  underlineLinks: true,
  relatedSensitivity: 3,
  minLinkWords: 12,
  suggestTagsOnHash: true,
  suggestAlternatives: true,
  currencyFormat: true,
  currencyWordToSymbol: true,
  currencyThousands: "space", // 1 000,50 - the Ukrainian convention
  currencyEuroPlacement: "before",
  currencyUseCode: false,
  fractionGlyphs: false,
  syncFrontmatterTags: true,
  replaceLinkMenu: true,
};

/**
 * Answers the settings pane needs but can only get asynchronously (is the model installed, is
 * SIMD actually running). The pane is described synchronously and re-described on every render,
 * so the answers are cached HERE, outside any one render, and fetched only when missing. A
 * fetch that resolves calls `redraw`; because the result is cached, that redraw does not fetch
 * again, so there is no loop. Invalidate a field to ask again.
 */
export interface AccelerationState {
  status?: string;
  missing?: number;
  pending?: boolean;
}

/** Describe the whole pane. Called fresh on every render, so plain `if`s are enough to make a
 *  setting conditional: the description is rebuilt from current state each time. */
export function buildPredictiveSettingGroups(
  settings: PredictiveSettings,
  onChange: () => void | Promise<void>,
  personalization?: PersonalizationHandlers,
  /** Re-render the whole pane. Needed by settings whose DESCRIPTION or visibility
   *  depends on another setting, so the pane cannot go stale under the user. */
  redraw?: () => void,
  /** Lets the WASM-SIMD toggle report the real acceleration state and apply changes
   *  immediately. Absent (e.g. in tests) hides the status line. */
  acceleration?: AccelerationHandlers,
  accelState: AccelerationState = {},
): PaneGroup[] {
  const b = new PaneBuilder();
  const row = () => b.row();
  const commit = () => void onChange();
  const bag = settings as unknown as Record<string, boolean>;
  const toggle = (name: MessageKey, desc: MessageKey, key: keyof PredictiveSettings) =>
    row()
      .setName(t(name))
      .setDesc(t(desc))
      .addToggle((t) =>
        t.setValue(bag[key as string]).onChange((v) => {
          bag[key as string] = v;
          commit();
        }),
      );

  b.group(t("ui.msg.SmartPredictionsAutocorrect"));
  b.note(
    t("ui.msg.PredictsNextWordFixesTypos"),
  );

  // --- master switch + resets, right at the top ---------------------------
  row()
    .setName(t("ui.name.EnableSmartAutocorrect"))
    .setDesc(t("ui.desc.MasterSwitchOffNothingRuns"))
    .addToggle((t) =>
      t.setValue(settings.pluginEnabled).onChange((v) => {
        settings.pluginEnabled = v;
        commit();
        redraw?.();
      }),
    );

  if (personalization) {
    row()
      .setName(t("ui.name.GettingStarted"))
      .setDesc(t("ui.desc.QuickTourAcceptingSuggestionHow"))
      .addButton((btn) => btn.setButtonText(t("ui.btn.ShowMe")).onClick(() => personalization.onOpenTutorial()));
    row()
      .setName(t("ui.name.ResetSettings"))
      .setDesc(t("ui.desc.PutEveryOptionMenuBack"))
      .addButton((b) => b.setButtonText(t("ui.name.ResetSettings")).onClick(() => personalization.onResetSettings()));
    row()
      .setName(t("ui.name.FactoryReset"))
      .setDesc(t("ui.desc.WipeEverythingPluginStoresSettings"))
      .addButton((b) => {
        // mod-warning (the red destructive style) is applied by the CSS class directly rather
        // than ButtonComponent.setWarning(): setWarning is deprecated and its replacement
        // setDestructive() is newer than our declared minAppVersion, so calling either trips the
        // plugin scanner. The class has been stable for years and works on every version.
        b.setButtonText(t("ui.name.FactoryReset")).onClick(() => personalization.onFactoryReset());
        b.buttonEl.addClass("mod-warning");
      });

    // Writing stats + support, right below the reset buttons. The headline number, the button to the
    // full dashboard, and the buy-me-a-coffee block travel together as one section.
    const topStats = personalization.getStats();
    b.custom(t("ui.msg.WritingStats"), (el) => {
      const saved = el.createEl("p", { cls: "setting-item-description" });
      saved.createEl("strong", { text: `⌨️ ${topStats.charsSaved.toLocaleString()}` });
      const hrs =
        topStats.minutesSaved >= 60
          ? t("time.hours", { n: (topStats.minutesSaved / 60).toFixed(1) })
          : t("time.minutes", { n: Math.round(topStats.minutesSaved) });
      saved.appendText(t("set.stats.line", { time: hrs }));
      if (topStats.streak > 1)
        saved.appendText(t("set.stats.streak", { n: topStats.streak, best: topStats.bestStreak }));
    });
    // Support sits BETWEEN the headline number and the See/Reset-stats menu, so the
    // buy-me-a-coffee ask reads as part of the stats section rather than trailing after
    // the reset controls.
    // No donation ask here. Upstream's pane solicited for ITS author's Buy Me a Coffee;

    // shipping that in a fork would collect on someone else's behalf from users who

    // installed this one, and the rules allow a fundingUrl only for the plugin's own author.

    row()
      .setName(t("ui.name.WritingStats"))
      .setDesc(t("ui.desc.StreakTimeSavedMilestonesWhat"))
      .addButton((b) => b.setButtonText(t("ui.btn.SeeStats")).setCta().onClick(() => personalization.onOpenStats()))
      .addButton((b) => {
        b.setButtonText(t("ui.btn.ResetStatistics")).onClick(() => personalization.onResetStats());
        b.buttonEl.addClass("mod-warning"); // see the Factory-reset button for why the class, not setWarning()
      });
  }

  if (!settings.pluginEnabled) {
    b.note(t("ui.msg.SmartAutocorrectTurnedOffTurn"));
    return b.groups; // nothing else is active, so don't show a wall of dead options
  }

  b.group(t("ui.msg.PredictionsAutocorrect"));

  row()
    .setName(t("ui.name.PredictiveTextSuggestNextWord"))
    .setDesc(t("ui.desc.SuggestsLikelyNextWordsFrom"))
    .addToggle((t) =>
      t.setValue(settings.enablePredictions).onChange((v) => {
        settings.enablePredictions = v;
        commit();
      }),
    );

  row()
    .setName(t("ui.name.AutocorrectTyposWhenYouPress"))
    .setDesc(t("ui.desc.FixesObviousMisspellingWhenYou"))
    .addToggle((t) =>
      t.setValue(settings.autocorrectOnSpace).onChange((v) => {
        settings.autocorrectOnSpace = v;
        commit();
      }),
    );

  row()
    .setName(t("ui.name.AutocorrectStrengthInformationGain"))
    .setDesc(t("ui.help.SurprisingTypedWordMustBe"))
    .addSlider((s) =>
      s
        .setLimits(0.5, 8, 0.5)
        .setValue(settings.infoGainThreshold)
        .onChange((v) => {
          settings.infoGainThreshold = v;
          commit();
        }),
    );

  row()
    .setName(t("ui.name.RemoveAccidentalDoubledWords"))
    .setDesc(t("set.doubled.desc"))
    .addToggle((t) =>
      t.setValue(settings.removeDoubledWords).onChange((v) => {
        settings.removeDoubledWords = v;
        commit();
      }),
    );

  row()
    .setName(t("ui.name.AutoCapitaliseSentencesNames"))
    .setDesc(t("set.autocap.desc"))
    .addToggle((t) =>
      t.setValue(settings.autoCapitalize).onChange((v) => {
        settings.autoCapitalize = v;
        commit();
      }),
    );

  row()
    .setName(t("ui.name.PreferWordsFromOwnNotes"))
    .setDesc(t("ui.desc.LeansSuggestionsTowardWordsPhrasing"))
    .addToggle((t) =>
      t.setValue(settings.personalBias).onChange((v) => {
        settings.personalBias = v;
        commit();
      }),
    );

  toggle("set.alt.name", "set.alt.desc", "suggestAlternatives");

  row()
    .setName(t("ui.name.VaultInfluence"))
    .setDesc(t("ui.desc.HowMuchOwnNotesOutweigh"))
    .addSlider((s) =>
      s
        .setLimits(0, 1, 0.05)
        .setValue(settings.alpha)
        .onChange((v) => {
          settings.alpha = v;
          commit();
        }),
    );

  row()
    .setName(t("ui.name.NeuralVsWordFrequencyBlend"))
    .setDesc(t("ui.desc.HowMuchNeuralLstmNext"))
    .addSlider((s) =>
      s
        .setLimits(0, 1, 0.05)
        .setValue(settings.lstmWeight)
        .onChange((v) => {
          settings.lstmWeight = v;
          commit();
        }),
    );

  row()
    .setName(t("ui.name.TrustTypingVsContext"))
    .setDesc(t("ui.desc.WhenTypoAmbiguousHigherTrusts"))
    .addSlider((s) =>
      s
        .setLimits(0.2, 3, 0.1)
        .setValue(settings.beta)
        .onChange((v) => {
          settings.beta = v;
          commit();
        }),
    );

  row()
    .setName(t("ui.name.WordsArenTSentenceEnds"))
    .setDesc(t("set.abbr.desc"))
    .addTextArea((t) =>
      t
        .setValue(settings.extraAbbreviations.join(", "))
        .onChange((v) => {
          settings.extraAbbreviations = v
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          commit();
        }),
    );

  if (personalization) {
    const count = settings.userDictionary.length;
    row()
      .setName(t("ui.name.PersonalDictionary"))
      .setDesc(t("set.dict.desc", { count }))
      .addButton((b) => b.setButtonText(t("ui.btn.ManageDictionary")).onClick(() => personalization.onOpenDictionary()));
  }

  row()
    .setName(t("ui.name.SuggestPersonalDictionaryWords"))
    .setDesc(t("ui.desc.OfferDictionaryWordsAsCompletions"))
    .addToggle((t) =>
      t.setValue(settings.suggestUserDictionary).onChange((v) => {
        settings.suggestUserDictionary = v;
        commit();
      }),
    );

  row()
    .setName(t("ui.name.UndoAddsWordDictionary"))
    .setDesc(t("ui.help.UndoAutocorrectionCtrlcmdzAddWord"))
    .addToggle((t) =>
      t.setValue(settings.undoAddsToDictionary).onChange((v) => {
        settings.undoAddsToDictionary = v;
        commit();
      }),
    );

  row()
    .setName(t("ui.name.LearnAbbreviationsWhenYouUndo"))
    .setDesc(t("ui.help.UndoCapitalLetterWasAdded"))
    .addToggle((t) =>
      t.setValue(settings.learnAbbreviationsOnRevert).onChange((v) => {
        settings.learnAbbreviationsOnRevert = v;
        commit();
      }),
    );

  row()
    .setName(t("ui.name.ForgetDictionaryWordsRemovedFrom"))
    .setDesc(t("ui.help.WordPersonalDictionaryNoLonger"))
    .addToggle((t) =>
      t.setValue(settings.pruneDictionaryFromVault).onChange((v) => {
        settings.pruneDictionaryFromVault = v;
        commit();
      }),
    );

  row()
    .setName(t("ui.name.FilterProfanityNsfwWords"))
    .setDesc(t("ui.help.NeverSuggestAutocorrectSwearWords"))
    .addToggle((t) =>
      t.setValue(settings.filterProfanity).onChange((v) => {
        settings.filterProfanity = v;
        commit();
      }),
    );

  // --- matching quality ---------------------------------------------------
  b.group(t("ui.msg.AccuracyBoosters"), true);
  b.note(t("ui.msg.EachMakesCorrectionsSmarterDifferent"));
  row()
    .setName(t("ui.name.KeyboardTypoStrength"))
    .setDesc(t("set.kbd.desc"))
    .addSlider((s) =>
      s
        .setLimits(0, 3, 0.1)
        .setValue(settings.fuzzyStrength)
        .onChange((v) => {
          settings.fuzzyStrength = v;
          commit();
        }),
    );
  row()
    .setName(t("ui.name.SoundAlikeStrength"))
    .setDesc(t("set.sound.desc"))
    .addSlider((s) =>
      s
        .setLimits(0, 3, 0.1)
        .setValue(settings.phoneticStrength)
        .onChange((v) => {
          settings.phoneticStrength = v;
          commit();
        }),
    );
  toggle("set.realword.name", "set.realword.desc", "realWordCorrection");
  toggle("set.split.name", "set.split.desc", "splitCorrection");
  toggle("set.context.name", "set.context.desc", "useContinuation");
  toggle("set.adapt.name", "set.adapt.desc", "adaptiveKeyboard");
  toggle("set.rank.name", "set.rank.desc", "learnedRanking");
  row()
    .setName(t("ui.name.FavourWordsFromNote"))
    .setDesc(t("ui.desc.GivesSmallBoostWordsYou"))
    .addSlider((s) =>
      s
        .setLimits(0, 0.5, 0.05)
        .setValue(settings.cacheGamma)
        .onChange((v) => {
          settings.cacheGamma = v;
          commit();
        }),
    );

  row()
    .setName(t("ui.name.SuggestionsShown"))
    .setDesc(t("ui.desc.HowManySuggestionsAppearPopup"))
    .addSlider((s) =>
      s
        .setLimits(1, 8, 1)
        .setValue(settings.maxSuggestions)
        .onChange((v) => {
          settings.maxSuggestions = v;
          commit();
        }),
    );

  row()
    .setName(t("ui.name.StartSuggestingAfter"))
    .setDesc(t("ui.help.ManyLettersWordMustType"))
    .addSlider((s) =>
      s
        .setLimits(1, 5, 1)
        .setValue(settings.minChars)
        .onChange((v) => {
          settings.minChars = v;
          commit();
        }),
    );

  row()
    .setName(t("ui.name.AcceptSuggestionWith"))
    .setDesc(t("ui.help.KeyInsertsHighlightedSuggestionKey"))
    .addDropdown((d) => {
      for (const k of ACCEPT_KEYS) d.addOption(k, k === "ArrowRight" ? t("set.key.arrowRight") : k);
      d.setValue(settings.acceptKey).onChange((v) => {
        settings.acceptKey = v as AcceptKey;
        commit();
      });
    });

  row()
    .setName(t("ui.name.TabIndentsBulletsOnlyFrom"))
    .setDesc(t("ui.help.LikeWordTabIndentsList"))
    .addToggle((t) =>
      t.setValue(settings.tabIndentAtBulletStartOnly).onChange((v) => {
        settings.tabIndentAtBulletStartOnly = v;
        commit();
      }),
    );

  row()
    .setName(t("ui.name.TidyDoubleSpaces"))
    .setDesc(t("ui.help.CompleteWordHasDoubleSpace"))
    .addToggle((t) =>
      t.setValue(settings.collapseDoubleSpace).onChange((v) => {
        settings.collapseDoubleSpace = v;
        commit();
      }),
    );

  // --- convenience: small auto-formatting helpers ------------------------
  b.group(t("ui.msg.Formatting"), true);
  b.note(t("ui.msg.SmallFormattingHelpersTidyUp"));
  toggle("set.cur.name", "set.cur.desc", "currencyFormat");
  toggle("set.curword.name", "set.curword.desc", "currencyWordToSymbol");
  row()
    .setName(t("ui.name.ThousandsSeparator"))
    .setDesc(t("ui.desc.WhichGroupingUseInsideCurrency"))
    .addDropdown((d) =>
      d
        .addOption("space", t("set.opt.space"))
        .addOption("comma", t("ui.opt.Comma"))
        .addOption("period", t("ui.opt.Period"))
        .addOption("none", t("ui.opt.NoneSep"))
        .setValue(settings.currencyThousands)
        .onChange((v) => {
          settings.currencyThousands = v as PredictiveSettings["currencyThousands"];
          commit();
        }),
    );
  row()
    .setName(t("ui.name.EuroSignPosition"))
    .setDesc(t("ui.desc.EuroOneSignWhoseSide"))
    .addDropdown((d) =>
      d
        .addOption("before", t("ui.msg.100Before"))
        .addOption("after", t("ui.msg.100After"))
        .setValue(settings.currencyEuroPlacement)
        .onChange((v) => {
          settings.currencyEuroPlacement = v as PredictiveSettings["currencyEuroPlacement"];
          commit();
        }),
    );
  toggle("set.curcode.name", "set.curcode.desc", "currencyUseCode");
  toggle("set.frac.name", "set.frac.desc", "fractionGlyphs");

  // --- markdown / performance --------------------------------------------
  b.group(t("ui.msg.LinksTags"), true);
  // One dropdown drives the two linking features so you can pick exactly what you want:
  //  - "tooltips": the ambient link icons beside a block (suggestLinks)
  //  - "menu": our [[ picker replacing Obsidian's (replaceLinkMenu)
  const linkMode = (): "both" | "menu" | "tooltips" | "off" =>
    settings.suggestLinks && settings.replaceLinkMenu
      ? "both"
      : settings.suggestLinks
        ? "tooltips"
        : settings.replaceLinkMenu
          ? "menu"
          : "off";
  row()
    .setName(t("ui.name.LinkingAssistance"))
    .setDesc(t("ui.help.ChooseWhichLinkingHelpWant"))
    .addDropdown((d) =>
      d
        .addOptions({
          both: t("set.linkmode.both"),
          menu: t("set.linkmode.menu"),
          tooltips: t("set.linkmode.tooltips"),
          off: t("set.linkmode.off"),
        })
        .setValue(linkMode())
        .onChange((v) => {
          settings.suggestLinks = v === "both" || v === "tooltips";
          settings.replaceLinkMenu = v === "both" || v === "menu";
          commit();
          redraw?.(); // the sensitivity/length sliders below only matter for tooltips
        }),
    );
  toggle("set.underline.name", "set.underline.desc", "underlineLinks");
  if (settings.suggestLinks) {
    row()
      .setName(t("ui.name.RelatedLinkSensitivity"))
      .setDesc(t("ui.help.EagerLinkIcons1Shows"))
      .addSlider((s) =>
        s
          .setLimits(1, 5, 1)
          .setValue(settings.relatedSensitivity)
          .onChange((v) => {
            settings.relatedSensitivity = v;
            commit();
          }),
      );
    row()
      .setName(t("ui.name.MinimumBlockLengthLink"))
      .setDesc(t("ui.help.ParagraphListMustHaveAt"))
      .addSlider((s) =>
        s
          .setLimits(5, 40, 1)
          .setValue(settings.minLinkWords)
          .onChange((v) => {
            settings.minLinkWords = v;
            commit();
          }),
      );
  }
  toggle("set.tags.name", "set.tags.desc", "suggestTagsOnHash");
  toggle("set.fm.name", "set.fm.desc", "syncFrontmatterTags");
  b.note(t("set.links.note"));

  b.group(t("ui.msg.WhereWorksPerformance"), true);
  toggle("set.md.name", "set.md.desc", "markdownAware");
  row()
    .setName(t("ui.name.ExcludedFoldersFiles"))
    .setDesc(t("set.exclude.desc"))
    .addTextArea((area) =>
      area
        .setValue(settings.excludedFolders.join("\n"))
        .setPlaceholder(t("ui.ph.TemplatesNjournal"))
        .onChange((v) => {
          settings.excludedFolders = parseExcludeList(v);
          commit();
        }),
    );
  toggle("set.worker.name", "set.worker.desc", "offMainThread");
  row()
    .setName(t("ui.name.WasmSimdAcceleration"))
    .setDesc(t("ui.help.RunNeuralModelFastInbrowser"))
    .addToggle((t) =>
      t.setValue(settings.wasmSimd).onChange(async (v) => {
        settings.wasmSimd = v;
        await onChange(); // persist + push the setting into the worker FIRST
        await acceleration?.reload(); // then re-init the model on/off the kernel now
        accelState.status = undefined; // the answer just changed, so ask the engine again
        redraw?.(); // re-render so the status line reflects what actually happened
      }),
    );
  // Live status - the whole point of the setting: state what IS happening, never leave
  // a scalar fallback silent. Fetched once and cached (see AccelerationState), because the
  // pane is re-described on every render and re-asking each time would loop.
  if (acceleration) {
    if (accelState.status === undefined && !accelState.pending) {
      accelState.pending = true;
      void Promise.all([acceleration.status(), acceleration.missingAssets()])
        .then(([st, missing]) => {
          accelState.status = !st.lstmLoaded
            ? t("set.accel.noModel")
            : !settings.wasmSimd
              ? t("set.accel.off")
              : st.accelerated
                ? t("set.accel.on")
                : t("set.accel.unsupported");
          accelState.missing = missing;
        })
        .catch(() => {
          accelState.status = t("set.accel.error");
          accelState.missing = 0;
        })
        .finally(() => {
          accelState.pending = false;
          redraw?.();
        });
    }
    b.note(accelState.status ?? t("set.accel.checking"));
  }
  // Offer the one-time model download here too: a user who declined the first-run
  // prompt (or whose download failed) needs a way back that isn't reinstalling.
  if (acceleration && accelState.missing) {
    const n = accelState.missing;
    row()
      .setName(t("ui.name.DownloadLanguageModel"))
      .setDesc(t("set.download.desc", { n }))
      .addButton((btn) =>
        btn
          .setButtonText(t("ui.btn.Download"))
          .setCta()
          .onClick(() => {
            void acceleration.installAssets().then((ok) => {
              if (!ok) return;
              accelState.status = undefined; // a model just landed: re-read both answers
              redraw?.();
            });
          }),
      );
  }
  row()
    .setName(t("ui.name.SuggestionStyle"))
    .setDesc(t("ui.help.CompletionsAppearPopupListLets"))
    .addDropdown((d) =>
      d
        .addOptions({ popup: t("set.style.popup"), ghost: t("set.style.ghost") })
        .setValue(settings.ghostText ? "ghost" : "popup")
        .onChange((v) => {
          settings.ghostText = v === "ghost";
          commit();
        }),
    );
  row()
    .setName(t("ui.name.KeyboardLayout"))
    .setDesc(t("ui.desc.WhichKeysCountAsNear"))
    .addDropdown((d) =>
      d
        // "uk" = ЙЦУКЕН for Ukrainian letters + QWERTY for Latin ones. A saved "qwerty" (the old
        // English default) means the same thing now, so show it as "uk".
        .addOptions({
          uk: t("ui.opt.LayoutStandard"),
          qwertz: "QWERTZ (" + t("ui.opt.LayoutLatinOnly") + ")",
          azerty: "AZERTY (" + t("ui.opt.LayoutLatinOnly") + ")",
          dvorak: "Dvorak (" + t("ui.opt.LayoutLatinOnly") + ")",
        })
        .setValue(settings.keyboardLayout === "qwerty" ? "uk" : settings.keyboardLayout)
        .onChange((v) => {
          settings.keyboardLayout = v as typeof settings.keyboardLayout;
          commit();
        }),
    );

  // --- personalization management ----------------------------------------
  if (!personalization) return b.groups;
  b.group(t("set.group.personalization"), true);
  const stats = personalization.getStats();
  // The headline stats, the "See your stats" button and the support block live below the reset
  // buttons above. This group keeps the deeper learning controls.
  b.note(
    settings.personalizationEnabled
      ? t("set.pers.on", { accepts: stats.accepts, corrections: stats.corrections, reverts: stats.reverts, learn: stats.learnListSize })
      : t("set.pers.off", { accepts: stats.accepts, corrections: stats.corrections, reverts: stats.reverts }),
  );

  row()
    .setName(t("ui.name.AdaptMe"))
    .setDesc(t("ui.help.AdaptCorrectionsSuggestionsAcceptTurn"))
    .addToggle((t) =>
      t.setValue(settings.personalizationEnabled).onChange((v) => {
        settings.personalizationEnabled = v;
        commit();
        // The blurb above and the controls below both depend on this, so redraw.
        redraw?.();
      }),
    );

  row()
    .setName(t("ui.name.ShareFileVaultPath"))
    .setDesc(t("ui.help.UsedByExportimportButtonsBelow"))
    .addText((t) =>
      t
        .setValue(settings.personalizationSharePath)
        .onChange((v) => {
          settings.personalizationSharePath = v.trim() || "predictive-personalization.json";
          commit();
        }),
    );

  row()
    .setName(t("ui.name.ExportImportPersonalization"))
    .addButton((b) =>
      b.setButtonText(t("ui.btn.Export")).onClick(() => void personalization.onExport(settings.personalizationSharePath)),
    )
    .addButton((b) =>
      b.setButtonText(t("ui.btn.ImportReplace")).onClick(() => void personalization.onImport(settings.personalizationSharePath, false)),
    )
    .addButton((b) =>
      b.setButtonText(t("ui.btn.ImportMerge")).onClick(() => void personalization.onImport(settings.personalizationSharePath, true)),
    );

  row()
    .setName(t("ui.name.ResetPersonalization"))
    .setDesc(t("ui.desc.ClearAllLearnedAdaptationKeyboard"))
    .addButton((b) => {
      b.setButtonText(t("ui.btn.Reset")).onClick(() => void personalization.onReset());
      b.buttonEl.addClass("mod-warning"); // see the Factory-reset button for why the class, not setWarning()
    });
  return b.groups;
}

/**
 * Pre-1.13 entry point, kept so the pane still renders on the Obsidian versions this plugin
 * supports (manifest minAppVersion is below 1.13). Same groups, drawn imperatively.
 */
export function renderPredictiveSettings(
  containerEl: HTMLElement,
  settings: PredictiveSettings,
  onChange: () => void | Promise<void>,
  personalization?: PersonalizationHandlers,
  redraw?: () => void,
  acceleration?: AccelerationHandlers,
  accelState: AccelerationState = {},
): void {
  renderPaneGroups(
    containerEl,
    buildPredictiveSettingGroups(settings, onChange, personalization, redraw, acceleration, accelState),
  );
}
