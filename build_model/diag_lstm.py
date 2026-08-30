#!/usr/bin/env python3
"""Compare training configs for a few hundred steps each on the cached tokens.

The trained model sat at unigram-level perplexity with LSTM gates still at their
init scale, so the question is which knob actually lets the recurrent path learn.
Same data, same seed, same steps for every arm - only the knob changes.
"""
import sys, time, math, json
import numpy as np, torch, torch.nn.functional as F
sys.path.insert(0, "build_model")
from train_lstm import WordLSTM, N_CASE

CACHE = "X:/uk-corpus-ubertext/lstm_cache"
STEPS, BS, BPTT = 400, 64, 64
dev = "cuda"

ids = np.load(f"{CACHE}/ids.npy", mmap_mode="r")
cases = np.load(f"{CACHE}/case.npy", mmap_mode="r")
vocab = json.loads(open(f"{CACHE}/vocab.json", encoding="utf-8").read())
V = len(vocab)

# One fixed slice, enough for STEPS+1 steps, identical for every arm.
need = BS * BPTT * (STEPS + 2)
ids_s = np.asarray(ids[:need]).astype(np.int64)
cse_s = np.asarray(cases[:need]).astype(np.int64)
n = (len(ids_s) - 1) // BS
X = torch.from_numpy(ids_s[: n * BS]).view(BS, n)
Y = torch.from_numpy(ids_s[1 : n * BS + 1]).view(BS, n)
C = torch.from_numpy(cse_s[1 : n * BS + 1]).view(BS, n)
print(f"vocab {V:,} | slice {len(ids_s):,} tokens | {STEPS} steps/arm\n")


def run(name, lr, clip, wd, use_scaler, amp, case_w, tie_scale=1.0):
    torch.manual_seed(0)
    m = WordLSTM(V, 256, 1024, 2).to(dev)
    opt = torch.optim.AdamW(m.parameters(), lr=lr, weight_decay=wd)
    scaler = torch.amp.GradScaler(dev) if use_scaler else None
    state = None
    t0 = time.time()
    first = last = None
    gate_g = emb_g = 0.0
    for s in range(STEPS):
        i = s * BPTT
        x, y, c = X[:, i:i+BPTT].to(dev), Y[:, i:i+BPTT].to(dev), C[:, i:i+BPTT].to(dev)
        opt.zero_grad(set_to_none=True)
        ctx = torch.amp.autocast(dev, dtype=amp) if amp else torch.enable_grad()
        with ctx:
            h, state = m(x, state)
            lw = F.cross_entropy(m.logits(h).view(-1, V), y.reshape(-1))
            lc = F.cross_entropy(m.case_logits(h, y).view(-1, N_CASE), c.reshape(-1))
            loss = lw + case_w * lc
        state = tuple(t.detach() for t in state)
        if scaler:
            scaler.scale(loss).backward(); scaler.unscale_(opt)
        else:
            loss.backward()
        # gradient mass split, measured BEFORE clipping
        gn = m.lstm.weight_ih_l0.grad.norm().item()
        en = m.emb.weight.grad.norm().item()
        gate_g += gn; emb_g += en
        if clip: torch.nn.utils.clip_grad_norm_(m.parameters(), clip)
        if scaler: scaler.step(opt); scaler.update()
        else: opt.step()
        if s == 20: first = lw.item()
        last = lw.item()
    dg = m.lstm.weight_ih_l0.detach().abs().max().item()
    print(f"{name:34} ppl {math.exp(min(20,first)):8.1f} -> {math.exp(min(20,last)):8.1f} | "
          f"gate|emb grad {gate_g/STEPS:6.2f}|{emb_g/STEPS:7.2f} | ih absmax {dg:.4f} | {time.time()-t0:.0f}s")


print("arm                                 ppl(step20) -> ppl(step400)")
run("A current (lr2e-3 clip1 wd.01 scal)", 2e-3, 1.0, 0.01, True,  torch.bfloat16, 0.3)
run("B no scaler (bf16 needs none)",       2e-3, 1.0, 0.01, False, torch.bfloat16, 0.3)
run("C + lr 1e-3",                         1e-3, 1.0, 0.0,  False, torch.bfloat16, 0.3)
run("D + no clip",                         1e-3, 0,   0.0,  False, torch.bfloat16, 0.3)
run("E + fp32 (no amp)",                   1e-3, 1.0, 0.0,  False, None,           0.3)
run("F + case_w 0 (LM only)",              1e-3, 1.0, 0.0,  False, torch.bfloat16, 0.0)
