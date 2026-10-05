import { test } from "node:test";
import assert from "node:assert/strict";
import { isProfane } from "../src/predictive/engine/text/profanity.ts";

test("the English word list is gone: English words are never blocked", () => {
  for (const w of ["fuck", "shit", "cunt", "whore", "cum", "cock", "porn"]) assert.equal(isProfane(w), false, w);
});

test("blocks Ukrainian obscenities, case-insensitively", () => {
  for (const w of ["хуйня", "Пизда", "СУКА", "блядь", "мудак"]) assert.equal(isProfane(w), true, w);
});

test("does NOT block innocent look-alikes (Scunthorpe-safe)", () => {
  for (const w of ["хутір", "хуртовина", "курвіметр", "підорожник", "срібло", "привіт", "клас", "аналіз"])
    assert.equal(isProfane(w), false, w);
});

test("personal-dictionary allow-set un-blocks a word and does not leak to others", () => {
  const allow = new Set(["сука"]);
  assert.equal(isProfane("сука"), true);
  assert.equal(isProfane("сука", allow), false);
  assert.equal(isProfane("мудак", allow), true);
});
