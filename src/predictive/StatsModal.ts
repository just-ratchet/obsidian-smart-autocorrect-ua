/**
 * t("ui.msg.WritingStats") dashboard: a proper window onto the gamification numbers that
 * otherwise only show as a small status-bar tally. Opened by clicking the status bar
 * or via the "Show writing stats" command. Read-only; all values come from a snapshot
 * so the modal has no dependency on the engine internals.
 */
import { Modal } from "obsidian";
import { t } from "./i18n";
import type { App } from "obsidian";


export interface StatsSnapshot {
  keystrokesSaved: number;
  minutesSaved: number;
  todaySaved: number;
  streak: number;
  bestStreak: number;
  corrections: number;
  accepts: number;
  reverts: number;
  learnedWords: number;
  alternativesAccepted: number;
  nextMilestone: number | null;
  allMilestones: number[];
}

function timeText(mins: number): string {
  if (mins >= 60) return t("time.hoursLong", { n: (mins / 60).toFixed(1) });
  return t("time.minutes", { n: Math.round(mins) });
}

export class StatsModal extends Modal {
  private getSnapshot: () => StatsSnapshot;
  private onClosed?: () => void;

  constructor(app: App, getSnapshot: () => StatsSnapshot, onClosed?: () => void) {
    super(app);
    this.getSnapshot = getSnapshot;
    this.onClosed = onClosed;
  }

  onOpen(): void {
    this.render();
  }

  /**
   * Re-draw from a fresh snapshot. Called whenever the tallies change, so the numbers you are
   * looking at are the current ones - the dashboard used to render once on open and then sit
   * there stale while you carried on typing behind it. Driven by the accept event rather than
   * a timer, so it costs nothing when nothing is happening and never lags behind.
   */
  refresh(): void {
    if (this.contentEl.isShown()) this.render();
  }

  private render(): void {
    const s = this.getSnapshot();
    const root = this.contentEl;
    root.empty();
    root.addClass("smart-autocorrect-stats");
    root.createEl("h2", { text: t("ui.msg.WritingStats") });

    // Headline cards: the three numbers people care about.
    const cards = root.createDiv({ cls: "sa-stat-cards" });
    const card = (value: string, label: string) => {
      const c = cards.createDiv({ cls: "sa-stat-card" });
      c.createDiv({ cls: "sa-stat-value", text: value });
      c.createDiv({ cls: "sa-stat-label", text: label });
    };
    card(s.keystrokesSaved.toLocaleString(), t("stats.keystrokesSaved"));
    card(timeText(s.minutesSaved), t("stats.timeSaved"));
    card(t("stats.days", { n: s.streak }), t("stats.currentStreak"));

    // Secondary line: today + best streak.
    const sub = root.createEl("p", { cls: "sa-stat-sub" });
    sub.setText(t("stats.sub", { today: s.todaySaved.toLocaleString(), best: s.bestStreak }));

    // Progress to the next milestone.
    if (s.nextMilestone !== null) {
      const prev = [...s.allMilestones].reverse().find((m) => m < s.nextMilestone!) ?? 0;
      const span = s.nextMilestone - prev;
      const done = Math.min(1, Math.max(0, (s.keystrokesSaved - prev) / span));
      const wrap = root.createDiv({ cls: "sa-progress-wrap" });
      wrap.createDiv({
        cls: "sa-progress-label",
        text: t("stats.nextUp", { n: s.nextMilestone.toLocaleString() }),
      });
      const bar = wrap.createDiv({ cls: "sa-progress-bar" });
      const fill = bar.createDiv({ cls: "sa-progress-fill" });
      fill.style.width = `${Math.round(done * 100)}%`;
      wrap.createDiv({
        cls: "sa-progress-remaining",
        text: t("stats.toGo", { n: (s.nextMilestone - s.keystrokesSaved).toLocaleString() }),
      });
    } else {
      root.createEl("p", {
        cls: "sa-stat-sub",
        text: t("ui.msg.HitEveryMilestoneTypingLegend"),
      });
    }

    // Key stats.
    root.createEl("h3", { text: t("ui.msg.KeyStats") });
    const rows = root.createDiv({ cls: "sa-stat-rows" });
    const row = (label: string, value: number) => {
      const r = rows.createDiv({ cls: "sa-stat-row" });
      r.createSpan({ cls: "sa-stat-row-label", text: label });
      r.createSpan({ cls: "sa-stat-row-value", text: value.toLocaleString() });
    };
    row(t("ui.msg.SuggestionsAccepted"), s.accepts);
    row(t("ui.msg.TyposFixed"), s.corrections);
    row(t("ui.msg.CorrectionsUndid"), s.reverts);
    row(t("ui.msg.WordAlternativesUsed"), s.alternativesAccepted);
    row(t("ui.msg.WordsPersonalDictionary"), s.learnedWords);

    // No donation ask - see the note in PredictiveSettings.ts.

  }

  onClose(): void {
    this.contentEl.empty();
    this.onClosed?.();
  }
}
