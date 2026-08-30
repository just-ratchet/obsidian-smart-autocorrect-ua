/**
 * Build predictive-global.bin (PKM2) for the Ukrainian plugin.
 *
 * Uses the PLUGIN'S OWN engine code, so the output is by construction the format
 * PackedLanguageModel.fromBuffer() expects - nothing here re-implements the binary layout.
 *
 * Pipeline:  corpus text -> NgramCounts -> pruneCounts -> InMemoryLanguageModel -> packCounts
 *
 * Run with Node 22+ (TypeScript is stripped at runtime):
 *   node --experimental-strip-types --max-old-space-size=12288 build_ngram.mjs <in.txt> <out.bin> [opts]
 *
 * Options (all optional, shown with defaults):
 *   --lines=4000000     how many corpus lines to COUNT (memory is the real limit)
 *   --stride=1          take every Nth line instead of the first N. The corpus is a
 *                       CONCATENATION of subcorpora (court, fiction, news, social,
 *                       wikipedia) in that order, so reading the head means reading
 *                       court documents only - a model that predicts "підлягає" and
 *                       "суду". Striding samples the whole file evenly. Use
 *                       stride = totalLines / lines (297M/8M ≈ 37).
 *   --minUni=40         drop words seen fewer than this many times
 *   --minNgram=3        drop n-gram entries seen fewer than this many times
 *   --topK=24           continuations stored per context
 *   --chunk=200000      lines per counting batch (progress granularity)
 */
import { createReadStream, writeFileSync, statSync } from "node:fs";
import { createInterface } from "node:readline";

const ENGINE = "./src/predictive/engine";
const { NgramCounts, InMemoryLanguageModel, DEFAULT_BLEND } = await import(`${ENGINE}/ngram/model.ts`);
const { pruneCounts } = await import(`${ENGINE}/ngram/prune.ts`);
const { packCounts } = await import(`${ENGINE}/ngram/packed.ts`);
const { splitSentences } = await import(`${ENGINE}/text/tokenize.ts`);
const { buildAbbreviationSet } = await import(`${ENGINE}/text/abbreviations.ts`);

const [, , inPath, outPath, ...rest] = process.argv;
if (!inPath || !outPath) {
  console.error("usage: build_ngram.mjs <corpus.txt> <out.bin> [--lines=N --minUni=N --minNgram=N --topK=N]");
  process.exit(1);
}
const opt = (name, dflt) => {
  const hit = rest.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split("=")[1]) : dflt;
};
const MAX_LINES = opt("lines", 4_000_000);
const STRIDE = Math.max(1, opt("stride", 1));
const MIN_UNI = opt("minUni", 40);
const MIN_NGRAM = opt("minNgram", 3);
const TOP_K = opt("topK", 24);
const CHUNK = opt("chunk", 200_000);

const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;
const rss = () => mb(process.memoryUsage().rss);
const hhmmss = (ms) => new Date(ms).toISOString().slice(11, 19);

console.log(`corpus : ${inPath} (${mb(statSync(inPath).size)})`);
console.log(`output : ${outPath}`);
console.log(`limits : lines=${MAX_LINES.toLocaleString()} stride=${STRIDE} minUni=${MIN_UNI} minNgram=${MIN_NGRAM} topK=${TOP_K}`);
if (STRIDE > 1) console.log(`sampling: every ${STRIDE}th line, spread across the whole corpus`);
console.log("");

const abbreviations = buildAbbreviationSet();
const counts = new NgramCounts();
const t0 = Date.now();

let lines = 0;
let sentences = 0;
let buf = [];

const flush = () => {
  if (!buf.length) return;
  // splitSentences wants a text block; join the batch and let it find the boundaries.
  for (const sentence of splitSentences(buf.join("\n"), { abbreviations })) {
    if (sentence.length) {
      counts.addSentence(sentence);
      sentences++;
    }
  }
  buf = [];
};

const rl = createInterface({
  input: createReadStream(inPath, { encoding: "utf8", highWaterMark: 1 << 20 }),
  crlfDelay: Infinity,
});

let scanned = 0;
for await (const line of rl) {
  // Stride BEFORE the length test so the sample stays evenly spaced.
  if (scanned++ % STRIDE !== 0) continue;
  if (line.length > 1) buf.push(line);
  if (++lines % CHUNK === 0) {
    flush();
    process.stdout.write(
      `\r  ${lines.toLocaleString()} taken / ${scanned.toLocaleString()} scanned | ` +
        `${sentences.toLocaleString()} sent | vocab ${counts.vocab.length.toLocaleString()} | ` +
        `rss ${rss()} | ${hhmmss(Date.now() - t0)}   `,
    );
  }
  if (lines >= MAX_LINES) break;
}
rl.close();
flush();

console.log(`\n\nread    : ${lines.toLocaleString()} lines taken from ${scanned.toLocaleString()} scanned, ${sentences.toLocaleString()} sentences`);
console.log(`vocab   : ${counts.vocab.length.toLocaleString()} words (raw)`);
console.log(`rss     : ${rss()}\n`);

console.log(`pruning (minUni=${MIN_UNI}, minNgram=${MIN_NGRAM}) …`);
const pruned = pruneCounts(counts, MIN_UNI, MIN_NGRAM);
let bi = 0;
for (const m of pruned.bi.values()) bi += m.size;
let tri = 0;
for (const mid of pruned.tri.values()) for (const m of mid.values()) tri += m.size;
console.log(`  vocab ${pruned.vocab.length.toLocaleString()} | bigrams ${bi.toLocaleString()} | trigrams ${tri.toLocaleString()}\n`);

console.log("packing …");
const model = new InMemoryLanguageModel(pruned, DEFAULT_BLEND);
const packed = packCounts(model, pruned, { topK: TOP_K });
writeFileSync(outPath, Buffer.from(packed));

console.log(`\nwrote ${outPath} — ${mb(packed.byteLength)} in ${hhmmss(Date.now() - t0)}`);

// Read it back through the plugin's own loader: if this fails, the plugin would fail too.
const { PackedLanguageModel } = await import(`${ENGINE}/ngram/packed.ts`);
const check = PackedLanguageModel.fromBuffer(packed);
console.log(`verify: loads OK, ${check.size().vocab.toLocaleString()} vocab`);
for (const ctx of [[], ["не"], ["я", "не"], ["він"], ["вона", "була"], ["дуже"]]) {
  const top = check.predict(ctx, 5).map((s) => s.word).join(", ");
  console.log(`  predict([${ctx.join(" ")}]) -> ${top}`);
}
