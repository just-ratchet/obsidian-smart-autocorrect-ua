/**
 * Guards the settings pane description that BOTH render paths are built from.
 *
 * Obsidian 1.13 renders the pane from getSettingDefinitions() and never calls display(); older
 * versions only call display(). Since the pane is described once and rendered two ways, the
 * thing worth testing is the description: that every row still has a name and a control, that
 * the two paths agree, and that a control still reads and writes the settings object.
 *
 * `obsidian` is a types-only package with no runtime, so the module under test is bundled with
 * esbuild against a stub that records what each row does.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** A stand-in for `Setting` that records the calls a row makes onto it. */
const STUB = `
export class Modal { constructor(app) { this.app = app; } }
export class Setting {
  constructor(el) { this.el = el; this.name = ""; this.desc = ""; this.controls = []; this.settingEl = el; if (el && el.__rows) el.__rows.push(this); }
  setName(v) { this.name = v; return this; }
  setDesc(v) { this.desc = v; return this; }
  setHeading() { this.heading = true; return this; }
  setClass() { return this; }
  setHeading2() { return this; }
  add(kind, cb) { const c = component(kind, this); this.controls.push(c); cb(c); return this; }
  addToggle(cb) { return this.add("toggle", cb); }
  addSlider(cb) { return this.add("slider", cb); }
  addText(cb) { return this.add("text", cb); }
  addTextArea(cb) { return this.add("textarea", cb); }
  addDropdown(cb) { return this.add("dropdown", cb); }
  addButton(cb) { return this.add("button", cb); }
  addExtraButton(cb) { return this.add("extra", cb); }
}
function component(kind) {
  const c = { kind, value: undefined, handler: undefined };
  c.setValue = (v) => { c.value = v; return c; };
  c.getValue = () => c.value;
  c.onChange = (h) => { c.handler = h; return c; };
  c.onClick = (h) => { c.handler = h; return c; };
  c.setLimits = () => c; c.setDynamicTooltip = () => c; c.setPlaceholder = (v) => { c.placeholder = v; return c; };
  c.addOptions = (o) => { c.options = { ...(c.options || {}), ...o }; return c; };
  c.addOption = (k, v) => { c.options = { ...(c.options || {}), [k]: v }; return c; };
  c.buttonEl = { addClass() {} };
  c.setButtonText = (t) => { c.text = t; return c; };
  c.setCta = () => c; c.setWarning = () => c; c.setDisabled = () => c; c.setTooltip = () => c;
  return c;
}
`;

const ENTRY = `
export { buildPredictiveSettingGroups, DEFAULT_PREDICTIVE_SETTINGS, mergeSettings } from "../src/predictive/PredictiveSettings.ts";
export { toSettingDefinitions, renderPaneGroups } from "../src/predictive/settingsPane.ts";
export { TUTORIAL_STEPS } from "../src/predictive/TutorialModal.ts";
export { t } from "../src/predictive/i18n.ts";
export { TUTORIAL_IMAGES } from "../src/predictive/tutorialImages.ts";
export { Setting } from "obsidian";
`;

async function loadPane() {
  const dir = mkdtempSync(join(tmpdir(), "sa-settings-"));
  const stub = join(dir, "obsidian-stub.mjs");
  writeFileSync(stub, STUB);
  const out = join(dir, "pane.mjs");
  await build({
    stdin: { contents: ENTRY, resolveDir: import.meta.dirname, loader: "ts" },
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: out,
    logLevel: "silent",
    plugins: [
      {
        name: "obsidian-stub",
        setup(b) {
          b.onResolve({ filter: /^obsidian$/ }, () => ({ path: stub }));
        },
      },
    ],
  });
  return (await import(pathToFileURL(out).href)) as {
    buildPredictiveSettingGroups: (...a: unknown[]) => PaneGroup[];
    DEFAULT_PREDICTIVE_SETTINGS: Record<string, unknown>;
    mergeSettings: (saved?: Record<string, unknown>) => Record<string, unknown>;
    toSettingDefinitions: (g: PaneGroup[]) => Definition[];
    Setting: new (el: unknown) => StubSetting;
    TUTORIAL_STEPS: { title: string; body: string; image?: string }[];
    TUTORIAL_IMAGES: Record<string, string | undefined>;
  };
}

interface PaneGroup {
  heading?: string;
  items: { kind: string; row?: { name: string; desc: string; apply: (s: unknown, w: boolean) => void } }[];
}
interface Definition {
  type: string;
  heading?: string;
  items: { name: string; desc?: string; render: (s: unknown) => void }[];
}

test("every settings row has a name, and names are unique", async () => {
  const pane = await loadPane();
  const settings = { ...pane.DEFAULT_PREDICTIVE_SETTINGS };
  const groups = pane.buildPredictiveSettingGroups(settings, () => {});
  const names = groups.flatMap((g) => g.items.filter((i) => i.kind === "row").map((i) => i.row!.name));

  assert.ok(names.length >= 30, `expected the full pane, got ${names.length} rows`);
  for (const n of names) assert.notEqual(n.trim(), "", "a row was left without a name");
  assert.equal(new Set(names).size, names.length, "two rows share a name, so search cannot tell them apart");
});

test("the declarative definitions carry the same rows as the pane groups", async () => {
  const pane = await loadPane();
  const settings = { ...pane.DEFAULT_PREDICTIVE_SETTINGS };
  const groups = pane.buildPredictiveSettingGroups(settings, () => {});
  const defs = pane.toSettingDefinitions(groups);

  const groupNames = groups.flatMap((g) => g.items.filter((i) => i.kind === "row").map((i) => i.row!.name));
  // Rows live in top-level groups AND inside "advanced" sections, which are emitted as
  // navigable sub-pages (type: "page") rather than inline groups. Both carry `items`.
  const defNames = defs.flatMap((d) => d.items.map((i) => i.name)).filter((n) => n !== "");
  for (const n of groupNames) assert.ok(defNames.includes(n), `"${n}" is missing from the definitions`);
  assert.ok(
    defs.every((d) => d.type === "group" || d.type === "page"),
    "every top-level definition should be a group or a collapsible page",
  );
  // At least one advanced section must have collapsed into a page (that's the decluttering).
  assert.ok(defs.some((d) => d.type === "page"), "expected some sections to collapse into pages");
});

test("a row's control still reads and writes the settings object", async () => {
  const pane = await loadPane();
  const { Setting } = pane;
  const settings = { ...pane.DEFAULT_PREDICTIVE_SETTINGS, enablePredictions: true } as Record<string, unknown>;
  let saved = 0;
  const groups = pane.buildPredictiveSettingGroups(settings, () => {
    saved++;
  });

  const row = groups
    .flatMap((g) => g.items)
    .find((i) => i.kind === "row" && i.row!.name.startsWith("Передбачення тексту"))?.row;
  assert.ok(row, "the predictive-text row disappeared from the pane");

  const s = new Setting(null);
  row.apply(s, true);
  assert.equal(s.name.startsWith("Передбачення тексту"), true);
  assert.equal(s.controls.length, 1, "the row lost its control");
  assert.equal(s.controls[0].value, true, "the toggle did not read the current setting");

  s.controls[0].handler!(false);
  assert.equal(settings.enablePredictions, false, "the toggle did not write the setting back");
  assert.equal(saved, 1, "changing a setting no longer persists it");
});

interface StubSetting {
  name: string;
  desc: string;
  controls: { value: unknown; handler?: (v: unknown) => void; text?: string; placeholder?: string; options?: Record<string, string> }[];
}

test("the getting-started tour stays short and every picture slot exists", async () => {
  const pane = await loadPane();
  const steps = pane.TUTORIAL_STEPS;

  // Four steps is the design: a tour people click through without reading teaches nothing.
  assert.ok(steps.length >= 3 && steps.length <= 5, `${steps.length} steps is too many to read`);
  for (const s of steps) {
    // Steps hold message KEYS (so the language is resolved at render time, not import time).
    const title = pane.t(s.titleKey);
    const body = pane.t(s.bodyKey);
    assert.notEqual(title.trim(), "", "a tour step lost its title");
    assert.notEqual(title, s.titleKey, "a tour step title has no message");
    assert.ok(body.length <= 200, `"${title}" runs to ${body.length} chars; keep it to a sentence`);
    if (s.image)
      assert.ok(s.image in pane.TUTORIAL_IMAGES, `"${title}" points at a picture slot that does not exist`);
  }
});

/** Run `fn` as if Obsidian were set to Ukrainian (the plugin reads localStorage["language"]). */
async function withUkrainianUi<T>(fn: () => Promise<T>): Promise<T> {
  const g = globalThis as unknown as { window?: unknown };
  const before = g.window;
  g.window = { localStorage: { getItem: (k: string) => (k === "language" ? "uk" : null) } };
  try {
    return await fn();
  } finally {
    g.window = before;
  }
}

const CYRILLIC = /[А-Яа-яІіЇїЄєҐґ]/;
/** Strings that are legitimately not words: key names, file names, glob/path examples. */
const NOT_PROSE = new Set(["Tab", "Enter", "End", "Templates\nJournal/*", "predictive-personalization.json"]);

test("with Obsidian in Ukrainian, every visible settings string is Ukrainian", async () => {
  await withUkrainianUi(async () => {
    const pane = await loadPane();
    const { Setting } = pane;
    const settings = { ...pane.DEFAULT_PREDICTIVE_SETTINGS } as Record<string, unknown>;
    // The pane needs the personalization/acceleration hooks to render its full set of rows.
    const personalization = {
      getStats: () => ({ charsSaved: 1234, minutesSaved: 7, streak: 3, bestStreak: 5, accepts: 1, corrections: 2, reverts: 3, learnListSize: 4 }),
      onOpenTutorial() {}, onResetSettings() {}, onFactoryReset() {}, onOpenStats() {}, onResetStats() {},
      onOpenDictionary() {}, onExport() {}, onImport() {}, onReset() {},
    };
    const accel = { reload: async () => {}, status: async () => ({ lstmLoaded: true, accelerated: true }), missingAssets: async () => 2, installAssets: async () => true };
    const groups = pane.buildPredictiveSettingGroups(settings, () => {}, personalization, () => {}, accel, { missing: 2 });

    const seen: string[] = [];
    for (const g of groups) {
      if (g.heading) seen.push(g.heading);
      for (const item of g.items as unknown as { kind: string; text?: string; row?: { name: string; desc: string; apply: (s: unknown, w: boolean) => void } }[]) {
        if (item.kind === "note" && item.text) seen.push(item.text);
        if (item.kind !== "row" || !item.row) continue;
        const st = new Setting(null);
        item.row.apply(st, true);
        seen.push(st.name);
        if (st.desc) seen.push(st.desc);
        for (const c of st.controls) {
          if (c.text) seen.push(c.text);
          if (c.placeholder) seen.push(c.placeholder);
          for (const label of Object.values(c.options ?? {})) seen.push(label);
        }
      }
    }
    assert.ok(seen.length > 100, `expected the whole pane, only saw ${seen.length} strings`);
    const english = seen.filter((x) => x.trim() && !NOT_PROSE.has(x) && !CYRILLIC.test(x));
    assert.deepEqual(english, [], "these settings strings are still English in a Ukrainian UI");
  });
});

test("settings saved by an earlier version survive the upgrade", async () => {
  const pane = await loadPane();
  const defaults = pane.DEFAULT_PREDICTIVE_SETTINGS;
  const flip = (k: string) => (typeof defaults[k] === "boolean" ? !defaults[k] : defaults[k]);
  // A user who changed two options, plus a key from an option this version no longer has.
  const saved = { enablePredictions: flip("enablePredictions"), filterProfanity: flip("filterProfanity"), removedEnglishOption: "x" };
  const merged = pane.mergeSettings(saved);
  assert.equal(merged.enablePredictions, saved.enablePredictions, "a changed value is kept");
  assert.equal(merged.filterProfanity, saved.filterProfanity, "a changed value is kept");
  assert.equal(merged.pluginEnabled, defaults.pluginEnabled, "an untouched option takes its default");
  assert.deepEqual(Object.keys(defaults).filter((k) => !(k in merged)), [], "no default key is lost");
  // First run, or an empty/missing data.json: exactly the defaults.
  assert.deepEqual(pane.mergeSettings(undefined), defaults);
  assert.deepEqual(pane.mergeSettings({}), defaults);
});
