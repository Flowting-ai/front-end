"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, Info, User, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import chatStyles from "@/components/chat/chat-interface.module.css";
import styles from "./persona-form.module.css";
import { LANGUAGES, DEFAULT_LANGUAGE, DEFAULT_PERSONA_NAME } from "./constants";
import { compressImage, getDataUrlSize, formatBytes } from "@/lib/image-utils";
import { useFileDrop } from "@/hooks/use-file-drop";

export default function NewPersonaPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isMultilingual, setIsMultilingual] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [selectedLanguages, setSelectedLanguages] = useState<Set<string>>(
    new Set([DEFAULT_LANGUAGE])
  );
  
  // Reset to default when multilingual is turned off
  useEffect(() => {
    if (!isMultilingual) {
      setSelectedLanguages(new Set([DEFAULT_LANGUAGE]));
      setIsLanguageDropdownOpen(false);
    }
  }, [isMultilingual]);
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const languageDropdownRef = useRef<HTMLDivElement>(null);
  const languageTriggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        languageDropdownRef.current &&
        !languageDropdownRef.current.contains(event.target as Node) &&
        languageTriggerRef.current &&
        !languageTriggerRef.current.contains(event.target as Node)
      ) {
        setIsLanguageDropdownOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" && isLanguageDropdownOpen) {
        setIsLanguageDropdownOpen(false);
      }
      if (event.key === "Escape" && isLanguageDropdownOpen) {
        setIsLanguageDropdownOpen(false);
      }
    };

    if (isLanguageDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isLanguageDropdownOpen]);

  const processAvatarFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      console.error('❌ Please select an image file');
      return;
    }

    setIsCompressing(true);
    try {
      const compressedImage = await compressImage(file, 800, 800, 0.8);
      const size = getDataUrlSize(compressedImage);
      if (size > 4 * 1024 * 1024) {
        console.warn('⚠️ Image is still large after compression. Consider a smaller image.');
      }
      setAvatarUrl(compressedImage);
    } catch (error) {
      console.error('❌ Failed to compress image:', error);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } finally {
      setIsCompressing(false);
    }
  }, []);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) processAvatarFile(file);
  };

  const { isDragging: isAvatarDragging, dropZoneProps: avatarDropZoneProps, handlePaste: avatarHandlePaste } = useFileDrop({
    onFiles: (files) => { if (files[0]) processAvatarFile(files[0]); },
    accept: ["image/"],
    disabled: isCompressing,
  });

  // Paste listener for avatar images
  useEffect(() => {
    document.addEventListener("paste", avatarHandlePaste);
    return () => document.removeEventListener("paste", avatarHandlePaste);
  }, [avatarHandlePaste]);

  const handleLanguageToggle = (languageValue: string) => {
    setSelectedLanguages((prev) => {
      const next = new Set(prev);
      if (next.has(languageValue)) {
        next.delete(languageValue);
      } else {
        next.add(languageValue);
      }
      return next;
    });
  };

  const getSelectedLanguagesText = () => {
    if (selectedLanguages.size === 0) {
      return "Select languages...";
    }
    const selected = Array.from(selectedLanguages)
      .map((val) => LANGUAGES.find((lang) => lang.value === val)?.label)
      .filter(Boolean);
    return selected.join(", ");
  };

  const handleContinue = () => {
    const params = new URLSearchParams();
    params.set("name", name || DEFAULT_PERSONA_NAME);
    
    // Store avatar in sessionStorage to persist across navigation
    if (avatarUrl) {
      try {
        console.debug("✅ Storing avatar in sessionStorage, size:", avatarUrl.length);
        console.debug("✅ Avatar preview:", avatarUrl.substring(0, 100));
        sessionStorage.setItem('personaAvatar', avatarUrl);
        console.debug("✅ Avatar stored successfully");
      } catch (error) {
        // If still exceeds quota, clear old data and try again
        console.error('❌ Failed to store avatar:', error);
        try {
          sessionStorage.clear();
          sessionStorage.setItem('personaAvatar', avatarUrl);
          console.debug("✅ Avatar stored after clearing storage");
        } catch (retryError) {
          console.error('❌ Failed to store avatar even after clearing storage:', retryError);
          // Continue without avatar in worst case
        }
      }
    } else {
      console.debug("ℹ️ No avatar to store");
    }
    
    router.push(`/personas/new/configure?${params.toString()}`);
  };

  const handleBack = () => {
    router.push("/personas");
  };

  return (
    <AppLayout>
      <div className={styles.container}>
        <div className={cn(styles.scrollContainer, chatStyles.customScrollbar)}>
          <div className={styles.formWrapper}>
          <div className={styles.header}>
            <h1 className={styles.title}>Persona basics</h1>
            <p className={styles.subtitle}>
              Let's set the foundation for your new persona.
            </p>
          </div>

          <div className={styles.content}>
            {/* Avatar Upload Section */}
            <div className={styles.avatarSection} {...avatarDropZoneProps}>
              <div className="relative">
                <Avatar className={styles.avatar}>
                  <AvatarImage 
                    src={avatarUrl || undefined} 
                    alt=""
                    onLoad={() => console.debug("✅ Avatar image loaded successfully")}
                    onError={(e) => console.error("❌ Avatar image failed to load:", e)}
                  />
                  <AvatarFallback className={styles.avatarFallback}>
                    <img src="/avatars/personaAvatarPlaceHolder.svg" alt="" className={styles.avatarPlaceholder} />
                  </AvatarFallback>
                </Avatar>
                {isAvatarDragging && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-white/80 border-2 border-dashed border-[#7c6fcd]">
                    <Upload className="h-6 w-6 text-[#7c6fcd]" />
                  </div>
                )}
              </div>
              <div className={styles.uploadButtonWrapper}>
                <input
                  type="file"
                  id="avatar-upload"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className={styles.hiddenInput}
                  disabled={isCompressing}
                />
                <Button
                  variant="outline"
                  className={cn(styles.uploadButton, "cursor-pointer")}
                  onClick={() => document.getElementById("avatar-upload")?.click()}
                  disabled={isCompressing}
                >
                  {isCompressing ? "Compressing..." : "Choose Avatar"}
                </Button>
                <p className="text-xs text-[#888888] mt-1">or drag & drop / paste an image</p>
              </div>
            </div>

            {/* Name Input Section */}
            <div className={styles.fieldGroup}>
              <Label htmlFor="name" className={styles.label}>
                Name
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter persona name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={styles.input}
              />
            </div>

            {/* Language Section */}
            <div className={styles.fieldGroup}>
              <div className={styles.languageHeader}>
                <Label htmlFor="multilingual" className={styles.label}>
                  Language
                </Label>
                <span className={styles.infoIconWrap}>
                  <Info className={styles.infoIcon} />
                </span>
              </div>

              <div className={styles.multilingualToggle}>
                <Switch
                  id="multilingual"
                  checked={isMultilingual}
                  onCheckedChange={setIsMultilingual}
                  className={cn(styles.switch, "cursor-pointer")}
                />
                <Label
                  htmlFor="multilingual"
                  className={cn(styles.toggleLabel, "cursor-pointer")}
                >
                  Do you want the persona to be multilingual?
                </Label>
              </div>

              {isMultilingual ? (
                <div className={styles.languageSelectorWrapper}>
                  <div
                    ref={languageTriggerRef}
                    className={styles.languageTrigger}
                    onClick={() => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}
                  >
                    <span
                      className={cn(
                        styles.languageTriggerText,
                        selectedLanguages.size === 0 && styles.placeholder
                      )}
                    >
                      {getSelectedLanguagesText()}
                    </span>
                    <ChevronDown
                      className={cn(
                        styles.chevronIcon,
                        isLanguageDropdownOpen && styles.chevronIconOpen
                      )}
                    />
                  </div>

                  {isLanguageDropdownOpen && (
                    <div ref={languageDropdownRef} className={styles.languageDropdown}>
                      <div className={styles.languageDropdownHeader}>Default</div>
                      <div className={styles.languageList}>
                        {LANGUAGES.map((language) => {
                          const isChecked = selectedLanguages.has(language.value);
                          return (
                            <div
                              key={language.value}
                              className={styles.languageItem}
                              onClick={() => handleLanguageToggle(language.value)}
                            >
                              <span className={styles.languageLabel}>
                                {language.label}
                              </span>
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={(checked) => {
                                  handleLanguageToggle(language.value);
                                }}
                                className={styles.languageCheckbox}
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.languageDisplay}>
                  <span className={styles.languageDisplayText}>
                    English (Default)
                  </span>
                </div>
              )}

              <p className={styles.helperText}>
                Only models supporting these languages will be shown in the next
                step.
              </p>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className={styles.footer}>
            <Button
              variant="outline"
              onClick={handleBack}
              className={styles.backButton}
            >
              <span className={styles.backChevronBox}>
                <ChevronLeft size={16} className={styles.backChevron} strokeWidth={2} />
              </span>
              <span className={styles.buttonText}>Back</span>
            </Button>
            <Button
              onClick={handleContinue}
              className={styles.continueButton}
            >
              <span className={styles.buttonTextPrimary}>Continue</span>
              <span className={styles.continueChevronBox}>
                <ChevronRight size={16} className={styles.continueChevron} strokeWidth={2} />
              </span>
            </Button>
          </div>
        </div>
        </div>
      </div>
    </AppLayout>
  );
}
