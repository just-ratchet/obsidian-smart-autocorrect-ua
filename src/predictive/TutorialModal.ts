/**
 * "Getting started": a five-step tour shown once, after the first-run model download.
 *
 * Deliberately short. The plugin has a lot of surface, but only a few things a new user MUST
 * know or they will not understand what is happening to their text: Tab accepts, space
 * corrects, and undo puts a wrong correction back. Every other feature is discoverable from the
 * settings tab and does not need explaining up front. A longer tour is a tour people click
 * through without reading, which helps no one.
 *
 * It ends on the stats counter rather than another feature: finishing on what the plugin has
 * done FOR you is a better last impression than one more thing to learn, and it points at the
 * status bar, which is the one piece of the UI that is always visible.
 *
 * Each step is one line of text and one picture, because that is what gets read.
 */
import { Modal, Setting } from "obsidian";
import { t, type MessageKey } from "./i18n";
import type { App } from "obsidian";
import { TUTORIAL_IMAGES } from "./tutorialImages";

export interface TutorialStep {
  /** Message KEYS, not text: TUTORIAL_STEPS is a module-level constant, so resolving
   *  t() here would freeze the language at import time (same reason as MODEL_ASSETS). */
  titleKey: MessageKey;
  /** One sentence. If it needs two, it is two steps or it is not a need-to-know. */
  bodyKey: MessageKey;
  /** Keys the step is about, drawn as keycaps under the text. */
  keys?: string[];
  /** Key into TUTORIAL_IMAGES. The step renders without it if no picture is bundled. */
  image?: keyof typeof TUTORIAL_IMAGES;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  { titleKey: "ui.tut.1.title", bodyKey: "ui.tut.1.body", keys: ["Tab"], image: "suggest" },
  { titleKey: "ui.tut.2.title", bodyKey: "ui.tut.2.body", keys: ["Space"], image: "autocorrect" },
  { titleKey: "ui.tut.3.title", bodyKey: "ui.tut.3.body", keys: ["Ctrl", "Z"], image: "undo" },
  { titleKey: "ui.tut.4.title", bodyKey: "ui.tut.4.body", image: "stats" },
];

export class TutorialModal extends Modal {
  private step = 0;
  private onDone?: () => void;

  constructor(app: App, onDone?: () => void) {
    super(app);
    this.onDone = onDone;
  }

  onOpen(): void {
    this.modalEl.addClass("smart-autocorrect-tutorial-modal");
    this.render();
    // Arrow keys page through, which is what anyone tries first in a stepped dialog.
    this.scope.register([], "ArrowRight", () => this.go(1));
    this.scope.register([], "ArrowLeft", () => this.go(-1));
  }

  private go(delta: number): void {
    const next = this.step + delta;
    if (next < 0) return;
    if (next >= TUTORIAL_STEPS.length) {
      this.close();
      return;
    }
    this.step = next;
    this.render();
  }

  private render(): void {
    const s = TUTORIAL_STEPS[this.step];
    const root = this.contentEl;
    root.empty();
    root.addClass("smart-autocorrect-tutorial");

    root.createEl("h2", { text: t(s.titleKey), cls: "sa-tut-title" });
    root.createEl("p", { text: t(s.bodyKey), cls: "sa-tut-body" });

    if (s.keys?.length) {
      const keys = root.createDiv({ cls: "sa-tut-keys" });
      s.keys.forEach((k, i) => {
        if (i > 0) keys.createSpan({ cls: "sa-tut-plus", text: "+" });
        keys.createEl("kbd", { text: k });
      });
    }

    const src = s.image ? TUTORIAL_IMAGES[s.image] : undefined;
    if (src) {
      const img = root.createEl("img", { cls: "sa-tut-img" });
      img.src = src;
      img.alt = t(s.titleKey);
    }

    // Dots first, so "where am I" is answered above the buttons the eye lands on.
    const dots = root.createDiv({ cls: "sa-tut-dots" });
    TUTORIAL_STEPS.forEach((_, i) => {
      dots.createSpan({ cls: i === this.step ? "sa-tut-dot is-active" : "sa-tut-dot" });
    });

    const last = this.step === TUTORIAL_STEPS.length - 1;
    const nav = new Setting(root);
    nav.settingEl.addClass("sa-tut-nav");
    if (this.step > 0) nav.addButton((b) => b.setButtonText(t("ui.btn.Back")).onClick(() => this.go(-1)));
    else nav.addButton((b) => b.setButtonText(t("ui.btn.Skip")).onClick(() => this.close()));
    nav.addButton((b) =>
      b
        .setButtonText(last ? t("ui.btn.StartWriting") : t("ui.btn.Next"))
        .setCta()
        .onClick(() => this.go(1)),
    );
  }

  onClose(): void {
    this.contentEl.empty();
    // Closing at any point counts as done: a tour you have to sit through is worse than no
    // tour, and it can always be reopened from the settings tab.
    this.onDone?.();
  }
}
