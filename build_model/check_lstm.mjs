// Load a word_lstm.bin through the PLUGIN'S OWN loader.
// fromBuffer() throws on a trailing-byte mismatch, so this catches a layout error
// that training alone would happily hide.
import { readFileSync } from "node:fs";
const { LstmLanguageModel } = await import("../src/predictive/engine/lstm/model.ts");

const path = process.argv[2];
const buf = readFileSync(path);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

const m = LstmLanguageModel.fromBuffer(ab, false); // scalar path: no wasm needed here
console.log(`loaded OK: vocab ${m.vocab.length.toLocaleString()}, dim ${m.embeddingDim}`);

const probes = process.argv.slice(3);
for (const p of probes) {
  const ctx = p.split(/\s+/).filter(Boolean);
  const alts = m.suggestAlternatives(ctx[ctx.length - 1] ?? "", ctx.slice(0, -1), 5);
  console.log(`  alternatives(${p}) -> ${alts.join(", ") || "(none)"}`);
}
const cased = m.caseVariants("київ", []);
console.log(`  caseVariants("київ") -> ${cased.join(" | ")}`);
console.log("SMOKE OK");
