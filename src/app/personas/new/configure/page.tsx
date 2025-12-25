"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Info,
  Undo2,
  Redo2,
  Sparkles,
  Upload,
  Share2,
  Check,
  Loader2,
  Pencil,
  X,
  ChevronUp,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getModelIcon } from "@/lib/model-icons";
import chatStyles from "@/components/chat/chat-interface.module.css";
import styles from "./persona-configure.module.css";
import { ChatInterface } from "@/components/chat/chat-interface";
import type { Message } from "@/components/chat/chat-message";
import type { AIModel } from "@/types/ai-model";
import { useToast } from "@/hooks/use-toast";

// Import hooks and utilities
import { useFileUpload } from "./hooks/use-file-upload";
import { useRefinement } from "./hooks/use-refinement";
import { useInstructionHistory } from "./hooks/use-instruction-history";
import { useEnhancement } from "./hooks/use-enhancement";
import { MODELS, TONE_OPTIONS, DEFAULT_TEMPERATURE, MIN_TEMPERATURE, MAX_TEMPERATURE, TEMPERATURE_STEP, ACCEPTED_FILE_TYPES } from "./constants";
import { createPreviewModel } from "./utils";
import { REFINEMENT_STEPS } from "./types";

function PersonaConfigurePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  // Basic state
  const [personaName, setPersonaName] = useState("Persona name");
  const [selectedModel, setSelectedModel] = useState("");
  const [temperature, setTemperature] = useState([DEFAULT_TEMPERATURE]);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);

  // Custom hooks
  const {
    uploadedFiles,
    handleFileUpload,
    removeFile,
  } = useFileUpload();

  const {
    currentInstruction,
    canUndo,
    canRedo,
    setInstruction,
    undo,
    redo,
  } = useInstructionHistory("");

  const {
    isEnhancing,
    hasEnhancedContent,
    originalInstruction,
    enhance,
    reset: resetEnhancement,
  } = useEnhancement();

  const {
    currentStep,
    selectedTone,
    customToneInput,
    showCustomInput,
    dosText,
    dontsText,
    selectedDos,
    selectedDonts,
    suggestedDos,
    suggestedDonts,
    setDosText,
    setDontsText,
    handleToneSelect,
    handleCustomToneChange,
    handleCustomToneSubmit,
    handleDosToggle,
    handleDontsToggle,
    handleSkip,
    reset: resetRefinement,
  } = useRefinement(hasEnhancedContent);

  // Get persona name and ID from URL params
  useEffect(() => {
    const nameParam = searchParams.get("name");
    const personaIdParam = searchParams.get("personaId");
    
    if (nameParam) {
      setPersonaName(nameParam);
    }
    
    // Load existing persona data if personaId is provided
    if (personaIdParam) {
      // TODO: Fetch persona data from backend using personaIdParam
      // For now, we'll use mock data. Replace with actual API call:
      // const personaData = await fetchPersonaById(personaIdParam);
      
      // Example of how to populate fields with existing data:
      // setPersonaName(personaData.name);
      // setSelectedModel(personaData.model);
      // setTemperature([personaData.temperature]);
      // setInstruction(personaData.instructions);
      // setUploadedFiles(personaData.files);
      
      console.log("Loading persona for edit:", personaIdParam);
      // Once backend is connected, load the persona data here
    }
  }, [searchParams]);

  // Update preview model when a model is selected
  const previewModel = useMemo<AIModel | null>(() => {
    if (!selectedModel) return null;
    const model = MODELS.find((m) => m.value === selectedModel);
    return model ? createPreviewModel(model) : null;
  }, [selectedModel]);

  // Handle instruction changes
  const handleInstructionChange = (value: string) => {
    setInstruction(value);
    if (hasEnhancedContent) {
      resetEnhancement();
      resetRefinement();
    }
  };

  // Handle enhancement
  const handleEnhance = async () => {
    try {
      const enhanced = await enhance(currentInstruction);
      setInstruction(enhanced);
    } catch (error) {
      // Error is already handled in the hook
      console.error("Enhancement failed:", error);
    }
  };

  // Handle edit manually
  const handleEditManually = () => {
    resetEnhancement();
    resetRefinement();
  };

  // Handle skip with history management
  const handleSkipWithHistory = () => {
    if (currentStep === REFINEMENT_STEPS.DONTS) {
      // If skipping the last step, revert to original instruction
      setInstruction(originalInstruction);
      resetEnhancement();
      resetRefinement();
    } else {
      handleSkip();
    }
  };

  // Action handlers
  const handleShare = () => {
    // TODO: Implement share functionality
    console.log("Share clicked");
  };

  const handleSave = () => {
    // TODO: Implement save functionality
    console.log("Save clicked", {
      personaName,
      selectedModel,
      systemInstruction: currentInstruction,
      temperature: temperature[0],
    });
  };

  const handleBack = () => {
    router.push("/personas/new");
  };

  // Get selected model for display
  const selectedModelData = useMemo(() => {
    return MODELS.find((m) => m.value === selectedModel);
  }, [selectedModel]);

  return (
    <AppLayout>
      <div className={styles.container}>
        <div className={cn(styles.scrollContainer, chatStyles.customScrollbar)}>
          <div className={styles.contentWrapper}>
            {/* Header Row with Persona Name and Actions */}
            <div className={styles.headerRow}>
              <h2 className={styles.personaNameTitle}>{personaName}</h2>
              <div className={styles.headerActions}>
                <Button
                  variant="outline"
                  onClick={handleShare}
                  className={styles.shareButton}
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </Button>
                <Button onClick={handleSave} className={styles.saveButton}>
                  <Check className="h-4 w-4" />
                  Save
                </Button>
              </div>
            </div>

            <div className={styles.mainContent}>
              {/* Left Panel - Configuration */}
              <div className={styles.leftPanel}>
                {/* Model Selector */}
                <div className={styles.fieldGroup}>
                  <Label htmlFor="model" className={styles.label}>
                    Model
                  </Label>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger id="model" className={styles.selectTrigger}>
                      <div className={styles.modelSelectorContent}>
                        <div className={styles.modelSelectorLeft}>
                          {selectedModelData ? (
                            <>
                              <Image
                                src={getModelIcon(selectedModelData.company, selectedModelData.label)}
                                alt={selectedModelData.company}
                                width={20}
                                height={20}
                                className={styles.modelIcon}
                              />
                              <span>{selectedModelData.label}</span>
                            </>
                          ) : (
                            <span className={styles.placeholderText}>Select Model</span>
                          )}
                        </div>
                        <Info className={styles.infoIconInSelect} />
                      </div>
                    </SelectTrigger>
                    <SelectContent className={styles.selectContent}>
                      {MODELS.map((model) => (
                        <SelectItem key={model.value} value={model.value} className={styles.selectItem}>
                          <div className={styles.modelOption}>
                            <Image
                              src={getModelIcon(model.company, model.label)}
                              alt={model.company}
                              width={20}
                              height={20}
                              className={styles.modelOptionIcon}
                            />
                            <span>{model.label}</span>
                            <Info className="h-4 w-4 ml-auto text-[#666666]" />
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* System Instruction */}
                <div className={styles.fieldGroup}>
                  <Label htmlFor="system-instruction" className={styles.label}>
                    System Instruction
                  </Label>
                  <div className={cn(styles.textareaWrapper, chatStyles.customScrollbar)}>
                    <div className={styles.textareaContainer}>
                      <div className={cn(styles.textareaContentWrapper, chatStyles.customScrollbar)}>
                        <Textarea
                          id="system-instruction"
                          value={currentInstruction}
                          onChange={(e) => handleInstructionChange(e.target.value)}
                          className={styles.textarea}
                          placeholder="Enter system instructions..."
                        />
                        
                        {/* Refinement Section - Step-by-step flow */}
                        {hasEnhancedContent && (
                          <>
                            {/* Step 1: Tone Selection */}
                            {currentStep === REFINEMENT_STEPS.TONE && (
                              <div className={styles.refinementSection}>
                                <h3 className={styles.refinementTitle}>
                                  Let's refine your persona in 1/4 steps
                                </h3>
                                <p className={styles.refinementSubtitle}>
                                  We detected a few areas that could be clearer
                                </p>
                                <div className={styles.toneSelectionContainer}>
                                  <p className={styles.toneQuestion}>
                                    How should the persona communicate?
                                  </p>
                                  <div className={styles.toneButtons}>
                                    {TONE_OPTIONS.map((tone) => (
                                      <Button
                                        key={tone}
                                        variant="outline"
                                        onClick={() => handleToneSelect(tone)}
                                        className={cn(
                                          styles.toneButton,
                                          selectedTone === tone && styles.toneButtonSelected
                                        )}
                                      >
                                        {tone}
                                      </Button>
                                    ))}
                                    <Button
                                      variant="outline"
                                      onClick={() => handleToneSelect("Custom")}
                                      className={cn(
                                        styles.toneButton,
                                        selectedTone === "Custom" && styles.toneButtonSelected
                                      )}
                                    >
                                      <Pencil className="h-4 w-4" />
                                      Custom
                                    </Button>
                                  </div>
                                  {showCustomInput && (
                                    <div className={styles.customToneInputContainer}>
                                      <div className={styles.customToneInputWrapper}>
                                        <Input
                                          type="text"
                                          placeholder="Eg. Supportive"
                                          value={customToneInput}
                                          onChange={(e) => handleCustomToneChange(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                              handleCustomToneSubmit();
                                            }
                                          }}
                                          className={styles.customToneInput}
                                        />
                                        <ChevronUp className={styles.customToneIcon} />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {/* Step 2: Dos Section */}
                            {currentStep === REFINEMENT_STEPS.DOS && (
                              <div className={styles.dosDontsSection}>
                                <h3 className={styles.refinementTitle}>
                                  Let's refine your persona in 2/4 steps
                                </h3>
                                <h4 className={styles.dosDontsTitle}>
                                  Dos (what do you want the persona to always do?)
                                </h4>
                                <Textarea
                                  placeholder="Type your message here."
                                  value={dosText}
                                  onChange={(e) => setDosText(e.target.value)}
                                  className={styles.dosDontsTextarea}
                                  rows={3}
                                />
                                {suggestedDos.length > 0 && (
                                  <>
                                    <p className={styles.suggestedTitle}>Select from Suggested</p>
                                    <div className={styles.suggestedButtons}>
                                      {suggestedDos.map((dos) => (
                                        <Button
                                          key={dos}
                                          variant="outline"
                                          onClick={() => handleDosToggle(dos)}
                                          className={cn(
                                            styles.suggestedButton,
                                            selectedDos.includes(dos) && styles.suggestedButtonSelected
                                          )}
                                        >
                                          {dos}
                                        </Button>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                            
                            {/* Step 3: Don'ts Section */}
                            {currentStep === REFINEMENT_STEPS.DONTS && (
                              <div className={styles.dosDontsSection}>
                                <h3 className={styles.refinementTitle}>
                                  Let's refine your persona in 3/4 steps
                                </h3>
                                <h4 className={styles.dosDontsTitle}>
                                  Don'ts (what should the persona never do?)
                                </h4>
                                <Textarea
                                  placeholder="Type your message here."
                                  value={dontsText}
                                  onChange={(e) => setDontsText(e.target.value)}
                                  className={styles.dosDontsTextarea}
                                  rows={3}
                                />
                                {suggestedDonts.length > 0 && (
                                  <>
                                    <p className={styles.suggestedTitle}>Select from Suggested</p>
                                    <div className={styles.suggestedButtons}>
                                      {suggestedDonts.map((dont) => (
                                        <Button
                                          key={dont}
                                          variant="outline"
                                          onClick={() => handleDontsToggle(dont)}
                                          className={cn(
                                            styles.suggestedButton,
                                            selectedDonts.includes(dont) && styles.suggestedButtonSelected
                                          )}
                                        >
                                          {dont}
                                        </Button>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </>
                        )}
                        
                        <div className={styles.textareaActions}>
                          <div className={styles.iconButtonGroup}>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={undo}
                              disabled={!canUndo}
                              className={styles.iconButton}
                            >
                              <Undo2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={redo}
                              disabled={!canRedo}
                              className={styles.iconButton}
                            >
                              <Redo2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <Button
                            onClick={handleEnhance}
                            disabled={isEnhancing}
                            className={styles.enhanceButton}
                          >
                            {isEnhancing ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Enhancing...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4" />
                                Enhance
                              </>
                            )}
                          </Button>
                          {hasEnhancedContent && (
                            <>
                              <Button
                                variant="outline"
                                onClick={handleEditManually}
                                className={styles.editManualButton}
                              >
                                <Pencil className="h-4 w-4" />
                                Edit Prompt Text Manually
                              </Button>
                              <Button
                                variant="outline"
                                onClick={handleSkipWithHistory}
                                className={styles.skipButton}
                              >
                                Skip
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Creativity Level */}
                <div className={styles.fieldGroup}>
                  <div className={styles.sliderHeader}>
                    <Label className={styles.label}>
                      Creativity level (Temperature)
                    </Label>
                    <span className={styles.temperatureValue}>
                      {temperature[0].toFixed(1)}
                    </span>
                  </div>
                  <div className={styles.sliderWrapper}>
                    <div className={styles.sliderLabels}>
                      <span className={styles.sliderLabel}>Least creative</span>
                      <span className={styles.sliderLabel}>Most creative</span>
                    </div>
                    <Slider
                      value={temperature}
                      onValueChange={setTemperature}
                      min={MIN_TEMPERATURE}
                      max={MAX_TEMPERATURE}
                      step={TEMPERATURE_STEP}
                      className={styles.slider}
                    />
                  </div>
                </div>

                {/* Knowledge */}
                <div className={styles.fieldGroup}>
                  <Label className={styles.label}>Knowledge</Label>
                  <div className={styles.uploadArea}>
                    <input
                      type="file"
                      id="knowledge-upload"
                      multiple
                      accept={ACCEPTED_FILE_TYPES}
                      onChange={handleFileUpload}
                      className={styles.hiddenInput}
                    />
                    <p className={styles.uploadText}>
                      Add files for your persona to reference
                    </p>
                    <Button
                      variant="outline"
                      onClick={() =>
                        document.getElementById("knowledge-upload")?.click()
                      }
                      className={styles.uploadButton}
                    >
                      <Upload className="h-4 w-4" />
                      Upload file
                    </Button>
                  </div>
                  {uploadedFiles.length > 0 && (
                    <div className={styles.uploadedFilesContainer}>
                      {uploadedFiles.map((file) =>
                        file.type === 'pdf' ? (
                          <div
                            key={file.id}
                            className={styles.uploadedFileCard}
                          >
                            {file.isUploading && (
                              <div 
                                className={styles.uploadProgressBar}
                                style={{ width: `${file.uploadProgress || 0}%` }}
                              />
                            )}
                            <div className={styles.fileIconContainer}>
                              <FileText className={styles.fileIcon} />
                            </div>
                            <div className={styles.fileInfo}>
                              <p className={styles.fileName}>{file.name}</p>
                              <p className={styles.fileType}>
                                {file.isUploading ? `Uploading... ${file.uploadProgress || 0}%` : 'PDF Document'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFile(file.id)}
                              className={styles.removeFileButton}
                            >
                              <X className="h-3 w-3 text-[#666666]" />
                            </button>
                          </div>
                        ) : (
                          <div
                            key={file.id}
                            className={styles.uploadedImageCard}
                          >
                            <img 
                              src={file.url} 
                              alt={file.name}
                              className={styles.uploadedImage}
                            />
                            {file.isUploading && (
                              <div className={styles.imageUploadOverlay}>
                                <svg className={styles.uploadProgressCircle} viewBox="0 0 36 36">
                                  <circle
                                    cx="18"
                                    cy="18"
                                    r="16"
                                    fill="none"
                                    stroke="#22C55E"
                                    strokeWidth="3"
                                    strokeDasharray={`${(file.uploadProgress || 0) * 100.48 / 100}, 100.48`}
                                    strokeLinecap="round"
                                    transform="rotate(-90 18 18)"
                                  />
                                </svg>
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => removeFile(file.id)}
                              className={styles.removeFileButton}
                            >
                              <X className="h-3 w-3 text-[#666666]" />
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  )}
                  
                  {/* Back Button */}
                  <Button
                    variant="outline"
                    onClick={handleBack}
                    className={styles.backButton}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                </div>
              </div>

              {/* Right Panel - Preview & Chat */}
              <div className={styles.rightPanel}>
                {/* Preview Card with Chat Interface */}
                <div className={styles.previewCard}>
                  <ChatInterface
                    messages={chatMessages}
                    setMessages={setChatMessages}
                    selectedModel={previewModel}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function PersonaConfigurePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PersonaConfigurePageContent />
    </Suspense>
  );
}
