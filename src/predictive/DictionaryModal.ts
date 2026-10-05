/**
 * The personal-dictionary manager: a proper window listing every pinned word, the ones you added
 * yourself above the ones learned automatically (each alphabetical), with a remove button per word
 * and an add field at the bottom. Mutates the live settings object and calls `onChange` to persist.
 */
import { Modal, Notice, Setting } from "obsidian";
import { t } from "./i18n";
import type { App } from "obsidian";
import type { PredictiveSettings } from "./PredictiveSettings";

export class DictionaryModal extends Modal {
  constructor(
    app: App,
    private settings: PredictiveSettings,
    private onChange: () => void,
    /** Whether the engine already recognises a word, so we can refuse to "add" one that
     *  is already correct (it would just be tidied away again). Optional so tests/callers
     *  without an engine still work - they simply skip the known-word guard. */
    private isKnown?: (word: string) => Promise<boolean>,
  ) {
    super(app);
  }

  onOpen(): void {
    this.render();
  }

  private render(): void {
    const el = this.contentEl;
    el.empty();
    el.addClass("smart-autocorrect-dict-modal");
    el.createEl("h2", { text: t("ui.msg.PersonalDictionary") });
    el.createEl("p", {
      cls: "setting-item-description",
      text: t("dict.help"),
    });

    const userAdded = new Set(this.settings.userDictionaryUserAdded ?? []);
    const byName = (a: string, b: string) => a.localeCompare(b, ["uk", "en"], { sensitivity: "base" }); // "uk" collation: ґ, є, і, ї sort where Ukrainian readers expect
    const added = this.settings.userDictionary.filter((w) => userAdded.has(w)).sort(byName);
    const learned = this.settings.userDictionary.filter((w) => !userAdded.has(w)).sort(byName);

    const remove = (w: string) => {
      this.settings.userDictionary = this.settings.userDictionary.filter((x) => x !== w);
      this.settings.userDictionaryUserAdded = (this.settings.userDictionaryUserAdded ?? []).filter((x) => x !== w);
      this.onChange();
      this.render();
    };
    const add = async (raw: string) => {
      const w = raw.trim();
      if (!w) return;
      if (/\d/.test(w)) {
        new Notice(t("ui.msg.IsnTDictionaryWord", { v1: w }));
        return;
      }
      // Reject a word that is already pinned, case-INSENSITIVELY: "iPhone" and "iphone"
      // are the same entry as far as "already there" goes, so don't stack a second row.
      if (this.settings.userDictionary.some((x) => x.toLowerCase() === w.toLowerCase())) {
        new Notice(t("ui.msg.AlreadyPersonalDictionary", { v1: w }));
        return;
      }
      // Reject a word the engine already recognises: adding it is redundant (it is never
      // autocorrected in the first place), so it would just be tidied away again.
      try {
        if (this.isKnown && (await this.isKnown(w))) {
          new Notice(t("ui.msg.AlreadyRecognisedNeedAdd", { v1: w }));
          return;
        }
      } catch {
        /* engine unavailable: add best-effort */
      }
      this.settings.userDictionary = [...this.settings.userDictionary, w];
      this.settings.userDictionaryUserAdded = [...(this.settings.userDictionaryUserAdded ?? []), w];
      this.onChange();
      this.render();
    };

    const section = (title: string, words: string[]) => {
      if (words.length === 0) return;
      el.createDiv({ cls: "smart-autocorrect-dict-heading", text: t("dict.heading", { title, count: words.length }) });
      const list = el.createDiv({ cls: "smart-autocorrect-dict-rows" });
      for (const w of words) {
        const row = list.createDiv({ cls: "smart-autocorrect-dict-row" });
        row.createSpan({ text: w, cls: "smart-autocorrect-dict-word" });
        row.createEl("button", { text: t("ui.msg.Remove"), cls: "smart-autocorrect-dict-remove-btn" }).onclick = () => remove(w);
      }
    };
    section(t("dict.section.added"), added);
    section(t("dict.section.learned"), learned);
    if (added.length === 0 && learned.length === 0)
      el.createEl("p", { cls: "setting-item-description", text: t("ui.msg.WordsYetAddOneBelow") });

    let pending = "";
    new Setting(el)
      .setName(t("ui.name.AddWord"))
      .addText((input) => {
        input.setPlaceholder(t("ui.ph.Word"));
        input.onChange((v) => (pending = v));
        input.inputEl.addEventListener("keydown", (e) => {
          if (e.key === "Enter") { e.preventDefault(); void add(input.getValue()); }
        });
      })
      .addButton((b) => b.setButtonText(t("ui.btn.Add")).setCta().onClick(() => void add(pending)));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
