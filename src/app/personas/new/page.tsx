"use client";

import { useState, useRef, useEffect } from "react";
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

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log("📸 Avatar upload started:", file.name, file.size, "bytes");
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        console.error('❌ Please select an image file');
        return;
      }

      setIsCompressing(true);
      try {
        // Compress the image to reduce storage size
        // Max dimensions: 800x800, quality: 0.8
        console.log("🔄 Compressing image...");
        const compressedImage = await compressImage(file, 800, 800, 0.8);
        
        // Check size after compression
        const size = getDataUrlSize(compressedImage);
        console.log(`✅ Compressed image size: ${formatBytes(size)}`);
        console.log("✅ Compressed preview:", compressedImage.substring(0, 100));
        
        // SessionStorage typically has a 5-10MB limit
        // Warn if still too large (4MB threshold to be safe)
        if (size > 4 * 1024 * 1024) {
          console.warn('⚠️ Image is still large after compression. Consider a smaller image.');
        }
        
        setAvatarUrl(compressedImage);
        console.log("✅ Avatar set in state");
      } catch (error) {
        console.error('❌ Failed to compress image:', error);
        // Fallback to original if compression fails
        const reader = new FileReader();
        reader.onloadend = () => {
          console.log("✅ Using uncompressed image as fallback");
          setAvatarUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
      } finally {
        setIsCompressing(false);
      }
    }
  };

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
        console.log("✅ Storing avatar in sessionStorage, size:", avatarUrl.length);
        console.log("✅ Avatar preview:", avatarUrl.substring(0, 100));
        sessionStorage.setItem('personaAvatar', avatarUrl);
        console.log("✅ Avatar stored successfully");
      } catch (error) {
        // If still exceeds quota, clear old data and try again
        console.error('❌ Failed to store avatar:', error);
        try {
          sessionStorage.clear();
          sessionStorage.setItem('personaAvatar', avatarUrl);
          console.log("✅ Avatar stored after clearing storage");
        } catch (retryError) {
          console.error('❌ Failed to store avatar even after clearing storage:', retryError);
          // Continue without avatar in worst case
        }
      }
    } else {
      console.log("ℹ️ No avatar to store");
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
            <div className={styles.avatarSection}>
              <Avatar className={styles.avatar}>
                <AvatarImage 
                  src={avatarUrl || undefined} 
                  alt=""
                  onLoad={() => console.log("✅ Avatar image loaded successfully")}
                  onError={(e) => console.error("❌ Avatar image failed to load:", e)}
                />
                <AvatarFallback className={styles.avatarFallback}>
                  <img src="/avatars/personaAvatarPlaceHolder.svg" alt="" className={styles.avatarPlaceholder} />
                </AvatarFallback>
              </Avatar>
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
