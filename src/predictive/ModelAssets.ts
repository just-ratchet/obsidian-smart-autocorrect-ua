/**
 * First-run download of the language-model assets.
 *
 * Obsidian's community installer only ever fetches main.js, manifest.json and
 * styles.css, so the model files cannot ride along with the plugin. They are
 * published as attachments on the GitHub release for this exact version and
 * fetched once, into the plugin's own folder, after the user agrees.
 *
 * Rules this follows, because it is the only network access the plugin makes:
 *   - Nothing is downloaded until the user explicitly agrees. Decline is durable.
 *   - It is a plain GET of a public release asset. NOTHING is uploaded, and no
 *     identifier, telemetry or vault content is attached to the request.
 *   - Every file is size- and SHA-256-checked before it is written, so a truncated
 *     or substituted download cannot become a model the engine will load.
 *   - It never blocks startup: the plugin runs (degraded) with any subset present.
 */
import { App, Modal, Notice, Plugin, requestUrl, Setting } from "obsidian";
import { t } from "./i18n";

/** One downloadable asset, pinned by size and digest. */
export interface AssetSpec {
  file: string;
  bytes: number;
  sha256: string;
  /** What the user loses if this one is missing - shown in the consent dialog.
   *  A key, not a string: MODEL_ASSETS is a module-level constant, so resolving it
   *  eagerly would freeze the language at import time, before the UI locale is read. */
  purposeKey:
    | "assets.purpose.lstm"
    | "assets.purpose.ngram"
    | "assets.purpose.wordlist";
}

/**
 * `RELEASE_TAG` names the release that CARRIES the model files, which is not the same as
 * the current plugin version: the models are large and change rarely, so they are published
 * once and every plugin release that can read them points at that same tag. Bump it only
 * when a new model is published (the .bin format is versioned - see engine/src/lstm/model.ts),
 * which keeps the pin doing its real job: an older plugin can never pull a newer,
 * incompatible model. It also keeps ordinary plugin releases to the three files Obsidian
 * actually installs.
 *
 * MUST point at THIS fork's releases: upstream's assets are the ENGLISH models, so leaving
 * the original URL here would hand Ukrainian users an English model that cannot complete a
 * single word they type. Update OWNER below to the account hosting the release.
 */
export const RELEASE_TAG = "models-uk-2";
const OWNER = "just-ratchet";
const REPO = "obsidian-smart-autocorrect-ua";
export const ASSET_BASE = `https://github.com/${OWNER}/${REPO}/releases/download/${RELEASE_TAG}`;

export const MODEL_ASSETS: AssetSpec[] = [
  {
    file: "word_lstm.bin",
    bytes: 36842260,
    sha256: "72219e83ead418463082fb63efcc637d12a4962d447090c6e04478278657312c",
    purposeKey: "assets.purpose.lstm",
  },
  {
    file: "predictive-global.bin",
    bytes: 76221692,
    sha256: "1fe1aa4d306030cbbb807ba154bafbbaf397b059a7f9f1c376cc73de9d2d3204",
    purposeKey: "assets.purpose.ngram",
  },
  {
    file: "wordlist.bin",
    bytes: 26988898,
    sha256: "6cd9eeb496cd678ee0055d5e2f8d27865ba4907391f51cd343b4546638a42639",
    purposeKey: "assets.purpose.wordlist",
  },
];

const MB = 1024 * 1024;
export const totalMegabytes = (assets: AssetSpec[]): number =>
  Math.round(assets.reduce((n, a) => n + a.bytes, 0) / MB);

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Which of `MODEL_ASSETS` are not yet in the plugin folder. */
export async function missingAssets(plugin: Plugin): Promise<AssetSpec[]> {
  const dir = plugin.manifest.dir ?? ".";
  const adapter = plugin.app.vault.adapter;
  const out: AssetSpec[] = [];
  for (const a of MODEL_ASSETS) {
    if (!(await adapter.exists(`${dir}/${a.file}`))) out.push(a);
  }
  return out;
}

/**
 * Fetch `assets` into the plugin folder. Returns the ones that landed.
 *
 * A file is written only after its digest matches, so a failed verification
 * leaves the previous state untouched rather than a half-model on disk.
 */
export async function downloadAssets(
  plugin: Plugin,
  assets: AssetSpec[],
  onProgress?: (msg: string) => void,
): Promise<AssetSpec[]> {
  const dir = plugin.manifest.dir ?? ".";
  const adapter = plugin.app.vault.adapter;
  const done: AssetSpec[] = [];
  for (let i = 0; i < assets.length; i++) {
    const a = assets[i];
    const label = `${a.file} (${Math.round(a.bytes / MB)} MB, ${i + 1}/${assets.length})`;
    onProgress?.(t("assets.downloading", { label }));
    try {
      const res = await requestUrl({
        url: `${ASSET_BASE}/${a.file}`,
        method: "GET",
      });
      const buf = res.arrayBuffer;
      if (buf.byteLength !== a.bytes) {
        throw new Error(`expected ${a.bytes} bytes, got ${buf.byteLength}`);
      }
      // Skip the digest check only when the release was published without one.
      if (!a.sha256.startsWith("__")) {
        const got = await sha256Hex(buf);
        if (got !== a.sha256)
          throw new Error(`checksum mismatch (${got.slice(0, 12)}…)`);
      }
      await adapter.writeBinary(`${dir}/${a.file}`, buf);
      done.push(a);
    } catch (e) {
      console.error(`[smart-autocorrect] could not download ${a.file}`, e);
      onProgress?.(
        t("assets.failed", { file: a.file, message: (e as Error).message }),
      );
      return done;
    }
  }
  return done;
}

/**
 * Ask before downloading. Resolves true if the user agreed.
 *
 * The dialog states the exact size, the exact source, and that nothing is sent -
 * a user who installed an offline plugin deserves to be told plainly the one time
 * it wants the network.
 */
export class AssetConsentModal extends Modal {
  private assets: AssetSpec[];
  private resolve: (ok: boolean) => void;
  private answered = false;

  constructor(app: App, assets: AssetSpec[], resolve: (ok: boolean) => void) {
    super(app);
    this.assets = assets;
    this.resolve = resolve;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: t("assets.title") });
    contentEl.createEl("p", {
      text: t("assets.body", { size: totalMegabytes(this.assets) }),
    });
    const list = contentEl.createEl("ul");
    for (const a of this.assets) {
      list.createEl("li", { text: `${a.file} - ${t(a.purposeKey)}` });
    }
    contentEl.createEl("p", { text: t("assets.skip") });
    new Setting(contentEl)
      .addButton((b) =>
        b.setButtonText(t("assets.notNow")).onClick(() => this.finish(false)),
      )
      .addButton((b) =>
        b
          .setButtonText(
            t("assets.download", { size: totalMegabytes(this.assets) }),
          )
          .setCta()
          .onClick(() => this.finish(true)),
      );
  }

  private finish(ok: boolean): void {
    this.answered = true;
    this.resolve(ok);
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
    // Dismissing the dialog is a "no", not an unanswered question.
    if (!this.answered) this.resolve(false);
  }
}

export function askForAssets(app: App, assets: AssetSpec[]): Promise<boolean> {
  return new Promise((resolve) =>
    new AssetConsentModal(app, assets, resolve).open(),
  );
}

/**
 * Full first-run flow: work out what is missing, ask, fetch, report.
 * Returns true if anything new was written (so the caller can reload the models).
 */
export async function ensureAssets(
  plugin: Plugin,
  force = false,
): Promise<boolean> {
  const missing = await missingAssets(plugin);
  if (missing.length === 0) {
    if (force) new Notice(t("assets.alreadyInstalled"));
    return false;
  }
  if (!(await askForAssets(plugin.app, missing))) return false;

  const notice = new Notice(t("assets.starting"), 0);
  const got = await downloadAssets(plugin, missing, (m) =>
    notice.setMessage(m),
  );
  notice.hide();
  if (got.length === missing.length) {
    new Notice(t("assets.installed"), 6000);
    return true;
  }
  new Notice(
    t("assets.partial", { got: got.length, total: missing.length }),
    9000,
  );
  return got.length > 0;
}
