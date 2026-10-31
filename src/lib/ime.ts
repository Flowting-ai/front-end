import type { KeyboardEvent as ReactKeyboardEvent } from "react";

/**
 * True while a key press belongs to an IME (Japanese, Chinese, Korean…): the Enter that confirms a
 * conversion must not send. Safari fires that keydown with `isComposing` false but keyCode 229, so
 * both are checked.
 */
export function isImeKey(e: ReactKeyboardEvent | KeyboardEvent): boolean {
  const native = "nativeEvent" in e ? e.nativeEvent : e;
  return native.isComposing || native.keyCode === 229;
}
