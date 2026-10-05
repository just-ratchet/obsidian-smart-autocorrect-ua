/**
 * Is this the "Z" of Ctrl/Cmd-Z? `evt.key` is the character the ACTIVE LAYOUT produces, and on the
 * Ukrainian layout the Z key types "я" - so a test for key === "z" never matched for the very people
 * this plugin is for, and Ctrl-Z silently stopped reverting a correction. The physical key code
 * (KeyZ) is layout-independent; the characters cover layouts that report no code.
 * (Shift is excluded by the caller: Ctrl-Shift-Z is redo.)
 */
export function isUndoKey(evt: { key: string; code?: string }): boolean {
  if (evt.code === "KeyZ") return true;
  const k = evt.key.toLowerCase();
  return k === "z" || k === "я";
}
