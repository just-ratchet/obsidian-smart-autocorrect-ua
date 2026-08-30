/**
 * Build predictive-global.bin (PKM2) for the Ukrainian plugin.
 *
 * Uses the PLUGIN'S OWN engine code, so the output is by construction the format
 * PackedLanguageModel.fromBuffer() expects - nothing here re-implements the binary layout.
 *
 * Pipeline:  corpus text -> NgramCounts -> pruneCounts -> InMemoryLanguageModel -> packCounts
 *
 * Run with Node 22+ (TypeScript is stripped at runtime):
 *   node --experimental-strip-types --max-old-space-size=40960 build_ngram.mjs <out.bin> \
 *        --src=<file>[:stride[:maxLines]]  (repeatable)
 *
 * WHY --src IS PER-SUBCORPUS: counting is additive (addSentence just increments), so several
 * sources are read into ONE set of counts in a single pass. That is the only way to weight the
 * genres differently - take ALL of fiction/social (the register you actually write in) while
 * sampling news/wikipedia/court thinly so their bulk cannot drown it out. Reading a single
 * concatenated corpus cannot do this: it either skips fiction lines too, or floods the model
 * with court boilerplate ("підлягає", "суду").
 *
 * NOTE: the PACKED .bin cannot be appended to later - packCounts() quantises to 1 byte and
 * keeps only top-K, which is lossy and one-way. Rebuild from sources to change the mix.
 *
 *   --src=X:/c/fiction.txt          every line of fiction
 *   --src=X:/c/news.txt:20          every 20th line of news
 *   --src=X:/c/news.txt:20:500000   … and stop after 500k lines taken
 *
 * Options (all optional, shown with defaults):
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

const argv = process.argv.slice(2);
const outPath = argv.find((a) => !a.startsWith("--"));
const opt = (name, dflt) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split("=")[1]) : dflt;
};
// --src=path[:stride[:maxLines]] - a Windows drive letter ("X:/...") also contains ':',
// so split from the RIGHT and only treat trailing numeric fields as stride/maxLines.
const sources = argv
  .filter((a) => a.startsWith("--src="))
  .map((a) => {
    const parts = a.slice(6).split(":");
    let maxLines = Infinity;
    let stride = 1;
    if (parts.length > 1 && /^\d+$/.test(parts[parts.length - 1])) {
      const last = Number(parts.pop());
      if (parts.length > 1 && /^\d+$/.test(parts[parts.length - 1])) {
        stride = Number(parts.pop());
        maxLines = last;
      } else {
        stride = last;
      }
    }
    return { path: parts.join(":"), stride: Math.max(1, stride), maxLines };
  });
if (!outPath || sources.length === 0) {
  console.error("usage: build_ngram.mjs <out.bin> --src=<file>[:stride[:maxLines]] ... [--minUni=N --minNgram=N --topK=N]");
  process.exit(1);
}
const MIN_UNI = opt("minUni", 40);
const MIN_NGRAM = opt("minNgram", 3);
const TOP_K = opt("topK", 24);
const CHUNK = opt("chunk", 200_000);

const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;
const rss = () => mb(process.memoryUsage().rss);
const hhmmss = (ms) => new Date(ms).toISOString().slice(11, 19);

console.log(`output : ${outPath}`);
console.log(`limits : minUni=${MIN_UNI} minNgram=${MIN_NGRAM} topK=${TOP_K}`);
console.log("sources:");
for (const s of sources) {
  const size = mb(statSync(s.path).size);
  const how = s.stride === 1 ? "every line" : `every ${s.stride}th line`;
  const cap = s.maxLines === Infinity ? "" : `, max ${s.maxLines.toLocaleString()}`;
  console.log(`  ${s.path}  (${size})  ${how}${cap}`);
}
console.log("");

const abbreviations = buildAbbreviationSet();
const counts = new NgramCounts();
const t0 = Date.now();

let lines = 0;
let sentences = 0;
let scanned = 0;
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

for (const src of sources) {
  const name = src.path.split(/[\\/]/).pop();
  let taken = 0;
  let seen = 0;
  const rl = createInterface({
    input: createReadStream(src.path, { encoding: "utf8", highWaterMark: 1 << 20 }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    // Stride BEFORE the length test so the sample stays evenly spaced.
    if (seen++ % src.stride !== 0) continue;
    scanned++;
    if (line.length > 1) buf.push(line);
    taken++;
    lines++;
    if (lines % CHUNK === 0) {
      flush();
      process.stdout.write(
        `\r  ${name}: ${taken.toLocaleString()} taken | total ${lines.toLocaleString()} | ` +
          `${sentences.toLocaleString()} sent | vocab ${counts.vocab.length.toLocaleString()} | ` +
          `rss ${rss()} | ${hhmmss(Date.now() - t0)}   `,
      );
    }
    if (taken >= src.maxLines) break;
  }
  rl.close();
  flush();
  console.log(`\r  ${name}: ${taken.toLocaleString()} lines taken (of ${seen.toLocaleString()} scanned) | vocab ${counts.vocab.length.toLocaleString()} | rss ${rss()}${" ".repeat(20)}`);
}

console.log(`\nread    : ${lines.toLocaleString()} lines, ${sentences.toLocaleString()} sentences`);
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
