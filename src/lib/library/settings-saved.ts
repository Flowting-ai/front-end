import type { AutoSave, OrgSettingsPatch, PrefsPatch } from "./schemas";

const AUTO_SAVE_WORDS: Record<AutoSave, string> = { always: "Always", ask: "Ask each time", never: "Never" };
const onOff = (value: boolean) => (value ? "on" : "off");

/** The toast after a Library setting saves: it names what changed and its new value, never more. */
export function prefsSavedMessage(patch: PrefsPatch): string {
  if (patch.autoSave !== undefined) return patch.autoSave === null ? "Save files from chats: using the workspace default" : `Save files from chats: ${AUTO_SAVE_WORDS[patch.autoSave]}`;
  if (patch.aiReferenceEnabled !== undefined) return `Search my Library in chats is ${onOff(patch.aiReferenceEnabled)}`;
  return "Setting saved";
}

export function orgSettingsSavedMessage(patch: OrgSettingsPatch): string {
  if (patch.defaultAutoSave !== undefined) return `Auto-save default: ${AUTO_SAVE_WORDS[patch.defaultAutoSave]}`;
  if (patch.forceAutoSaveOff !== undefined) return `Force auto-save off is ${onOff(patch.forceAutoSaveOff)}`;
  if (patch.aiReferenceEnabled !== undefined) return `AI reference is ${onOff(patch.aiReferenceEnabled)}`;
  if (patch.maxFileBytes !== undefined) return `File size limit: ${Math.round(patch.maxFileBytes / (1024 * 1024))} MB`;
  if (patch.allowedFormats !== undefined) return "File types updated";
  return "Setting saved";
}
