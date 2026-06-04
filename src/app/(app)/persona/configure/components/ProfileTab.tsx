"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import NextImage from "next/image";
import { Switch } from "@/components/Switch";
import { ChevronDown, X, Plus } from "lucide-react";
import { LANGUAGES, DEFAULT_LANGUAGE } from "@/app/(app)/personas/new/constants";

async function compressImage(file: File, maxW: number, maxH: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > maxW) { height = (height * maxW) / width; width = maxW; }
        if (height > maxH) { width = (width * maxH) / height; height = maxH; }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const PROFILE_TAG_PALETTE = [
  { bg: 'var(--color-tag-Blue-bg)',       text: 'var(--color-tag-Blue-text)',    shadow: 'var(--color-tag-Blue-shadow)',    innerShadow: 'var(--color-tag-Blue-inner-shadow)' },
  { bg: 'var(--color-tag-Purple-bg)',     text: 'var(--color-tag-Purple-text)',  shadow: 'var(--color-tag-Purple-shadow)',  innerShadow: 'var(--color-tag-Purple-inner-shadow)' },
  { bg: 'var(--color-tag-Green-bg-soft)', text: 'var(--color-tag-Green-text)',   shadow: 'var(--color-tag-Green-shadow)',   innerShadow: 'var(--color-tag-Green-inner-shadow)' },
  { bg: 'var(--color-tag-Yellow-bg)',     text: 'var(--color-tag-Yellow-text)',  shadow: 'var(--color-tag-Yellow-shadow)',  innerShadow: 'var(--color-tag-Yellow-inner-shadow)' },
  { bg: 'var(--color-tag-Brown-bg)',      text: 'var(--color-tag-Brown-text)',   shadow: 'var(--color-tag-Brown-shadow)',   innerShadow: 'var(--color-tag-Brown-inner-shadow)' },
  { bg: 'var(--color-tag-Red-bg)',        text: 'var(--color-tag-Red-text)',     shadow: 'var(--color-tag-Red-shadow)',     innerShadow: 'var(--color-tag-Red-inner-shadow)' },
  { bg: 'var(--color-tag-Neutral-bg)',    text: 'var(--color-tag-Neutral-text)', shadow: 'var(--color-tag-Neutral-shadow)', innerShadow: 'var(--color-tag-Neutral-inner-shadow)' },
] as const

function getTagColor(index: number) {
  return PROFILE_TAG_PALETTE[index % PROFILE_TAG_PALETTE.length]
}

type ProfileTabProps = {
  avatarUrl: string | null;
  onAvatarChange: (url: string | null) => void;
  personaName: string;
  onPersonaNameChange: (name: string) => void;
  personaHandle: string;
  onPersonaHandleChange: (handle: string) => void;
  personaDescription: string;
  onPersonaDescriptionChange: (desc: string) => void;
  personaTags: string[];
  onPersonaTagsChange: (tags: string[]) => void;
  isMultilingual: boolean;
  onIsMultilingualChange: (v: boolean) => void;
  selectedLanguages: Set<string>;
  onSelectedLanguagesChange: (langs: Set<string>) => void;
};

export default function ProfileTab({
  avatarUrl,
  onAvatarChange,
  personaName,
  onPersonaNameChange,
  personaHandle,
  onPersonaHandleChange,
  personaDescription,
  onPersonaDescriptionChange,
  personaTags,
  onPersonaTagsChange,
  isMultilingual,
  onIsMultilingualChange,
  selectedLanguages,
  onSelectedLanguagesChange,
}: ProfileTabProps) {
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const langDropdownRef = useRef<HTMLDivElement>(null);
  const langTriggerRef = useRef<HTMLDivElement>(null);
  const [newTagInput, setNewTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  const DESCRIPTION_MAX = 120;

  useEffect(() => {
    if (!isMultilingual) {
      onSelectedLanguagesChange(new Set([DEFAULT_LANGUAGE]));
      setIsLangDropdownOpen(false);
    }
  }, [isMultilingual]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        langDropdownRef.current &&
        !langDropdownRef.current.contains(e.target as Node) &&
        langTriggerRef.current &&
        !langTriggerRef.current.contains(e.target as Node)
      ) {
        setIsLangDropdownOpen(false);
      }
    };
    if (isLangDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isLangDropdownOpen]);

  useEffect(() => {
    if (showTagInput) tagInputRef.current?.focus();
  }, [showTagInput]);

  const processAvatar = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setIsCompressing(true);
    try {
      const compressed = await compressImage(file, 800, 800, 0.8);
      onAvatarChange(compressed);
    } catch {
      const reader = new FileReader();
      reader.onloadend = () => onAvatarChange(reader.result as string);
      reader.readAsDataURL(file);
    } finally {
      setIsCompressing(false);
    }
  }, [onAvatarChange]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? [])
      const img = items.find(i => i.kind === 'file' && i.type.startsWith('image/'))
      if (img) { const f = img.getAsFile(); if (f) processAvatar(f) }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [processAvatar]);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processAvatar(file);
  };

  const handleLangToggle = (lang: string) => {
    const next = new Set(selectedLanguages);
    if (next.has(lang)) {
      if (next.size > 1) next.delete(lang);
    } else {
      next.add(lang);
    }
    onSelectedLanguagesChange(next);
  };

  const getLangLabel = (value: string) =>
    LANGUAGES.find((l) => l.value === value)?.label ?? value;

  const getLanguageDisplayText = () => {
    const arr = Array.from(selectedLanguages);
    if (arr.length === 0) return getLangLabel(DEFAULT_LANGUAGE);
    if (arr.length === 1) return getLangLabel(arr[0]);
    if (arr.length === 2) return arr.map(getLangLabel).join(", ");
    return `${getLangLabel(arr[0])}, ${getLangLabel(arr[1])} +${arr.length - 2}`;
  };

  const removeTag = (tag: string) => {
    onPersonaTagsChange(personaTags.filter((t) => t !== tag));
  };

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !personaTags.includes(trimmed)) {
      onPersonaTagsChange([...personaTags, trimmed]);
    }
    setNewTagInput("");
    setShowTagInput(false);
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") addTag(newTagInput);
    if (e.key === "Escape") { setShowTagInput(false); setNewTagInput(""); }
  };

  const handleHandleChange = (v: string) => {
    const sanitized = v.toLowerCase().replace(/[^a-z0-9-]/g, "");
    onPersonaHandleChange(sanitized);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%" }}>

      {/* Avatar */}
      <div data-help-id="help-profile-avatar" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "#524b47", margin: 0 }}>Avatar</p>
        <div
          onDragEnter={(e) => { e.preventDefault(); dragCounter.current++; setIsDragOver(true) }}
          onDragLeave={() => { dragCounter.current--; if (dragCounter.current === 0) setIsDragOver(false) }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); dragCounter.current = 0; setIsDragOver(false); const f = e.dataTransfer.files[0]; if (f) processAvatar(f) }}
          style={{ display: "flex", alignItems: "center", gap: 12, borderRadius: 10, outline: isDragOver ? "2px solid rgba(82,75,71,0.45)" : "2px solid transparent", outlineOffset: 2, transition: "outline 100ms" }}
        >
          <div
            style={{
              position: "relative",
              width: 65,
              height: 65,
              borderRadius: 8,
              overflow: "hidden",
              flexShrink: 0,
              boxShadow: "0px 1.091px 1.09px 0px rgba(59,54,50,0.05), 0px 1.455px 1px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px #ede1d7",
            }}
          >
            {avatarUrl ? (
              <NextImage src={avatarUrl} alt="Persona avatar" fill sizes="65px" unoptimized style={{ objectFit: "cover" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", backgroundColor: "#ede1d7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#827a74" strokeWidth="1.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={isCompressing}
              style={{
                height: 30,
                padding: "0 12px",
                fontFamily: "var(--font-body)",
                fontSize: 14,
                fontWeight: 500,
                color: "#524b47",
                backgroundColor: "transparent",
                border: "1px solid rgba(59,54,50,0.3)",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              {isCompressing ? "Processing…" : avatarUrl ? "Change Image" : "Upload Image"}
            </button>
            {!avatarUrl && (
              <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "#524b47", margin: 0 }}>drag &amp; drop · paste</p>
            )}
          </div>
          <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarUpload} />
        </div>
      </div>

      {/* Name */}
      <div data-help-id="help-profile-name" style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 12px" }}>
        <label htmlFor="profile-persona-name" style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "#524b47" }}>Name</label>
        <div
          style={{
            backgroundColor: "white",
            display: "flex",
            alignItems: "center",
            gap: 2,
            padding: "7px 10px",
            borderRadius: 10,
            boxShadow: "0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px #ede1d7",
          }}
        >
          <input
            id="profile-persona-name"
            type="text"
            value={personaName}
            onChange={(e) => onPersonaNameChange(e.target.value)}
            placeholder="Persona name"
            style={{
              flex: 1,
              fontFamily: "var(--font-body)",
              fontSize: 14,
              color: "#6a625d",
              backgroundColor: "transparent",
              // eslint-disable-next-line react-doctor/no-outline-none -- browser outline suppressed; :focus-visible handled by container or global styles
              outline: "none",
              border: "none",
            }}
          />
        </div>
      </div>

      {/* Handle — auto-generated from name by the backend, not directly editable */}
      <div data-help-id="help-profile-handle" style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 12px" }}>
        <label htmlFor="profile-persona-handle" style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "#524b47" }}>Handle</label>
        <div
          style={{
            backgroundColor: "var(--neutral-50)",
            display: "flex",
            alignItems: "center",
            gap: 2,
            padding: "7px 10px",
            borderRadius: 10,
            boxShadow: "0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px #ede1d7",
            cursor: "default",
          }}
        >
          <input
            id="profile-persona-handle"
            type="text"
            value={personaHandle}
            readOnly
            tabIndex={-1}
            style={{
              flex: 1,
              fontFamily: "var(--font-body)",
              fontSize: 14,
              color: "#9c938b",
              backgroundColor: "transparent",
              outline: "none",
              border: "none",
              cursor: "default",
            }}
          />
        </div>
        <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "#9c938b", margin: 0 }}>
          Auto-generated from name · updates when you save a new version
        </p>
      </div>

      {/* Description */}
      <div data-help-id="help-profile-description" style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 12px", position: "relative" }}>
        <label htmlFor="profile-persona-desc" style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "#524b47" }}>Description</label>
        <div
          style={{
            backgroundColor: "white",
            display: "flex",
            alignItems: "flex-start",
            gap: 2,
            padding: "7px 10px",
            borderRadius: 10,
            boxShadow: "0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px #ede1d7",
            minHeight: 88,
          }}
        >
          <textarea
            id="profile-persona-desc"
            value={personaDescription}
            onChange={(e) => onPersonaDescriptionChange(e.target.value.slice(0, DESCRIPTION_MAX))}
            placeholder="Placeholder"
            rows={3}
            style={{
              flex: 1,
              fontFamily: "var(--font-body)",
              fontSize: 14,
              color: "#6a625d",
              backgroundColor: "transparent",
              // eslint-disable-next-line react-doctor/no-outline-none -- browser outline suppressed; :focus-visible handled by container or global styles
              outline: "none",
              resize: "none",
              lineHeight: 1.57,
              border: "none",
            }}
          />
        </div>
        <span
          style={{
            position: "absolute",
            bottom: 12,
            right: 20,
            fontFamily: "var(--font-body)",
            fontSize: 12,
            color: "#b6aca4",
          }}
        >
          {personaDescription.length}/{DESCRIPTION_MAX}
        </span>
      </div>

      {/* Tags */}
      <div data-help-id="help-profile-tags" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "#524b47", margin: 0 }}>Tags</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", padding: "8px 6px" }}>
          {personaTags.map((tag, idx) => {
            const color = getTagColor(idx);
            return (
              <span
                key={tag}
                style={{
                  fontFamily: "var(--font-body)",
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  padding: "2px 6px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  backgroundColor: color.bg,
                  color: color.text,
                  boxShadow: color.shadow,
                }}
              >
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 14,
                    height: 14,
                    borderRadius: 3,
                    border: "none",
                    backgroundColor: "transparent",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  <X size={9} strokeWidth={2.5} />
                </button>
                {tag}
              </span>
            );
          })}

          {showTagInput ? (
            <input
              ref={tagInputRef}
              type="text"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={() => {
                if (newTagInput.trim()) addTag(newTagInput);
                else { setShowTagInput(false); setNewTagInput(""); }
              }}
              placeholder="Tag name"
              style={{
                height: 22,
                padding: "0 8px",
                fontFamily: "var(--font-body)",
                fontSize: 12,
                border: "1px solid rgba(59,54,50,0.3)",
                borderRadius: 6,
                // eslint-disable-next-line react-doctor/no-outline-none -- browser outline suppressed; :focus-visible handled by container or global styles
                outline: "none",
                backgroundColor: "white",
                width: 96,
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowTagInput(true)}
              style={{
                fontFamily: "var(--font-body)",
                display: "flex",
                alignItems: "center",
                gap: 2,
                padding: "2px 6px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                color: "#524b47",
                cursor: "pointer",
                border: "none",
                backgroundColor: "#ede1d7",
                boxShadow:
                  "0px 1px 1.5px 0px rgba(18,12,8,0.2), 0px 0px 0px 1px rgba(106,98,93,0.5), inset 0px 1px 0px 0px rgba(247,242,237,0.7), inset 0px -1px 0px 0px rgba(106,98,93,0.1)",
              }}
            >
              <Plus size={11} strokeWidth={2.5} />
              Add tag
            </button>
          )}
        </div>
      </div>

      {/* Language */}
      <div style={{ display: "flex", flexDirection: "column", gap: 7, padding: "8px 0" }}>
        <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "#524b47", margin: 0 }}>Language</p>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Switch checked={isMultilingual} onCheckedChange={onIsMultilingualChange} />
          <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "#000", margin: 0 }}>
            {/* eslint-disable-next-line click-events-have-key-events, no-static-element-interactions -- interactive div; keyboard handling delegated to inner elements */}
            Do you want the persona to be multilingual?
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div
            ref={langTriggerRef}
            onClick={() => isMultilingual && setIsLangDropdownOpen((p) => !p)}
            style={{
              backgroundColor: "white",
              border: "1px solid #d1c6bd",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              borderRadius: 6,
              cursor: isMultilingual ? "pointer" : "default",
              userSelect: "none",
              opacity: isMultilingual ? 1 : 0.6,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  backgroundColor: "#ede1d7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#524b47" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#524b47",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {getLanguageDisplayText()}
              </span>
            </div>
            <ChevronDown size={20} color="#524b47" style={{ flexShrink: 0 }} />
          </div>

          {isMultilingual && isLangDropdownOpen && (
            <div
              ref={langDropdownRef}
              className="kaya-scrollbar"
              style={{
                border: "1px solid #d1c6bd",
                borderRadius: 8,
                backgroundColor: "white",
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                zIndex: 20,
                maxHeight: 220,
                overflowY: "auto",
                marginTop: 4,
              }}
            >
              {LANGUAGES.map((lang) => (
                <div
                  key={lang.value}
                  onClick={() => handleLangToggle(lang.value)}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", cursor: "pointer" }}
                >
                  <input
                    type="checkbox"
                    checked={selectedLanguages.has(lang.value)}
                    readOnly
                    style={{ accentColor: "#524b47", width: 16, height: 16, cursor: "pointer" }}
                  />
                  <span style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "#524b47" }}>{lang.label}</span>
                </div>
              ))}
            </div>
          )}

          {isMultilingual && (
            <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "#d97757", margin: 0 }}>
              Only models supporting these languages will be shown in the next step.
            </p>
          )}
        </div>
      </div>

    </div>
  );
}
