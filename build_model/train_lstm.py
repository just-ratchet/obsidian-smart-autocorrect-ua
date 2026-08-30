#!/usr/bin/env python3
"""
Train the Ukrainian word-LSTM and export word_lstm.bin (fmt 4) for the plugin.

The binary layout is dictated by LstmLanguageModel.fromBuffer() in
src/predictive/engine/lstm/model.ts; every shape and order below is taken from that
loader. Getting one of them wrong does not raise - it silently predicts noise - so the
values that matter are called out where they are written.

ARCHITECTURE (forced by the loader)
  - LSTMP: wih is [4*hid, dim] and whh is [4*hid, dim] for EVERY layer, with a
    [dim, hid] projection per layer, so PyTorch's proj_size=dim is the exact match
    and layer>0 consumes the projected dim-wide h.
  - Gate order i, f, g, o - PyTorch's own order (model.ts:923).
  - Tied embedding: the output projection reuses the embedding, so logits = h @ E.T + bOut.
  - dim and hid must both be divisible by 16 or the plugin refuses the SIMD kernel
    and silently falls back to the slow scalar path (model.ts:436).
  - Vocab is LOWERCASE and frequency-sorted (id 0 = <unk>): the runtime only scans the
    top SHORTLIST=16000 rows of the softmax, so a frequency-sorted vocab is what makes
    that shortlist contain the words worth predicting.
  - Case is a separate 4-way head (lower/title/upper/other), mirroring caseLogitsInto():
      logit[c] = ctxW[c]·h + ctxB[c] + wordW[c]·e + bias[w,c] + Σ_r (A[c,r]·h)(B[c,r]·e)
    where e is the DEQUANTISED embedding row, which is why wordW/B are trained against
    the real f32 embedding.

USAGE
  # first epoch (writes a checkpoint every --save-every steps)
  python train_lstm.py --corpus X:/uk-corpus-ubertext/parts --out word_lstm.bin --epochs 1

  # continue later from the checkpoint, no data re-prep
  python train_lstm.py --resume ckpt/lstm.pt --epochs 1

  # export from a checkpoint without training
  python train_lstm.py --resume ckpt/lstm.pt --export-only --out word_lstm.bin
"""
import argparse, os, re, struct, sys, time, json, math, unicodedata
from contextlib import nullcontext
from collections import Counter
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

# --- must mirror LSTM_TOKEN_RE in engine/text/tokenize.ts -----------------------------
UK = "А-Яа-яЇїІіЄєҐґ"
TOKEN_RE = re.compile(rf"[A-Za-z{UK}]+(?:'[A-Za-z{UK}]+)?|[.,!?;:]")
CASE_LOWER, CASE_TITLE, CASE_UPPER, CASE_OTHER = 0, 1, 2, 3
N_CASE = 4
MAGIC = 0x4C53544D
FMT_FACTORED = 4


def case_of(tok: str) -> int:
    """Inverse of applyCase() in model.ts:75. Must agree exactly or the case head
    learns a labelling the runtime cannot reproduce."""
    low = tok.lower()
    if tok == low:
        return CASE_LOWER
    if tok == low.upper() and any(c.isalpha() for c in tok):
        return CASE_UPPER
    if tok == low[:1].upper() + low[1:]:
        return CASE_TITLE
    return CASE_OTHER


def tokenize(line: str):
    return TOKEN_RE.findall(line.replace("\u2019", "'").replace("\u02bc", "'"))


# --- data ----------------------------------------------------------------------------

def iter_lines(paths_spec):
    """paths_spec: list of 'file[:stride]' - same weighting idea as build_ngram.mjs."""
    for spec in paths_spec:
        parts = spec.split(":")
        stride = 1
        if len(parts) > 1 and parts[-1].isdigit():
            stride = max(1, int(parts.pop()))
        path = ":".join(parts)
        name = os.path.basename(path)
        n = 0
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            for i, line in enumerate(f):
                if i % stride:
                    continue
                if len(line) > 1:
                    yield line
                    n += 1
        print(f"    {name}: {n:,} lines", flush=True)


def build_dataset(sources, vocab_size, cache_dir):
    """Two passes: count words, then encode to uint16/uint8 arrays on disk."""
    cache = Path(cache_dir)
    cache.mkdir(parents=True, exist_ok=True)
    ids_p, case_p, vocab_p = cache / "ids.npy", cache / "case.npy", cache / "vocab.json"

    if ids_p.exists() and vocab_p.exists():
        vocab = json.loads(vocab_p.read_text(encoding="utf-8"))
        if len(vocab) == vocab_size:
            print(f"cache hit: {ids_p} ({os.path.getsize(ids_p)/1e6:.0f} MB), vocab {len(vocab):,}")
            return np.load(ids_p, mmap_mode="r"), np.load(case_p, mmap_mode="r"), vocab
        print(f"cache vocab is {len(vocab):,}, want {vocab_size:,} - rebuilding")

    print("pass 1/2: counting words …")
    t0 = time.time()
    freq = Counter()
    for i, line in enumerate(iter_lines(sources)):
        freq.update(t.lower() for t in tokenize(line))
        if i and i % 2_000_000 == 0:
            print(f"  {i:,} lines | {len(freq):,} unique | {time.time()-t0:.0f}s", flush=True)
    # id 0 is <unk>; the rest by descending frequency (the runtime's shortlist depends on it)
    vocab = ["<unk>"] + [w for w, _ in freq.most_common(vocab_size - 1)]
    wid = {w: i for i, w in enumerate(vocab)}
    print(f"  vocab {len(vocab):,} of {len(freq):,} unique ({time.time()-t0:.0f}s)")

    print("pass 2/2: encoding …")
    ids_buf, case_buf = [], []
    for i, line in enumerate(iter_lines(sources)):
        for tok in tokenize(line):
            ids_buf.append(wid.get(tok.lower(), 0))
            case_buf.append(case_of(tok))
        if i and i % 2_000_000 == 0:
            print(f"  {i:,} lines | {len(ids_buf):,} tokens | {time.time()-t0:.0f}s", flush=True)

    ids = np.asarray(ids_buf, dtype=np.uint16 if len(vocab) <= 65535 else np.uint32)
    cases = np.asarray(case_buf, dtype=np.uint8)
    np.save(ids_p, ids); np.save(case_p, cases)
    vocab_p.write_text(json.dumps(vocab, ensure_ascii=False), encoding="utf-8")
    print(f"  {len(ids):,} tokens -> {ids_p} ({ids.nbytes/1e6:.0f} MB)")
    return np.load(ids_p, mmap_mode="r"), np.load(case_p, mmap_mode="r"), vocab


# --- model ---------------------------------------------------------------------------

class WordLSTM(nn.Module):
    def __init__(self, V, dim, hid, layers, case_rank=8):
        super().__init__()
        self.V, self.dim, self.hid, self.layers, self.case_rank = V, dim, hid, layers, case_rank
        self.emb = nn.Embedding(V, dim)
        # proj_size=dim is what makes weight_hh [4*hid, dim] and adds weight_hr [dim, hid],
        # which is exactly the layout fromBuffer() reads back.
        self.lstm = nn.LSTM(dim, hid, layers, batch_first=True, proj_size=dim)
        self.b_out = nn.Parameter(torch.zeros(V))          # tied output bias
        self.case_ctx_w = nn.Parameter(torch.zeros(N_CASE, dim))
        self.case_ctx_b = nn.Parameter(torch.zeros(N_CASE))
        self.case_word_w = nn.Parameter(torch.zeros(N_CASE, dim))
        self.case_bias = nn.Parameter(torch.zeros(V, N_CASE))
        self.case_a = nn.Parameter(torch.randn(N_CASE, case_rank, dim) * 0.02)
        self.case_b = nn.Parameter(torch.randn(N_CASE, case_rank, dim) * 0.02)
        nn.init.uniform_(self.emb.weight, -0.1, 0.1)

    def forward(self, x, state=None):
        e = self.emb(x)
        h, state = self.lstm(e, state)
        return h, state

    def logits(self, h):                                    # tied projection
        return F.linear(h, self.emb.weight, self.b_out)

    def case_logits(self, h, target_ids):
        """Mirrors caseLogitsInto(): context term + word term + per-word bias + bilinear."""
        e = self.emb(target_ids)                            # [.., dim]
        ctx = h @ self.case_ctx_w.T + self.case_ctx_b       # [.., N_CASE]
        wrd = e @ self.case_word_w.T                        # [.., N_CASE]
        ha = torch.einsum("...d,crd->...cr", h, self.case_a)
        eb = torch.einsum("...d,crd->...cr", e, self.case_b)
        bil = (ha * eb).sum(-1)                             # [.., N_CASE]
        return ctx + wrd + self.case_bias[target_ids] + bil


# --- export --------------------------------------------------------------------------

def quantise_rows(w: np.ndarray):
    """int8 per-row with a dequant scale - the scheme fromBuffer() assumes."""
    mx = np.abs(w).max(axis=1)
    mx[mx < 1e-12] = 1e-12
    scale = (mx / 127.0).astype(np.float32)
    q = np.clip(np.rint(w / scale[:, None]), -127, 127).astype(np.int8)
    return q, scale


def export(model: WordLSTM, vocab, path, surface_map=None):
    m = model.eval()
    V, dim, hid, layers = m.V, m.dim, m.hid, m.layers
    npy = lambda t: t.detach().cpu().float().numpy()
    out = bytearray()
    w = out.extend

    w(struct.pack("<IIIII", MAGIC, V, dim, hid, layers))
    w(struct.pack("<B", FMT_FACTORED))
    for word in vocab:
        b = word.encode("utf-8")
        w(struct.pack("<H", len(b))); w(b)

    # Irregular surfaces the case tags cannot rebuild ("iphone" -> "iPhone").
    surface_map = surface_map or {}
    w(struct.pack("<I", len(surface_map)))
    wid = {x: i for i, x in enumerate(vocab)}
    for word, surf in surface_map.items():
        b = surf.encode("utf-8")
        w(struct.pack("<I", wid[word])); w(struct.pack("<H", len(b))); w(b)

    emb = npy(m.emb.weight)                                  # [V, dim]
    q, scale = quantise_rows(emb)
    w(q.tobytes()); w(scale.tobytes())

    for L in range(layers):
        g = m.lstm._parameters
        wih = npy(getattr(m.lstm, f"weight_ih_l{L}"))        # [4*hid, dim]
        whh = npy(getattr(m.lstm, f"weight_hh_l{L}"))        # [4*hid, dim] (proj_size=dim)
        bih = npy(getattr(m.lstm, f"bias_ih_l{L}"))
        bhh = npy(getattr(m.lstm, f"bias_hh_l{L}"))
        whr = npy(getattr(m.lstm, f"weight_hr_l{L}"))        # [dim, hid]
        w(wih.astype(np.float32).tobytes())
        w(whh.astype(np.float32).tobytes())
        w(bih.astype(np.float32).tobytes())
        w(bhh.astype(np.float32).tobytes())
        w(whr.astype(np.float32).tobytes())

    w(npy(m.b_out).astype(np.float32).tobytes())
    w(npy(m.case_ctx_w).astype(np.float32).tobytes())
    w(npy(m.case_ctx_b).astype(np.float32).tobytes())
    w(npy(m.case_word_w).astype(np.float32).tobytes())
    w(npy(m.case_bias).astype(np.float32).tobytes())
    w(struct.pack("<I", m.case_rank))
    w(npy(m.case_a).astype(np.float32).tobytes())
    w(npy(m.case_b).astype(np.float32).tobytes())

    Path(path).write_bytes(bytes(out))
    print(f"exported {path} — {len(out)/1e6:.1f} MB (V={V:,} dim={dim} hid={hid} layers={layers})")
    return len(out)


# --- training ------------------------------------------------------------------------

def batches(ids, cases, bs, bptt, device, start=0):
    """Contiguous streams: reshape into bs parallel rows and walk them in bptt steps,
    carrying the hidden state, which is what lets a 2-layer LSTM see long context."""
    n = (len(ids) - 1) // bs
    ids_t = torch.from_numpy(np.ascontiguousarray(ids[: n * bs]).astype(np.int64)).view(bs, n)
    tgt_t = torch.from_numpy(np.ascontiguousarray(ids[1 : n * bs + 1]).astype(np.int64)).view(bs, n)
    cse_t = torch.from_numpy(np.ascontiguousarray(cases[1 : n * bs + 1]).astype(np.int64)).view(bs, n)
    for i in range(start, n - 1, bptt):
        j = min(i + bptt, n - 1)
        yield (ids_t[:, i:j].to(device, non_blocking=True),
               tgt_t[:, i:j].to(device, non_blocking=True),
               cse_t[:, i:j].to(device, non_blocking=True), i, n)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", nargs="*", default=[],
                    help="files as path[:stride], e.g. parts/fiction.txt parts/news.txt:600")
    ap.add_argument("--cache", default="X:/uk-corpus-ubertext/lstm_cache")
    ap.add_argument("--ckpt", default="X:/uk-corpus-ubertext/ckpt/lstm.pt")
    ap.add_argument("--resume", default=None)
    ap.add_argument("--out", default=None)
    ap.add_argument("--export-only", action="store_true")
    ap.add_argument("--vocab", type=int, default=60000)
    ap.add_argument("--dim", type=int, default=256)       # %16 == 0 (SIMD)
    ap.add_argument("--hid", type=int, default=1024)      # %16 == 0, != dim -> projected
    ap.add_argument("--layers", type=int, default=2)
    ap.add_argument("--bs", type=int, default=64)
    ap.add_argument("--bptt", type=int, default=64)
    ap.add_argument("--lr", type=float, default=1e-3)
    # MEASURED, do not "fix" upward: boosting the gate lr makes it WORSE, not better
    # (800 steps, same slice: mult 1 -> ppl 359, mult 5 -> 795, mult 10 -> 898). The gates
    # get a smaller gradient than the embedding by design; Adam already rescales per
    # parameter, so an extra multiplier just destabilises the recurrence.
    ap.add_argument("--lstm-lr-mult", type=float, default=1.0,
                    help="lr multiplier for the LSTM gates (1.0 measured best)")
    ap.add_argument("--clip", type=float, default=1.0)
    ap.add_argument("--clip-lstm", type=float, default=1.0)
    ap.add_argument("--wd", type=float, default=0.0)
    ap.add_argument("--epochs", type=int, default=1)
    ap.add_argument("--case-weight", type=float, default=0.3)
    ap.add_argument("--save-every", type=int, default=2000)
    ap.add_argument("--max-steps", type=int, default=0, help="0 = whole epoch")
    a = ap.parse_args()

    if a.dim % 16 or a.hid % 16:
        sys.exit(f"dim and hid must be divisible by 16 (SIMD kernel); got {a.dim}, {a.hid}")

    dev = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"device: {dev}" + (f" ({torch.cuda.get_device_name(0)})" if dev == "cuda" else ""))

    ck = torch.load(a.resume, map_location="cpu", weights_only=False) if a.resume else None
    if ck:
        vocab = ck["vocab"]
        cfg = ck["cfg"]
        model = WordLSTM(len(vocab), cfg["dim"], cfg["hid"], cfg["layers"]).to(dev)
        model.load_state_dict(ck["model"])
        print(f"resumed {a.resume}: epoch {ck['epoch']}, step {ck['step']:,}, ppl {ck.get('ppl', 0):.2f}")
    else:
        vocab = None

    if a.export_only:
        if not ck:
            sys.exit("--export-only needs --resume")
        export(model, vocab, a.out or "word_lstm.bin")
        return

    if not a.corpus:
        sys.exit("--corpus is required for training")
    ids, cases, vocab_new = build_dataset(a.corpus, a.vocab, a.cache)
    if vocab is None:
        vocab = vocab_new
        model = WordLSTM(len(vocab), a.dim, a.hid, a.layers).to(dev)
    print(f"model: V={len(vocab):,} dim={model.dim} hid={model.hid} layers={model.layers} "
          f"({sum(p.numel() for p in model.parameters())/1e6:.1f}M params)")

    # Separate groups exist so --lstm-lr-mult can be explored; it is 1.0 by default because
    # anything higher measurably hurt (see the flag).
    lstm_p = list(model.lstm.parameters())
    lstm_ids = {id(p) for p in lstm_p}
    rest_p = [p for p in model.parameters() if id(p) not in lstm_ids]
    opt = torch.optim.AdamW(
        [{"params": rest_p, "lr": a.lr},
         {"params": lstm_p, "lr": a.lr * a.lstm_lr_mult}], weight_decay=a.wd)
    if ck and "opt" in ck:
        try: opt.load_state_dict(ck["opt"])
        except Exception as e: print(f"  (fresh optimiser: {e})")
    # GradScaler is dropped because bfloat16 has fp32's exponent range, so scaling is a
    # no-op - NOT because it caused the divergence (measured: with scaler at lr 2e-3 the
    # 400-step probe reached ppl 462, without it 791; the difference there was the lr).
    # The real fix for "ppl 1077 and rising across epochs" is lr 1e-3 with weight_decay 0;
    # see --lr. Short probes do not expose divergence - the failure appeared at 64k steps.
    Path(a.ckpt).parent.mkdir(parents=True, exist_ok=True)

    step0 = ck["step"] if ck else 0
    ep0 = ck["epoch"] if ck else 0
    best_saved = [ck.get("ppl", float("inf")) if ck else float("inf")]
    for ep in range(ep0, ep0 + a.epochs):
        model.train()
        state = None
        # `run/seen` is the rolling 100-step window; `cum/cum_n` is the whole epoch.
        # Both are shown because they answer different questions: the window says what the
        # model is doing NOW, the epoch mean says whether the run as a whole is improving.
        # A window that drifts UP while the epoch mean stays flat is the early signature of
        # the weights being eaten (see --wd) - invisible if only one of the two is printed.
        t0, run, seen, step = time.time(), 0.0, 0, 0
        cum, cum_n, best = 0.0, 0, float("inf")
        for x, y, cs, i, n in batches(ids, cases, a.bs, a.bptt, dev):
            opt.zero_grad(set_to_none=True)
            amp = torch.amp.autocast(dev, dtype=torch.bfloat16) if dev == "cuda" else nullcontext()
            with amp:
                h, state = model(x, state)
                loss_w = F.cross_entropy(model.logits(h).view(-1, model.V), y.reshape(-1))
                loss_c = F.cross_entropy(model.case_logits(h, y).view(-1, N_CASE), cs.reshape(-1))
                loss = loss_w + a.case_weight * loss_c
            state = tuple(s.detach() for s in state)        # truncated BPTT
            loss.backward()
            # Clip the recurrent path on its own budget. Under one global clip the embedding
            # gradient (measured ~50x the gate gradient) sets the scale factor and the gates
            # get shrunk with it, so they never leave their init scale.
            torch.nn.utils.clip_grad_norm_(model.lstm.parameters(), a.clip_lstm)
            torch.nn.utils.clip_grad_norm_(
                [p for n, p in model.named_parameters() if not n.startswith("lstm.")], a.clip)
            opt.step()

            lw = loss_w.item()
            run += lw; seen += 1; step += 1
            cum += lw; cum_n += 1
            if step % 100 == 0:
                ppl100 = math.exp(min(20, run / seen))
                pplEp = math.exp(min(20, cum / cum_n))
                best = min(best, ppl100)
                done = i / n
                el = time.time() - t0
                eta = el / max(done, 1e-9) - el
                # "!" marks the window drifting well above its own best - the thing to watch for.
                warn = " !" if ppl100 > best * 1.5 else "  "
                print(f"\r  ep{ep} {done*100:5.1f}% | step {step:,} | ppl now {ppl100:8.2f}{warn}"
                      f"| epoch {pplEp:8.2f} | best {best:7.2f} | "
                      f"{el/60:.0f}m elapsed, {eta/60:.0f}m left   ", end="", flush=True)
                run, seen = 0.0, 0
            if step % a.save_every == 0:
                snap = {"model": model.state_dict(), "opt": opt.state_dict(),
                        "vocab": vocab, "epoch": ep, "step": step0 + step,
                        "ppl": math.exp(min(20, cum / max(cum_n, 1))),
                        "cfg": {"dim": model.dim, "hid": model.hid, "layers": model.layers}}
                torch.save(snap, a.ckpt)
                # Keep a separate copy of the best epoch-mean seen. The rolling checkpoint is
                # overwritten unconditionally, so a run that degrades late would otherwise
                # leave nothing but its own worst weights to resume from.
                if snap["ppl"] < best_saved[0]:
                    best_saved[0] = snap["ppl"]
                    torch.save(snap, str(Path(a.ckpt).with_name(Path(a.ckpt).stem + "_best.pt")))
            if a.max_steps and step >= a.max_steps:
                break
        print()
        print(f"  epoch {ep} done: mean ppl {math.exp(min(20, cum / max(cum_n,1))):.2f}, "
              f"best 100-step window {best:.2f}")
        torch.save({"model": model.state_dict(), "opt": opt.state_dict(), "vocab": vocab,
                    "epoch": ep + 1, "step": step0 + step, "ppl": math.exp(min(20, loss_w.item())),
                    "cfg": {"dim": model.dim, "hid": model.hid, "layers": model.layers}}, a.ckpt)
        print(f"  checkpoint -> {a.ckpt}")

    if a.out:
        export(model, vocab, a.out)


if __name__ == "__main__":
    main()
