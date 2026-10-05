/**
 * Pictures for the getting-started tour, inlined as data URIs.
 *
 * They have to be inlined: Obsidian's community installer only ever fetches main.js,
 * manifest.json and styles.css, so a plugin cannot ship loose image files (the same reason the
 * language model is downloaded separately, and the same approach bmcQr.ts already uses).
 *
 * The three steps about typing are short ANIMATED clips, because what they are teaching is a
 * change - a word being accepted, a typo being fixed, an undo putting it back - and a still
 * frame cannot show a change. The stats step is a still, because nothing moves in it.
 *
 * Clips are animated WebP, not GIF. Obsidian is Electron, so it plays them natively, and at
 * matched quality WebP measured about a quarter the size of the equivalent GIF (a 4s 560px
 * clip: 14.7 KB WebP vs 48.3 KB GIF), which matters when every user carries these inside
 * main.js. Encode at 560px wide, 10fps, quality 75; anything more is invisible in a 220px band.
 *
 * The tour renders a step without its picture if the entry here is undefined, so an empty slot
 * degrades to text rather than breaking.
 */
/*
 * The stats step used to be a cropped screenshot of the ENGLISH dashboard, which a Ukrainian
 * user would read as an untranslated screen. It is now drawn live from the same markup and
 * message catalogue as the real dashboard (see renderStatsDemo in TutorialModal.ts), so it is
 * always in the user's language and always matches the real thing.
 */
export const TUTORIAL_IMAGES: Record<
  "suggest" | "autocorrect" | "undo" | "links" | "stats",
  string | undefined
> = {
  suggest: undefined,
  autocorrect: undefined,
  undo: undefined,
  links: undefined,
  stats: undefined,
};
