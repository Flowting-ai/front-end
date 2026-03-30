"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useRef } from "react";
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
  SelectValue,
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
  ChevronLeft,
  FileText,
  Rocket,
  Search,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getModelIcon } from "@/lib/model-icons";
import chatStyles from "@/components/chat/chat-interface.module.css";
import styles from "./persona-configure.module.css";
import { ChatInterface } from "@/components/chat/chat-interface";
import type { Message } from "@/components/chat/chat-message";
import type { AIModel } from "@/types/ai-model";
import { toast } from "@/lib/toast-helper";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// Import hooks and utilities
import { useFileUpload } from "./hooks/use-file-upload";
import { useRefinement } from "./hooks/use-refinement";
import { useInstructionHistory } from "./hooks/use-instruction-history";
import { useEnhancement } from "./hooks/use-enhancement";
import {
  TONE_OPTIONS,
  DEFAULT_TEMPERATURE,
  MIN_TEMPERATURE,
  MAX_TEMPERATURE,
  TEMPERATURE_STEP,
  ACCEPTED_FILE_TYPES,
} from "./constants";
import { fetchModelsWithCache } from "@/lib/ai-models";
import { REFINEMENT_STEPS } from "./types";
import { dataUrlToFile } from "./utils";
import {
  createPersona,
  updatePersona,
  fetchPersonaById,
} from "@/lib/api/personas";
import { useAuth } from "@/context/auth-context";
import { API_BASE_URL } from "@/lib/config";

// Helper to construct full avatar URL from relative or absolute paths
const getFullAvatarUrl = (url: string | null | undefined): string | null => {
  if (!url || url.trim() === "") return null;
  // Already a full URL (http/https) or data URL
  if (
    url.startsWith("http") ||
    url.startsWith("data:") ||
    url.startsWith("blob:")
  ) {
    return url;
  }
  // Relative path - prepend backend URL
  return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

// Check if URL should use unoptimized mode (data URLs, blob URLs, or external URLs)
const shouldUseUnoptimized = (url: string | null | undefined): boolean => {
  if (!url) return false;
  const fullUrl = getFullAvatarUrl(url);
  if (!fullUrl) return false;
  return (
    fullUrl.startsWith("data:") ||
    fullUrl.startsWith("blob:") ||
    fullUrl.startsWith("http")
  );
};

function PersonaConfigurePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Basic state
  const [personaName, setPersonaName] = useState("Persona name");
  const [selectedModel, setSelectedModel] = useState("");
  const [temperature, setTemperature] = useState([DEFAULT_TEMPERATURE]);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [createdPersonaId, setCreatedPersonaId] = useState<string | null>(null);
  const [isChatMode, setIsChatMode] = useState(false);
  const [testStreamMessage, setTestStreamMessage] = useState("");
  const [models, setModels] = useState<AIModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [hasFinishedBuilding, setHasFinishedBuilding] = useState(false);
  const { user } = useAuth();

  const maskEmail = (email: string | null | undefined): string => {
    if (!email) return "your@email.com";
    const atIndex = email.indexOf("@");
    if (atIndex <= 3) return email;
    return email.slice(0, 3) + "*".repeat(atIndex - 3) + email.slice(atIndex);
  };

  // Enhance mode state
  const [showEnhanceMode, setShowEnhanceMode] = useState(false);
  type EnhanceLoadingStep = 'analyzing' | 'drafting' | 'enhancing';
  const [enhanceLoadingStep, setEnhanceLoadingStep] = useState<EnhanceLoadingStep | null>(null);
  const [activeEnhanceTab, setActiveEnhanceTab] = useState(0);
  const [canContinueTab, setCanContinueTab] = useState(false);
  
  // Tab 4: Topic focus
  const [topicFocus, setTopicFocus] = useState<'Open' | 'Focused' | 'Strict' | ''>('');
  
  // Tab 5: Handling unknowns
  const [handlingUnknowns, setHandlingUnknowns] = useState<string[]>([]);
  const [customUnknown, setCustomUnknown] = useState('');
  const [showCustomUnknown, setShowCustomUnknown] = useState(false);
  
  // Tab 6: Response structure
  const [responseStructure, setResponseStructure] = useState<string[]>([]);
  const [customStructure, setCustomStructure] = useState('');
  const [showCustomStructure, setShowCustomStructure] = useState(false);
  
  // Tab 2 & 3: Custom Dos and Donts visibility
  const [showCustomDos, setShowCustomDos] = useState(false);
  const [showCustomDonts, setShowCustomDonts] = useState(false);
  
  // Track all improvements for tab 7
  const [improvementsList, setImprovementsList] = useState<string[]>([]);
  
  // Track if enhancements have been applied
  const [hasAppliedEnhancements, setHasAppliedEnhancements] = useState(false);

  // Custom hooks
  const { uploadedFiles, handleFileUpload, removeFile } = useFileUpload();

  const { currentInstruction, canUndo, canRedo, setInstruction, undo, redo } =
    useInstructionHistory("");

  const {
    isEnhancing,
    hasEnhancedContent,
    originalInstruction,
    enhance,
    reset: resetEnhancement,
  } = useEnhancement();

  // Track scroll state for showing scrollbar when content is scrolled
  const textareaContentRef = useRef<HTMLDivElement | null>(null);
  const [isTextareaScrolled, setIsTextareaScrolled] = useState(false);
  useEffect(() => {
    const el = textareaContentRef.current;
    if (!el) return;
    const onScroll = () => {
      setIsTextareaScrolled(el.scrollTop > 0);
    };
    // Initialize state based on current position
    onScroll();
    el.addEventListener("scroll", onScroll);
    return () => {
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

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
    dosSkipped,
    setCurrentStep,
    setDosText,
    setDontsText,
    setSelectedToneDirect,
    setSuggestedDos,
    setSuggestedDonts,
    handleToneSelect,
    handleToneToggle,
    handleCustomToneChange,
    handleCustomToneSubmit,
    handleDosToggle,
    handleDontsToggle,
    handleSkip,
    reset: resetRefinement,
  } = useRefinement(hasEnhancedContent);

  const isRefinementComplete =
    hasEnhancedContent &&
    selectedTone.length > 0 &&
    (selectedDos.length > 0 || dosText.trim() !== "" || dosSkipped) &&
    (selectedDonts.length > 0 || dontsText.trim() !== "");

  // Check if persona is ready to be saved
  const isPersonaReady = useMemo(() => {
    const ready =
      personaName.trim() !== "" &&
      personaName.trim() !== "Persona name" &&
      selectedModel !== "" &&
      currentInstruction.trim() !== "";
    console.debug("isPersonaReady check:", {
      personaName: personaName.trim(),
      selectedModel,
      instructionLength: currentInstruction.trim().length,
      ready,
    });
    return ready;
  }, [personaName, selectedModel, currentInstruction]);

  // Calculate progress dots (7 total)
  const progressSteps = useMemo(() => {
    let completed = 0;

    // Step 1: Persona name entered
    if (personaName.trim() !== "" && personaName.trim() !== "Persona name") {
      completed++;
    }

    // Step 2: Model selected
    if (selectedModel !== "") {
      completed++;
    }

    // Step 3: Instruction entered
    if (currentInstruction.trim() !== "") {
      completed++;
    }

    // Step 4: Temperature adjusted (default is 1, so check if it's different)
    if (temperature[0] !== DEFAULT_TEMPERATURE) {
      completed++;
    }

    // Step 5: Tone selected
    if (selectedTone.length > 0) {
      completed++;
    }

    // Step 6: At least one Do added
    if (selectedDos.length > 0) {
      completed++;
    }

    // Step 7: PDF uploaded
    if (uploadedFiles.some((f) => f.type === "pdf")) {
      completed++;
    }

    return completed;
  }, [
    personaName,
    selectedModel,
    currentInstruction,
    temperature,
    selectedTone,
    selectedDos,
    uploadedFiles,
  ]);

  // Load models first (priority - needed before loading persona data)
  useEffect(() => {
    if (models.length > 0) return;
    let cancelled = false;
    setIsLoadingModels(true);
    fetchModelsWithCache().then((result) => {
      if (!cancelled) {
        setModels(result);
        setIsLoadingModels(false);
      }
    }).catch(() => {
      if (!cancelled) setIsLoadingModels(false);
    });
    return () => { cancelled = true; };
  }, [models.length]);

  // Track which persona we've loaded to prevent re-loading
  const loadedPersonaIdRef = useRef<string | null>(null);

  // Get persona name and ID from URL params - load after models are ready
  useEffect(() => {
    const nameParam = searchParams.get("name");
    const personaIdParam = searchParams.get("personaId");
    const chatModeParam = searchParams.get("chatMode");

    // Load avatar from sessionStorage (only for new personas, not when editing)
    if (!personaIdParam) {
      try {
        const savedAvatar = sessionStorage.getItem("personaAvatar");
        if (savedAvatar) {
          console.debug(
            "✅ Loaded avatar from sessionStorage, size:",
            savedAvatar.length,
            "bytes",
          );
          console.debug("✅ Avatar preview:", savedAvatar.substring(0, 100));
          setAvatarUrl(savedAvatar);
        } else {
          console.debug("ℹ️ No avatar in sessionStorage");
        }
      } catch (error) {
        console.error("❌ Failed to load avatar from sessionStorage:", error);
      }
    }

    if (nameParam) {
      setPersonaName(nameParam);
    }

    // Enable chat mode if chatMode=true is in URL
    if (chatModeParam === "true") {
      setIsChatMode(true);
      setIsTesting(true);
    }

    // Load existing persona data if personaId is provided
    // Wait for models to load first to ensure model selection works
    // Only load once per personaId to prevent re-loading and clearing the form
    if (
      personaIdParam && 
      (models.length > 0 || !isLoadingModels) &&
      loadedPersonaIdRef.current !== personaIdParam
    ) {
      setCreatedPersonaId(personaIdParam);
      loadedPersonaIdRef.current = personaIdParam;

      const loadPersonaData = async () => {
        try {
          const personaData = await fetchPersonaById(personaIdParam);

          console.debug("📥 Loading persona data:", personaData);

          if (!personaData) {
            toast.error("Persona not found");
            return;
          }

          // Populate fields with existing data
          setPersonaName(personaData.name);
          setInstruction(personaData.prompt);

          // Set model if available - ensure models are loaded
          if (personaData.model_id) {
            const modelIdStr = String(personaData.model_id);
            console.debug("🔍 Setting model ID:", modelIdStr);
            console.debug(
              "📋 Available models:",
              models.map((m) => ({ id: m.modelId, name: m.modelName })),
            );
            setSelectedModel(modelIdStr);
          }

          // Set avatar if available (only when editing existing persona)
          if (personaData.image_url) {
            console.debug(
              "✅ Loading existing persona avatar:",
              personaData.image_url,
            );
            const fullUrl = getFullAvatarUrl(personaData.image_url);
            console.debug("✅ Full avatar URL:", fullUrl);
            setAvatarUrl(fullUrl); // Use full URL instead of relative path
          } else {
            console.debug("ℹ️ No avatar for existing persona");
          }

          console.debug("✅ Persona data loaded successfully");
        } catch (error) {
          console.error("❌ Failed to load persona:", error);
          toast.error("Failed to load persona data");
        }
      };

      loadPersonaData();
    }
  }, [searchParams, models.length, isLoadingModels, setInstruction]);

  const resolvedSelectedModel = useMemo<AIModel | null>(() => {
    if (!selectedModel) return null;
    const match = models.find(
      (m) =>
        String(m.modelId ?? m.id ?? m.modelName) === selectedModel ||
        `${m.companyName}: ${m.modelName}` === selectedModel,
    );
    return match || null;
  }, [models, selectedModel]);

  // Update preview model when a model is selected
  const previewModel = resolvedSelectedModel;

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
      // Show enhance mode modal
      setShowEnhanceMode(true);
      setEnhanceLoadingStep('analyzing');

      // Simulate analyzing phase
      await new Promise(resolve => setTimeout(resolve, 900));
      setEnhanceLoadingStep('drafting');
      // Simulate drafting phase
      await new Promise(resolve => setTimeout(resolve, 900));
      setEnhanceLoadingStep('enhancing');

      // Call enhance API
      const analysis = await enhance(currentInstruction);

      // Complete loading
      setEnhanceLoadingStep(null);
      setActiveEnhanceTab(0);

      // Replace the prompt with the enhanced version
      const enhancedPrompt = analysis.prompt || analysis.summary;
      if (enhancedPrompt) {
        setInstruction(enhancedPrompt);
      }

      // Set tone if provided
      if (analysis.tone) {
        setSelectedToneDirect([analysis.tone]);
      }

      // Set dos suggestions - user will select from these
      if (analysis.dos && analysis.dos.length > 0) {
        setSuggestedDos(analysis.dos);
        setCurrentStep(REFINEMENT_STEPS.DOS);
      }

      // Set donts suggestions - user will select from these
      if (analysis.donts && analysis.donts.length > 0) {
        setSuggestedDonts(analysis.donts);
      }
    } catch (error) {
      // Error is already handled in the hook
      console.error("Enhancement failed:", error);
      setShowEnhanceMode(false);
      setEnhanceLoadingStep(null);
    }
  };

  // Handle edit manually
  const handleEditManually = () => {
    resetEnhancement();
    resetRefinement();
  };

  // Handle close enhance mode
  const handleCloseEnhanceMode = () => {
    setShowEnhanceMode(false);
    setEnhanceLoadingStep(null);
    setActiveEnhanceTab(0);
    setCanContinueTab(false);
    
    // Reset selections when closing without applying
    // But keep hasAppliedEnhancements state for button text
  };

  // Handle continue to next tab
  const handleContinueTab = () => {
    if (activeEnhanceTab < 6) {
      // Build improvements list as we go
      const improvements: string[] = [];
      if (selectedTone.length > 0) {
        const tones = selectedTone.map(t => t === 'Custom' && customToneInput.trim() ? customToneInput : t).filter(t => t !== 'Custom');
        if (tones.length > 0) improvements.push(`Tone: ${tones.join(' + ')}`);
      }
      if (selectedDos.length > 0) improvements.push(`Dos: ${selectedDos.join(', ')}`);
      if (dosText.trim()) improvements.push(`Custom Dos: ${dosText}`);
      if (selectedDonts.length > 0) improvements.push(`Don'ts: ${selectedDonts.join(', ')}`);
      if (dontsText.trim()) improvements.push(`Custom Don'ts: ${dontsText}`);
      if (topicFocus) improvements.push(`Topic Focus: ${topicFocus}`);
      if (handlingUnknowns.length > 0) improvements.push(`Handling Unknowns: ${handlingUnknowns.join(', ')}`);
      if (customUnknown.trim()) improvements.push(`Custom Unknown Handling: ${customUnknown}`);
      if (responseStructure.length > 0) improvements.push(`Response Structure: ${responseStructure.join(', ')}`);
      if (customStructure.trim()) improvements.push(`Custom Structure: ${customStructure}`);
      setImprovementsList(improvements);

      setActiveEnhanceTab(activeEnhanceTab + 1);
      setCanContinueTab(false);
    } else {
      // Final tab - close enhance mode
      handleCloseEnhanceMode();
    }
  };

  // Handle back button
  const handleBackTab = () => {
    if (activeEnhanceTab > 0) {
      setActiveEnhanceTab(activeEnhanceTab - 1);
    }
  };

  // Handle apply enhancements
  const handleApplyEnhancements = () => {
    // Build enhanced prompt with all selections
    let enhancedPrompt = currentInstruction;
    
    // Add tone(s)
    if (selectedTone.length > 0) {
      enhancedPrompt += `\n\n**Communication Style:**`;
      selectedTone.forEach(tone => {
        if (tone === 'Custom' && customToneInput.trim()) {
          enhancedPrompt += `\n- Tone: ${customToneInput}`;
        } else if (tone !== 'Custom') {
          enhancedPrompt += `\n- Tone: ${tone}`;
        }
      });
    }
    
    // Add Dos
    if (selectedDos.length > 0 || dosText.trim()) {
      enhancedPrompt += `\n\n**Always Do:**`;
      selectedDos.forEach(doItem => {
        enhancedPrompt += `\n- ${doItem}`;
      });
      if (dosText.trim()) {
        enhancedPrompt += `\n- ${dosText}`;
      }
    }
    
    // Add Don'ts
    if (selectedDonts.length > 0 || dontsText.trim()) {
      enhancedPrompt += `\n\n**Never Do:**`;
      selectedDonts.forEach(dontItem => {
        enhancedPrompt += `\n- ${dontItem}`;
      });
      if (dontsText.trim()) {
        enhancedPrompt += `\n- ${dontsText}`;
      }
    }
    
    // Add Topic Focus
    if (topicFocus) {
      enhancedPrompt += `\n\n**Topic Scope:**\n- ${topicFocus === 'Open' ? 'Can discuss anything relevant' : topicFocus === 'Focused' ? 'Stays close to expertise' : 'Only discusses defined topics'}`;
    }
    
    // Add Handling Unknowns
    if (handlingUnknowns.length > 0 || customUnknown.trim()) {
      enhancedPrompt += `\n\n**When Uncertain:**`;
      handlingUnknowns.forEach(option => {
        enhancedPrompt += `\n- ${option}`;
      });
      if (customUnknown.trim()) {
        enhancedPrompt += `\n- ${customUnknown}`;
      }
    }
    
    // Add Response Structure
    if (responseStructure.length > 0 || customStructure.trim()) {
      enhancedPrompt += `\n\n**Response Format:**`;
      responseStructure.forEach(format => {
        enhancedPrompt += `\n- ${format}`;
      });
      if (customStructure.trim()) {
        enhancedPrompt += `\n- ${customStructure}`;
      }
    }
    
    // Update the instruction
    setInstruction(enhancedPrompt);
    
    // Mark that enhancements have been applied
    setHasAppliedEnhancements(true);
    
    // Close the enhance mode
    setShowEnhanceMode(false);
    setEnhanceLoadingStep(null);
    setActiveEnhanceTab(0);
    setCanContinueTab(false);
    
    toast('Enhancements Applied', {
      description: `${improvementsList.length} improvements have been added to your prompt.`,
    });
  };

  // Handle skip tab
  const handleSkipTab = () => {
    if (activeEnhanceTab < 6) {
      setActiveEnhanceTab(activeEnhanceTab + 1);
      setCanContinueTab(false);
    } else {
      handleCloseEnhanceMode();
    }
  };

  // Update canContinueTab when selections change
  useEffect(() => {
    if (activeEnhanceTab === 0) {
      // Tab 1: At least one tone selected
      setCanContinueTab(selectedTone.length > 0);
    } else if (activeEnhanceTab === 1) {
      // Tab 2: At least one Do selected
      setCanContinueTab(selectedDos.length > 0 || dosText.trim() !== '');
    } else if (activeEnhanceTab === 2) {
      // Tab 3: At least one Don't selected
      setCanContinueTab(selectedDonts.length > 0 || dontsText.trim() !== '');
    } else if (activeEnhanceTab === 3) {
      // Tab 4: Topic focus selected
      setCanContinueTab(topicFocus !== '');
    } else if (activeEnhanceTab === 4) {
      // Tab 5: At least one unknown handling selected
      setCanContinueTab(handlingUnknowns.length > 0 || customUnknown.trim() !== '');
    } else if (activeEnhanceTab === 5) {
      // Tab 6: At least one response structure selected
      setCanContinueTab(responseStructure.length > 0 || customStructure.trim() !== '');
    } else if (activeEnhanceTab === 6) {
      // Tab 7: Always allow continue (summary tab)
      setCanContinueTab(true);
    }
  }, [activeEnhanceTab, selectedTone, selectedDos, dosText, selectedDonts, dontsText, topicFocus, handlingUnknowns, customUnknown, responseStructure, customStructure]);

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
    console.debug("Share clicked");
  };

  const handleSaveToTest = async () => {
    if (!isPersonaReady) return;

    setIsSaving(true);
    try {
      // Collect all persona data for testing
      const personaData = {
        name: personaName,
        model: selectedModel,
        systemInstruction: currentInstruction,
        temperature: temperature[0],
        knowledgeFiles: uploadedFiles.map((f) => ({
          id: f.id,
          name: f.name,
          url: f.url,
          type: f.type,
        })),
        tone: selectedTone,
        dos: [...selectedDos, dosText].filter(Boolean),
        donts: [...selectedDonts, dontsText].filter(Boolean),
      };

      console.debug("Saving persona for testing:", personaData);

      // Enable testing mode
      setIsTesting(true);

      toast("Ready to test", {
        description: "You can now test your persona in the chat!",
      });
    } catch (error) {
      console.error("Error preparing persona for testing:", error);
      toast.error("Error", {
        description: "Failed to prepare persona. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinishBuilding = async () => {
    if (!isPersonaReady) return;

    setIsSaving(true);
    try {
      // Get image file: prefer uploaded file, fallback to avatar from sessionStorage
      let imageFile = uploadedFiles.find((f) => f.type === "image")?.file;

      // If no uploaded image but we have avatarUrl (data URL from /personas/new page)
      if (!imageFile && avatarUrl && avatarUrl.startsWith("data:")) {
        console.debug("Converting data URL to file for persona avatar");
        console.debug("Data URL preview:", avatarUrl.substring(0, 100));
        imageFile = dataUrlToFile(avatarUrl, "persona-avatar.png") ?? undefined;
        if (imageFile) {
          console.debug(
            "Converted to file:",
            imageFile.name,
            imageFile.size,
            "bytes, type:",
            imageFile.type,
          );
        } else {
          console.error("Failed to convert data URL to file");
        }
      }

      console.debug(
        "Saving persona with image:",
        imageFile
          ? `${imageFile.name} (${imageFile.size} bytes, type: ${imageFile.type})`
          : "no image",
      );

      const personaPayload = {
        name: personaName.trim(),
        prompt: currentInstruction.trim(),
        model_id: String(
          resolvedSelectedModel?.modelId ??
          resolvedSelectedModel?.id ??
          (Number.isFinite(Number(selectedModel)) ? Number(selectedModel) : "")
        ),
        status: "test" as const,
        temperature: temperature[0],
        image: imageFile,
      };
      const documentFile = uploadedFiles
        .find((f) => f.type === "pdf")?.file;

      let result;

      // Check if we're updating an existing persona or creating a new one
      if (createdPersonaId) {
        // Update existing persona
        console.debug("Updating persona:", createdPersonaId);
        result = await updatePersona(createdPersonaId, {
          ...personaPayload,
          file: documentFile,
        });
        console.debug("Persona updated successfully!");

        // Show success toast for update
        toast("Persona Updated", {
          description: "Your persona has been updated successfully.",
        });

        // Navigate to persona chat page after update
        setTimeout(() => {
          router.push(`/personas/${createdPersonaId}/chat`);
        }, 1000);
      } else {
        // Create new persona
        result = await createPersona({
          ...personaPayload,
          file: documentFile,
        });
        console.debug("Persona created successfully!");
        
        setCreatedPersonaId(result.id);
        setHasFinishedBuilding(true);
        setShowSuccessDialog(true);
      }

      console.debug("✅ Persona ID:", result.id);
      console.debug("✅ Persona imageUrl:", result.image_url);
      console.debug("✅ Full imageUrl:", getFullAvatarUrl(result.image_url));

      // Clean up avatar from sessionStorage after successful save
      try {
        sessionStorage.removeItem("personaAvatar");
        console.debug("Cleaned up avatar from sessionStorage");
      } catch (error) {
        console.error("Failed to clean up sessionStorage:", error);
      }
    } catch (error: unknown) {
      console.error("Failed to save persona:", error);

      let errorMessage = "Failed to save persona. Please try again.";

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }

      // Try to parse JSON error response
      try {
        const parsed = JSON.parse(errorMessage);
        // FastAPI returns detail as an array of validation error objects
        const detail = parsed.detail;
        if (Array.isArray(detail) && detail.length > 0) {
          errorMessage = detail.map((d: Record<string, unknown>) => d.msg ?? d.message ?? String(d)).join(", ");
        } else if (typeof detail === "string") {
          errorMessage = detail;
        } else if (parsed.message) {
          errorMessage = String(parsed.message);
        } else if (Array.isArray(parsed.name) && parsed.name.length > 0) {
          errorMessage = String(parsed.name[0]);
        }
      } catch {
        // Not JSON, use as-is
      }

      const lowerError = errorMessage.toLowerCase();

      // Check for duplicate name error
      if (
        lowerError.includes("name") &&
        (lowerError.includes("exist") ||
          lowerError.includes("duplicate") ||
          lowerError.includes("already") ||
          lowerError.includes("unique"))
      ) {
        toast.error("Name Already Exists", {
          description: `A persona with the name "${personaName}" already exists. Please choose a different name.`,
        });
      } else {
        toast.error("Error", {
          description: errorMessage,
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    // If editing an existing persona (has personaId) or in chat mode, go back to personaAdmin
    const personaId = searchParams.get("personaId");
    const chatMode = searchParams.get("chatMode");

    if (hasFinishedBuilding || personaId || chatMode === "true" || isChatMode) {
      router.push("/personas/admin");
    } else {
      router.push("/personas/new");
    }
  };

  // Get selected model for display
  const selectedModelData = resolvedSelectedModel;

  return (
    <AppLayout>
      <>
        {/* isChatMode */}
        {isChatMode ? (
          // Chat Mode View
          <div className="flex flex-col h-full items-center py-4">
            {/* Top Action Bar */}
            <div className="max-w-[1072px] w-full flex items-center justify-between mb-4">
              <Button
                onClick={() => {
                  // If coming from personaAdmin (has personaId), go back to dashboard
                  const personaId = searchParams.get("personaId");
                  if (personaId) {
                    router.push("/personas/admin");
                  } else {
                    setIsChatMode(false);
                  }
                }}
                className="flex items-center gap-2 h-9 px-4 bg-black text-white hover:bg-gray-900 rounded-lg"
              >
                <ChevronLeft className="h-4 w-4" />
                {searchParams.get("personaId")
                  ? "Back to Dashboard"
                  : "Back to Edit"}
              </Button>

              <Button
                onClick={() => setShowShareDialog(true)}
                variant="outline"
                className="flex items-center gap-2 h-9 px-4 rounded-lg border-main-border text-black hover:text-gray-900"
                style={{ color: "#000000" }}
              >
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            </div>

            {/* Chat Container */}
            <div
              className="w-[1072px] min-w-[1072px] max-w-[1072px] h-full max-h-[calc(100vh-140px)]"
              style={{
                borderRadius: "30px",
                padding: "12px",
                borderWidth: "1px",
                backgroundColor: "#FFFFFF",
                borderColor: "#D9D9D9",
                boxShadow: "0px 2px 4px 0px #19213D14",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <ChatInterface
                messages={chatMessages}
                setMessages={setChatMessages}
                selectedModel={previewModel}
                hidePersonaButton={true}
                hideAttachButton={true}
                disablePinning={true}
                disableSources={true}
                personaTestConfig={{
                  personaId: createdPersonaId ?? undefined,
                  prompt: currentInstruction,
                  modelId:
                    previewModel?.modelId ??
                    previewModel?.id ??
                    (Number.isFinite(Number(selectedModel))
                      ? Number(selectedModel)
                      : null),
                }}
                customEmptyState={
                  <div className="flex flex-col items-center justify-center gap-4">
                    <div className="relative w-[146px] h-[146px]">
                      <div
                        className="absolute top-1/2 left-1/2 -translate-1/2"
                        style={{
                          width: "81px",
                          height: "81px",
                          borderRadius: "50%",
                          overflow: "hidden",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: "#FFFFFF",
                        }}
                      >
                        <img
                          src={(() => {
                            const uploadedImage = uploadedFiles.find(
                              (f) => f.type === "image",
                            )?.url;
                            const resolvedAvatar = getFullAvatarUrl(avatarUrl);
                            const finalSrc =
                              uploadedImage ||
                              resolvedAvatar ||
                              "/avatars/personaAvatarPlaceHolder.svg";
                            console.debug(
                              "🖼️ Avatar display - uploaded:",
                              !!uploadedImage,
                              "avatar:",
                              !!resolvedAvatar,
                              "final:",
                              finalSrc.substring(0, 100),
                            );
                            return finalSrc;
                          })()}
                          alt="Persona"
                          className="rounded-full border-2 border-main-border"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                            display: "block",
                          }}
                        />
                      </div>
                      {Array.from({ length: 7 }).map((_, index) => {
                        const angle = (index / 7) * 360;
                        const radian = (angle * Math.PI) / 180;
                        const radius = 54;
                        const x = Math.cos(radian) * radius;
                        const y = Math.sin(radian) * radius;
                        return (
                          <div
                            key={index}
                            className="-rotate-90 absolute top-1/2 left-1/2 -translate-1/2 h-2 w-2 rounded-full bg-[#009951]"
                            style={{
                              transform: `translate(${x}px, ${y}px)`,
                            }}
                          />
                        );
                      })}
                    </div>

                    <div className="text-center">
                      <p className="text-sm font-medium text-[#1E1E1E]">
                        <span className="font-clash font-medium text-[29px]">
                          {personaName}
                        </span>
                        <br /> is ready!
                      </p>
                      <p className="font-normal text-sm text-[#333333] mt-1">
                        Start chatting to test your persona
                      </p>
                    </div>
                  </div>
                }
              />
            </div>
          </div>
        ) : (
          // Edit Mode View
          <div
            className={cn(
              chatStyles.customScrollbar,
              "flex items-start justify-center overflow-y-auto",
            )}
          >
            <div className={cn("max-w-[1072px] py-4")}>
              <div className={styles.contentWrapper}>
                <div className={styles.mainContent}>
                  {/* Left Panel - Configuration */}
                  <div className={styles.leftPanel}>
                    {/* Header Row with Back and Actions - Left */}
                    <div className={styles.headerRow}>
                      <div className={styles.headerLeft}>
                        {!searchParams.get("personaId") && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              router.push(
                                hasFinishedBuilding ? "/personas" : "/personas/new",
                              );
                            }}
                            className={`${styles.backButton} px-3!`}
                          >
                            <ChevronLeft className="h-4 w-4" />
                            {hasFinishedBuilding ? "Go to home" : "Back"}
                          </Button>
                        )}
                      </div>
                      <div className={styles.headerActions}>
                        {/* <Button
                      variant="outline"
                      onClick={handleShare}
                      className={styles.shareButton}
                    >
                      <Share2 className="h-4 w-4" />
                      Share
                    </Button> */}
                      </div>
                    </div>
                    {/* Persona Name Row (aligns with chat column start) */}
                    <h2 className={styles.personaNameTitle}>{personaName}</h2>
                    {/* Model Selector */}
                    <div className={styles.fieldGroup}>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="model" className={styles.label}>
                          Model
                        </Label>
                        <Info className="h-4 w-4 text-[#000000]" />
                      </div>

                      <Select
                        value={selectedModel}
                        onValueChange={setSelectedModel}
                        disabled={isLoadingModels}
                      >
                        <SelectTrigger
                          id="model"
                          className={styles.selectTrigger}
                        >
                          <SelectValue placeholder="Select Model">
                            <div className={styles.modelSelectorContent}>
                              <div className={styles.modelSelectorLeft}>
                                {selectedModelData ? (
                                  <div className="px-2 flex items-center gap-2">
                                    <Image
                                      src={getModelIcon(
                                        selectedModelData.companyName,
                                        selectedModelData.modelName,
                                      )}
                                      alt={
                                        selectedModelData.companyName ||
                                        "Model icon"
                                      }
                                      width={20}
                                      height={20}
                                      className={styles.modelIcon}
                                    />
                                    <span>{selectedModelData.modelName}</span>
                                  </div>
                                ) : (
                                  <span className={cn(styles.placeholderText)}>
                                    {isLoadingModels
                                      ? "Loading models..."
                                      : "Select Model"}
                                  </span>
                                )}
                              </div>
                            </div>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className={styles.selectContent}>
                          {models.length === 0 && (
                            <div className="px-3 py-2 text-sm text-[#6B7280]">
                              {isLoadingModels
                                ? "Loading..."
                                : "No models available"}
                            </div>
                          )}
                          {models.map((model) => {
                            const value = String(
                              model.modelId ?? model.id ?? model.modelName,
                            );
                            return (
                              <SelectItem
                                key={value}
                                value={value}
                                className={styles.selectItem}
                              >
                                <div className={styles.modelOption}>
                                  <Image
                                    src={getModelIcon(
                                      model.companyName,
                                      model.modelName,
                                    )}
                                    alt={model.companyName || "Model"}
                                    width={20}
                                    height={20}
                                    className={styles.modelOptionIcon}
                                  />
                                  <span>{model.modelName}</span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* System Instruction */}
                    <div className={styles.fieldGroup}>
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor="system-instruction"
                          className={styles.label}
                        >
                          System Instruction
                        </Label>
                        <Info className="h-4 w-4 text-[#000000]" />
                      </div>
                      <div
                        className={cn(
                          styles.textareaWrapper,
                          "relative",
                          chatStyles.customScrollbar,
                        )}
                      >
                        <div className={`${styles.textareaContainer}`}>
                          <div
                            ref={textareaContentRef}
                            className={cn(
                              styles.textareaContentWrapper,
                              isTextareaScrolled && styles.textareaScrolled,
                              chatStyles.customScrollbar,
                            )}
                          >
                            <Textarea
                              id="system-instruction"
                              value={currentInstruction}
                              onChange={(e) =>
                                handleInstructionChange(e.target.value)
                              }
                              className={`${styles.textarea} customScrollbar2`}
                              placeholder="Describe your persona’s goals, expertise, tone, and responsibilities. Example: ‘You are a Lead AI Researcher who specializes in…’"
                            />

                            {/* Refinement Section - MOVED TO ENHANCE MODE OVERLAY */}
                            {false && hasEnhancedContent && (
                              <>
                                {/* Step 1: Tone Selection */}
                                {currentStep === REFINEMENT_STEPS.TONE && (
                                  <div className={styles.refinementSection}>
                                    <h3 className={styles.refinementTitle}>
                                      Let&apos;s refine your persona in 1/3 steps
                                    </h3>
                                    <p className={styles.refinementSubtitle}>
                                      We detected a few areas that could be
                                      clearer
                                    </p>
                                    <div
                                      className={styles.toneSelectionContainer}
                                    >
                                      <p className={styles.toneQuestion}>
                                        How should the persona communicate?
                                      </p>
                                      <div className={styles.toneButtons}>
                                        {TONE_OPTIONS.map((tone) => (
                                          <Button
                                            key={tone}
                                            variant="outline"
                                            onClick={() =>
                                              handleToneSelect(tone)
                                            }
                                            className={cn(
                                              styles.toneButton,
                                              selectedTone.includes(tone) &&
                                                styles.toneButtonSelected,
                                            )}
                                          >
                                            {tone}
                                          </Button>
                                        ))}
                                        <Button
                                          variant="outline"
                                          onClick={() =>
                                            handleToneSelect("Custom")
                                          }
                                          className={cn(
                                            styles.toneButton,
                                            selectedTone.includes("Custom") &&
                                              styles.toneButtonSelected,
                                          )}
                                        >
                                          <Pencil className="h-4 w-4" />
                                          Custom
                                        </Button>
                                      </div>
                                      {showCustomInput && (
                                        <div
                                          className={
                                            styles.customToneInputContainer
                                          }
                                        >
                                          <div
                                            className={
                                              styles.customToneInputWrapper
                                            }
                                          >
                                            <Input
                                              type="text"
                                              placeholder="Eg. Supportive"
                                              value={customToneInput}
                                              onChange={(e) =>
                                                handleCustomToneChange(
                                                  e.target.value,
                                                )
                                              }
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                  handleCustomToneSubmit();
                                                }
                                              }}
                                              className={styles.customToneInput}
                                            />
                                            <ChevronUp
                                              className={styles.customToneIcon}
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Step 2: Dos Section */}
                                {currentStep === REFINEMENT_STEPS.DOS && (
                                  <div
                                    className={`overflow-x-auto ${styles.dosDontsSection}`}
                                  >
                                    <h3 className={styles.refinementTitle}>
                                      Let&apos;s refine your persona in 2/3 steps
                                    </h3>
                                    <h4 className={styles.dosDontsTitle}>
                                      Dos (what do you want the persona to
                                      always do?)
                                    </h4>
                                    <Textarea
                                      placeholder="Type your message here."
                                      value={dosText}
                                      onChange={(e) =>
                                        setDosText(e.target.value)
                                      }
                                      className={styles.dosDontsTextarea}
                                      rows={3}
                                    />
                                    {suggestedDos.length > 0 && (
                                      <>
                                        <p className={styles.suggestedTitle}>
                                          Select from Suggested
                                        </p>
                                        <div
                                          className={styles.suggestedButtons}
                                        >
                                          {suggestedDos.map((dos) => (
                                            <button
                                              key={dos}
                                              
                                              onClick={() =>
                                                handleDosToggle(dos)
                                              }
                                              className={cn(
                                                styles.suggestedButton,
                                                selectedDos.includes(dos) &&
                                                  styles.suggestedButtonSelected,
                                              )}
                                            >
                                              {dos}
                                            </button>
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
                                      Let&apos;s refine your persona in 3/3 steps
                                    </h3>
                                    <h4 className={styles.dosDontsTitle}>
                                      Don&apos;ts (what should the persona never do?)
                                    </h4>
                                    <Textarea
                                      placeholder="Type your message here."
                                      value={dontsText}
                                      onChange={(e) =>
                                        setDontsText(e.target.value)
                                      }
                                      className={styles.dosDontsTextarea}
                                      rows={3}
                                    />
                                    {suggestedDonts.length > 0 && (
                                      <>
                                        <p className={styles.suggestedTitle}>
                                          Select from Suggested
                                        </p>
                                        <div
                                          className={styles.suggestedButtons}
                                        >
                                          {suggestedDonts.map((dont) => (
                                            <button
                                              key={dont}
                                              onClick={() =>
                                                handleDontsToggle(dont)
                                              }
                                              className={cn(
                                                styles.suggestedButton,
                                                selectedDonts.includes(dont) &&
                                                  styles.suggestedButtonSelected,
                                              )}
                                            >
                                              {dont}
                                            </button>
                                          ))}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}
                              </>
                            )}

                            {isRefinementComplete && (
                              <p className={styles.refinementSubtitle}>
                                You are all set with enhancements!
                              </p>
                            )}

                            <div className={styles.textareaActions}>
                              <Button
                                onClick={handleEnhance}
                                disabled={isEnhancing || !currentInstruction.trim()}
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
                                    {hasAppliedEnhancements ? 'Enhance Again' : 'Enhance'}
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>

                        {showEnhanceMode && (
                          <div
                            className="absolute inset-0 z-20 bg-white border border-main-[#D4D4D4] rounded-[18px] flex items-center justify-center p-2"
                          >
                            <div
                              className="max-w-full w-full max-h-full h-full bg-[#F5F5F5] border border-main-[#D4D4D4] rounded-[14px] relative overflow-hidden"
                            >
                              {/* Loading State */}
                              {enhanceLoadingStep && (
                                <div className="w-full h-full flex items-center justify-center p-6">
                                  <div className="w-full max-w-[440px] rounded-2xl border border-[#E7E7E7] bg-white/80 backdrop-blur-sm shadow-sm p-5">
                                    <div className="flex items-center gap-3">
                                      <div className="h-10 w-10 rounded-xl bg-[#0A0A0A] text-white flex items-center justify-center">
                                        <Sparkles className="h-5 w-5 animate-pulse" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="font-clash font-semibold text-[16px] tracking-[-0.02em] text-[#0A0A0A]">
                                          Enhance Mode
                                        </div>
                                        <div className="text-[12px] text-[#666666]">
                                          {enhanceLoadingStep === 'analyzing'
                                            ? 'Analysing the prompt…'
                                            : enhanceLoadingStep === 'drafting'
                                              ? 'Drafting smarter improvements…'
                                              : 'Applying enhancements…'}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="mt-4">
                                      <div className="h-1.5 w-full rounded-full bg-[#EFEFEF] overflow-hidden">
                                        <div
                                          className="h-full bg-[#0A0A0A] transition-all duration-500"
                                          style={{
                                            width:
                                              enhanceLoadingStep === 'analyzing'
                                                ? '33%'
                                                : enhanceLoadingStep === 'drafting'
                                                  ? '66%'
                                                  : '92%',
                                          }}
                                        />
                                      </div>

                                      <div className="mt-3 flex items-center justify-between text-[11px]">
                                        <span className={enhanceLoadingStep === 'analyzing' ? 'text-[#0A0A0A] font-medium' : 'text-[#8A8A8A]'}>
                                          Analyse
                                        </span>
                                        <span className={enhanceLoadingStep === 'drafting' ? 'text-[#0A0A0A] font-medium' : 'text-[#8A8A8A]'}>
                                          Draft
                                        </span>
                                        <span className={enhanceLoadingStep === 'enhancing' ? 'text-[#0A0A0A] font-medium' : 'text-[#8A8A8A]'}>
                                          Enhance
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Tab Interface */}
                              {!enhanceLoadingStep && (
                                <div className="w-full h-full flex flex-col p-2">
                                  {/* Header */}
                                  <div className="flex items-center justify-between mb-6">
                                    <h2
                                      className="font-clash font-medium text-sm flex items-center gap-1.5"
                                      style={{
                                        letterSpacing: "-0.02em",
                                        color: "#28231D",
                                      }}
                                    >
                                          <Sparkles size={14} />
                                      <span className="text-[#0A0A0A]">Enhance Mode</span>
                                    </h2>
                                    <button
                                      onClick={handleCloseEnhanceMode}
                                      className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                                    >
                                      <X
                                        size={20}
                                        className="text-[#666666]"
                                      />
                                    </button>
                                  </div>

                                  {/* Tab Content */}
                                  <div className="flex-1 overflow-hidden mb-4">
                                    {/* Tab 1: Tone Selection */}
                                    {activeEnhanceTab === 0 && (
                                      <div className="h-full flex flex-col text-center">
                                        <h3 className="font-medium text-base text-[#0A0A0A] mb-1">
                                          How should this persona sound?
                                        </h3>
                                        <p className="text-[11px] text-[#666666] mb-3">
                                          Pick up to two for a blended tone.
                                        </p>
                                        <div className="flex-1 overflow-y-auto customScrollbar2">
                                          <div className="flex items-center justify-center flex-wrap gap-3">
                                            {TONE_OPTIONS.map((tone) => (
                                              <button
                                                key={tone}
                                                onClick={() =>
                                                  handleToneToggle(tone)
                                                }
                                                className={cn(
                                                  "cursor-pointer h-[36px] px-3 rounded-lg border-2 transition-all duration-200",
                                                  "flex items-center justify-center",
                                                  "text-sm font-medium",
                                                  selectedTone.includes(tone)
                                                    ? "bg-[#0a0a0a] text-white border-[#0a0a0a]"
                                                    : "bg-white text-[#0a0a0a] border-[#D9D9D9] hover:bg-[#0a0a0a] hover:text-white",
                                                )}
                                              >
                                                {tone}
                                              </button>
                                            ))}
                                            <button
                                              onClick={() =>
                                                handleToneToggle("Custom")
                                              }
                                              className={cn(
                                                "cursor-pointer h-[36px] px-3 rounded-lg border transition-all duration-200",
                                                "flex items-center justify-center gap-1.5",
                                                "text-sm font-medium",
                                                selectedTone.includes("Custom")
                                                ? "bg-[#0a0a0a] text-white border-[#0a0a0a]"
                                                : "bg-white text-[#0a0a0a] border-[#D9D9D9] hover:bg-[#0a0a0a] hover:text-white",
                                              )}
                                            >
                                              <Pencil size={16} />
                                              Custom
                                            </button>
                                          </div>
                                          {showCustomInput &&
                                            selectedTone.includes("Custom") && (
                                              <div className="mt-4">
                                                <Input
                                                  type="text"
                                                  placeholder="Eg. Supportive"
                                                  value={customToneInput}
                                                  onChange={(e) =>
                                                    handleCustomToneChange(
                                                      e.target.value,
                                                    )
                                                  }
                                                  onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                      handleCustomToneSubmit();
                                                    }
                                                  }}
                                                  className="w-full h-11 bg-white border border-[#D9D9D9] rounded-lg px-4"
                                                />
                                              </div>
                                            )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Tab 2: Dos Selection */}
                                    {activeEnhanceTab === 1 && (
                                      <div className="h-full flex flex-col text-center">
                                        <h3 className="font-medium text-[20px] text-[#0A0A0A] mb-1">
                                          What should this persona always do?
                                        </h3>
                                        <p className="text-[11px] text-[#666666] mb-3">
                                          Select all that apply, or write your
                                          own.
                                        </p>
                                        <div
                                          className="flex-1 overflow-y-auto customScrollbar2"
                                          style={{ maxHeight: "320px" }}
                                        >
                                          <div className="grid grid-cols-2 gap-3">
                                            {suggestedDos.map(
                                              (doItem, index) => (
                                                <button
                                                  key={index}
                                                  onClick={() =>
                                                    handleDosToggle(doItem)
                                                  }
                                                  className={cn(
                                                    "cursor-pointer h-auto min-h-[28px] px-3 py-1.5 rounded-lg border-2 transition-all duration-200",
                                                    "flex items-center justify-start text-left",
                                                    "text-sm font-medium",
                                                    selectedDos.includes(
                                                      doItem,
                                                    )
                                                      ? "bg-[#0a0a0a] text-white border-[#0a0a0a]"
                                                      : "bg-white text-[#0a0a0a] border-[#D9D9D9] hover:bg-[#0a0a0a] hover:text-white",
                                                  )}
                                                >
                                                  {doItem}
                                                </button>
                                              ),
                                            )}
                                            <button
                                              onClick={() => {
                                                setShowCustomDos(true);
                                                setTimeout(() => {
                                                  const input =
                                                    document.getElementById(
                                                      "custom-dos-input",
                                                    ) as HTMLInputElement;
                                                  input?.focus();
                                                }, 10);
                                              }}
                                              className={cn(
                                                "cursor-pointer h-[36px] px-3 rounded-lg border transition-all duration-200",
                                                "flex items-center justify-center gap-1.5",
                                                "text-sm font-medium",
                                                showCustomDos
                                                  ? "bg-[#0a0a0a] text-white border-[#0a0a0a]"
                                                  : "bg-white text-[#0a0a0a] border-[#D9D9D9] hover:bg-[#0a0a0a] hover:text-white",
                                              )}
                                            >
                                              <Pencil size={16} />
                                              Custom
                                            </button>
                                          </div>
                                          {showCustomDos && (
                                            <div className="mt-4">
                                              <Textarea
                                                id="custom-dos-input"
                                                placeholder="Add your own DOs..."
                                                value={dosText}
                                                onChange={(e) =>
                                                  setDosText(e.target.value)
                                                }
                                                className="w-full min-h-[80px] px-4 py-3 bg-white border border-[#D9D9D9] rounded-lg resize-none"
                                              />
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Tab 3: Donts Selection */}
                                    {activeEnhanceTab === 2 && (
                                      <div className="h-full flex flex-col text-center">
                                        <h3 className="font-medium text-[20px] text-[#0A0A0A] mb-1">
                                          What should this persona never do?
                                        </h3>
                                        <p className="text-[11px] text-[#666666] mb-3">
                                          Select all that apply, or write your
                                          own.
                                        </p>
                                        <div
                                          className="flex-1 overflow-y-auto customScrollbar2"
                                          style={{ maxHeight: "320px" }}
                                        >
                                          <div className="grid grid-cols-2 gap-3">
                                            {suggestedDonts.map(
                                              (dontItem, index) => (
                                                <button
                                                  key={index}
                                                  onClick={() =>
                                                    handleDontsToggle(dontItem)
                                                  }
                                                  className={cn(
                                                    "cursor-pointer h-auto min-h-[28px] px-3 py-1.5 rounded-lg border-2 transition-all duration-200",
                                                    "flex items-center justify-start text-left",
                                                    "text-sm font-medium",
                                                    selectedDonts.includes(
                                                      dontItem,
                                                    )
                                                      ? "bg-[#0a0a0a] text-white border-[#0a0a0a]"
                                                      : "bg-white text-[#0a0a0a] border-[#D9D9D9] hover:bg-[#0a0a0a] hover:text-white",
                                                  )}
                                                >
                                                  {dontItem}
                                                </button>
                                              ),
                                            )}
                                            <button
                                              onClick={() => {
                                                setShowCustomDonts(true);
                                                setTimeout(() => {
                                                  const input =
                                                    document.getElementById(
                                                      "custom-donts-input",
                                                    ) as HTMLTextAreaElement;
                                                  input?.focus();
                                                }, 10);
                                              }}
                                              className={cn(
                                                "cursor-pointer h-[36px] px-4 rounded-lg border transition-all duration-200",
                                                "flex items-center justify-center gap-2",
                                                "text-sm font-medium",
                                                showCustomDonts
                                                  ? "bg-[#0a0a0a] text-white border-[#0a0a0a]"
                                                  : "bg-white text-[#0a0a0a] border-[#D9D9D9] hover:bg-[#0a0a0a] hover:text-white",
                                              )}
                                            >
                                              <Pencil size={16} />
                                              Custom
                                            </button>
                                          </div>
                                          {showCustomDonts && (
                                            <div className="mt-4">
                                              <Textarea
                                                id="custom-donts-input"
                                                placeholder="Add your own DONTs..."
                                                value={dontsText}
                                                onChange={(e) =>
                                                  setDontsText(e.target.value)
                                                }
                                                className="w-full min-h-[80px] px-4 py-3 bg-white border border-[#D9D9D9] rounded-lg resize-none"
                                              />
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Tabs 4-7: Implementation */}
                                    {/* Tab 4: Topic Focus */}
                                    {activeEnhanceTab === 3 && (
                                      <div className="h-full flex flex-col text-center">
                                        <h3 className="font-medium text-[20px] text-[#0A0A0A] mb-1">
                                          Should this persona stick to specific topics?
                                        </h3>
                                        <p className="text-[11px] text-[#666666] mb-3">
                                          Keeps conversation focused and on-brand.
                                        </p>
                                        <div className="grid grid-cols-2 gap-4">
                                          <button
                                            onClick={() =>
                                              setTopicFocus("Open")
                                            }
                                            className={cn(
                                              "cursor-pointer h-auto px-4 py-2 rounded-lg border-2 transition-all duration-200",
                                              "flex flex-col items-start text-left",
                                              topicFocus === "Open"
                                                ? "bg-[#0a0a0a] text-white border-[#0a0a0a]"
                                                : "bg-white text-[#0a0a0a] border-[#D9D9D9] hover:bg-[#0a0a0a] hover:text-white",
                                            )}
                                          >
                                            <span className="font-medium text-sm">
                                              Open
                                            </span>
                                            <span
                                              className={cn(
                                                "text-[12px] mt-0.5",
                                                topicFocus === "Open"
                                                  ? "text-white/80"
                                                  : "text-[#666666]",
                                              )}
                                            >
                                              Can discuss anything relevant
                                            </span>
                                          </button>
                                          <button
                                            onClick={() =>
                                              setTopicFocus("Focused")
                                            }
                                            className={cn(
                                              "cursor-pointer h-auto px-4 py-2 rounded-lg border-2 transition-all duration-200",
                                              "flex flex-col items-start text-left",
                                              topicFocus === "Focused"
                                                ? "bg-[#0a0a0a] text-white border-[#0a0a0a]"
                                                : "bg-white text-[#0a0a0a] border-[#D9D9D9] hover:bg-[#0a0a0a] hover:text-white",
                                            )}
                                          >
                                            <span className="font-medium text-sm">
                                              Focused
                                            </span>
                                            <span
                                              className={cn(
                                                "text-[12px] mt-0.5",
                                                topicFocus === "Focused"
                                                  ? "text-white/80"
                                                  : "text-[#666666]",
                                              )}
                                            >
                                              Stays close to its expertise
                                            </span>
                                          </button>
                                          <button
                                            onClick={() =>
                                              setTopicFocus("Strict")
                                            }
                                            className={cn(
                                              "cursor-pointer h-auto px-4 py-2 rounded-lg border-2 transition-all duration-200",
                                              "flex flex-col items-start text-left",
                                              topicFocus === "Strict"
                                                ? "bg-[#0a0a0a] text-white border-[#0a0a0a]"
                                                : "bg-white text-[#0a0a0a] border-[#D9D9D9] hover:bg-[#0a0a0a] hover:text-white",
                                            )}
                                          >
                                            <span className="font-medium text-sm">
                                              Strict
                                            </span>
                                            <span
                                              className={cn(
                                                "text-[12px] mt-0.5",
                                                topicFocus === "Strict"
                                                  ? "text-white/80"
                                                  : "text-[#666666]",
                                              )}
                                            >
                                              Only discusses defined topics
                                            </span>
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    {/* Tab 5: Handling Unknowns */}
                                    {activeEnhanceTab === 4 && (
                                      <div className="h-full flex flex-col text-center">
                                        <h3 className="font-medium text-[20px] text-[#0A0A0A] mb-1">
                                          When the persona doesn&apos;t know something...
                                        </h3>
                                        <p className="text-[11px] text-[#666666] mb-3">
                                          How it handles gaps matters for trust.
                                        </p>
                                        <div
                                          className="flex-1 overflow-y-auto customScrollbar2"
                                          style={{ maxHeight: "320px" }}
                                        >
                                          <div className="grid grid-cols-2 gap-2">
                                            {[
                                              "Admit it honestly",
                                              "Suggest alternatives",
                                              "Ask for more context",
                                              "Best guess + disclaimer",
                                            ].map((option) => (
                                              <button
                                                key={option}
                                                onClick={() => {
                                                  if (
                                                    handlingUnknowns.includes(
                                                      option,
                                                    )
                                                  ) {
                                                    setHandlingUnknowns(
                                                      handlingUnknowns.filter(
                                                        (h) => h !== option,
                                                      ),
                                                    );
                                                  } else {
                                                    setHandlingUnknowns([
                                                      ...handlingUnknowns,
                                                      option,
                                                    ]);
                                                  }
                                                }}
                                                    className={cn(
                                                      "cursor-pointer h-auto min-h-[36px] px-3 py-1.5 rounded-lg border-2 transition-all duration-200",
                                                      "flex items-center justify-start text-left",
                                                      "text-sm font-medium",
                                                  handlingUnknowns.includes(
                                                    option,
                                                  )
                                                    ? "bg-[#0a0a0a] text-white border-[#0a0a0a]"
                                                    : "bg-white text-[#0a0a0a] border-[#D9D9D9] hover:bg-[#0a0a0a] hover:text-white",
                                                )}
                                              >
                                                {option}
                                              </button>
                                            ))}
                                            <button
                                              onClick={() => {
                                                setShowCustomUnknown(true);
                                                setTimeout(() => {
                                                  const input =
                                                    document.getElementById(
                                                      "custom-unknown-input",
                                                    ) as HTMLTextAreaElement;
                                                  input?.focus();
                                                }, 10);
                                              }}
                                              className={cn(
                                                "cursor-pointer h-[36px] px-3 rounded-lg border transition-all duration-200",
                                                "flex items-center justify-center gap-1.5",
                                                "text-sm font-medium",
                                                showCustomUnknown
                                                  ? "bg-[#0a0a0a] text-white border-[#0a0a0a]"
                                                  : "bg-white text-[#0a0a0a] border-[#D9D9D9] hover:bg-[#0a0a0a] hover:text-white",
                                              )}
                                            >
                                              <Pencil size={16} />
                                              Custom
                                            </button>
                                          </div>
                                          {showCustomUnknown && (
                                            <div className="mt-4">
                                              <Textarea
                                                id="custom-unknown-input"
                                                placeholder="Describe how to handle unknowns..."
                                                value={customUnknown}
                                                onChange={(e) =>
                                                  setCustomUnknown(
                                                    e.target.value,
                                                  )
                                                }
                                                className="w-full min-h-[80px] px-4 py-3 bg-white border border-[#D9D9D9] rounded-lg resize-none"
                                              />
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Tab 6: Response Structure */}
                                    {activeEnhanceTab === 5 && (
                                      <div className="h-full flex flex-col text-center">
                                        <h3 className="font-medium text-[20px] text-[#0A0A0A] mb-1">
                                          How should the persona structure its responses?
                                        </h3>
                                        <p className="text-[11px] text-[#666666] mb-3">
                                          Format affects clarity and usability.
                                        </p>
                                        <div
                                          className="flex-1 overflow-y-auto customScrollbar2"
                                          style={{ maxHeight: "320px" }}
                                        >
                                          <div className="flex flex-wrap items-center justify-center gap-2">
                                            {[
                                              "Detailed",
                                              "Concise",
                                              "Framework-based",
                                              "Bullets only",
                                              "Step-by-step",
                                            ].map((option) => (
                                              <button
                                                key={option}
                                                onClick={() => {
                                                  if (
                                                    responseStructure.includes(
                                                      option,
                                                    )
                                                  ) {
                                                    setResponseStructure(
                                                      responseStructure.filter(
                                                        (r) => r !== option,
                                                      ),
                                                    );
                                                  } else {
                                                    setResponseStructure([
                                                      ...responseStructure,
                                                      option,
                                                    ]);
                                                  }
                                                }}
                                                className={cn(
                                                  "cursor-pointer h-auto min-h-[36px] px-3 py-1.5 rounded-lg border-2 transition-all duration-200",
                                                  "flex items-center justify-start text-left",
                                                  "text-sm font-medium",
                                                  responseStructure.includes(
                                                    option,
                                                  )
                                                    ? "bg-[#0a0a0a] text-white border-[#0a0a0a]"
                                                    : "bg-white text-[#0a0a0a] border-[#D9D9D9] hover:bg-[#0a0a0a] hover:text-white",
                                                )}
                                              >
                                                {option}
                                              </button>
                                            ))}
                                            <button
                                              onClick={() => {
                                                setShowCustomStructure(true);
                                                setTimeout(() => {
                                                  const input =
                                                    document.getElementById(
                                                      "custom-structure-input",
                                                    ) as HTMLTextAreaElement;
                                                  input?.focus();
                                                }, 10);
                                              }}
                                              className={cn(
                                                "cursor-pointer h-[36px] px-3 rounded-lg border transition-all duration-200",
                                                "flex items-center justify-center gap-1.5",
                                                "text-sm font-medium",
                                                showCustomStructure
                                                  ? "bg-[#0a0a0a] text-white border-[#0a0a0a]"
                                                  : "bg-white text-[#0a0a0a] border-[#D9D9D9] hover:bg-[#0a0a0a] hover:text-white",
                                              )}
                                            >
                                              <Pencil size={16} />
                                              Custom
                                            </button>
                                          </div>
                                          {showCustomStructure && (
                                            <div className="mt-4">
                                              <Textarea
                                                id="custom-structure-input"
                                                placeholder="Describe response structure..."
                                                value={customStructure}
                                                onChange={(e) =>
                                                  setCustomStructure(
                                                    e.target.value,
                                                  )
                                                }
                                                className="w-full min-h-[80px] px-4 py-3 bg-white border border-[#D9D9D9] rounded-lg resize-none"
                                              />
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Tab 7: Summary */}
                                    {activeEnhanceTab === 6 && (
                                      <div className="h-full flex flex-col">
                                        <div className="flex flex-col items-center justify-center mb-3">
                                          <div className="w-14 h-14 rounded-lg bg-[#28231D] border-3 border-white shadow-sm flex items-center justify-center mb-2">
                                            <Check
                                              size={30}
                                              strokeWidth={4}
                                              className="text-white"
                                            />
                                          </div>
                                          <h3 className="font-medium text-base text-[#28231D] mb-1">
                                            Ready to apply
                                          </h3>
                                          <p className="text-sm text-[#666666]">
                                            {improvementsList.length}{" "}
                                            improvements will be added to your
                                            prompt
                                          </p>
                                        </div>
                                        <div className="flex-1 overflow-y-auto space-y-2 customScrollbar2">
                                          {improvementsList.map(
                                            (improvement, index) => (
                                              <div
                                                key={index}
                                                className="flex items-start gap-2 px-3 py-2 border border-[#D9D9D9] rounded-lg bg-white"
                                              >
                                                <Check
                                                  size={12}
                                                  className="text-[#28231D] mt-0.5 shrink-0"
                                                />
                                                <span className="text-sm text-[#28231D]">
                                                  {improvement}
                                                </span>
                                              </div>
                                            ),
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Tab Navigation Dots - Bottom Center */}
                                  <div className="flex items-center justify-center gap-1.5 py-2">
                                    {Array.from({ length: 7 }).map(
                                      (_, index) => (
                                        <button
                                          key={index}
                                          onClick={() =>
                                            setActiveEnhanceTab(index)
                                          }
                                          className={cn(
                                            "h-2 rounded-full transition-all duration-300",
                                            activeEnhanceTab === index
                                              ? "w-12 bg-[#28231D]"
                                              : "w-2 bg-gray-300",
                                          )}
                                          aria-label={`Tab ${index + 1}`}
                                        />
                                      ),
                                    )}
                                  </div>

                                  {/* Footer Actions */}
                                  <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                                    <div className="flex gap-1.5">
                                      {activeEnhanceTab > 0 &&
                                        activeEnhanceTab < 6 && (
                                            <Button
                                              onClick={handleBackTab}
                                              variant="ghost"
                                              className="text-sm text-[#666666] hover:text-[#0A0A0A] bg-white hover:bg-white border border-main-border shadow-sm"
                                            >
                                              Back
                                            </Button>
                                        )}
                                      {activeEnhanceTab > 0 &&
                                        activeEnhanceTab < 6 && (
                                            <Button
                                              onClick={handleSkipTab}
                                              variant="ghost"
                                              className="text-sm text-[#666666] hover:text-[#0A0A0A]"
                                            >
                                              Skip
                                            </Button>
                                        )}
                                    </div>
                                    {activeEnhanceTab === 6 ? (
                                      <div className="flex gap-1.5">
                                        <Button
                                          onClick={handleCloseEnhanceMode}
                                          variant="outline"
                                          className="px-4 py-1.5 rounded-lg text-sm font-medium border-[#D9D9D9] text-[#666666] hover:text-[#0A0A0A]"
                                        >
                                          Cancel
                                        </Button>
                                        <Button
                                          onClick={handleApplyEnhancements}
                                          className="px-4 py-1.5 rounded-lg text-sm font-medium bg-[#171717] hover:bg-[#000000] text-white"
                                        >
                                          Apply to prompt
                                        </Button>
                                      </div>
                                    ) : (
                                      <Button
                                        onClick={handleContinueTab}
                                        disabled={!canContinueTab}
                                        className={cn(
                                          "px-4 py-1.5 rounded-lg text-sm font-medium",
                                          canContinueTab
                                            ? "bg-[#171717] hover:bg-[#000000] text-white"
                                            : "bg-[#D4D4D4] cursor-not-allowed text-gray-500",
                                        )}
                                      >
                                        Continue
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Creativity Level */}
                    <div className={styles.fieldGroup}>
                      <div className={styles.sliderHeader}>
                        <Label className={styles.label}>
                          Creativity level (Temperature)
                        </Label>
                        <span
                          className={cn(
                            styles.temperatureValue,
                            styles.sliderLabel,
                          )}
                        >
                          {temperature[0].toFixed(1)}
                        </span>
                      </div>
                      <div className={styles.sliderWrapper}>
                        <Slider
                          value={temperature}
                          onValueChange={setTemperature}
                          min={MIN_TEMPERATURE}
                          max={MAX_TEMPERATURE}
                          step={TEMPERATURE_STEP}
                          className={styles.slider}
                        />
                        <div
                          className={cn(
                            styles.sliderLabels,
                            styles.sliderLabelsStacked,
                          )}
                        >
                          <div className={styles.sliderLabelGroup}>
                            <span className={styles.sliderLabel}>0</span>
                            <span className={styles.sliderLabel}>
                              (Least creative)
                            </span>
                          </div>
                          <div
                            className={cn(
                              styles.sliderLabelGroup,
                              styles.sliderLabelGroupRight,
                            )}
                          >
                            <span className={styles.sliderLabel}>1</span>
                            <span className={styles.sliderLabel}>
                              (Most creative)
                            </span>
                          </div>
                        </div>
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
                            file.type === "pdf" ? (
                              <div
                                key={file.id}
                                className={styles.uploadedFileCard}
                              >
                                {file.isUploading && (
                                  <div
                                    className={styles.uploadProgressBar}
                                    style={{
                                      width: `${file.uploadProgress || 0}%`,
                                    }}
                                  />
                                )}
                                <div className={styles.fileIconContainer}>
                                  <FileText className={styles.fileIcon} />
                                </div>
                                <div className={styles.fileInfo}>
                                  <p className={styles.fileName}>{file.name}</p>
                                  <p className={styles.fileType}>
                                    {file.isUploading
                                      ? `Uploading... ${file.uploadProgress || 0}%`
                                      : "PDF Document"}
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
                                    <svg
                                      className={styles.uploadProgressCircle}
                                      viewBox="0 0 36 36"
                                    >
                                      <circle
                                        cx="18"
                                        cy="18"
                                        r="16"
                                        fill="none"
                                        stroke="#22C55E"
                                        strokeWidth="3"
                                        strokeDasharray={`${((file.uploadProgress || 0) * 100.48) / 100}, 100.48`}
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
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Panel - Preview & Chat */}
                  <div
                    className={cn(
                      styles.rightPanel,
                      "z-10 sticky top-[15px] min-w-0 max-w-[524px] w-[524px] min-h-[80vh] max-h-[80vh] h-[80vh] flex flex-col flex-start shrink-0 gap-0",
                    )}
                  >
                    {/* Header Row with Back and Actions - Right */}
                    <div className="w-full min-h-[36px] flex items-center justify-end mb-4 bg-white">
                      <Button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          handleFinishBuilding();
                        }}
                        disabled={!isPersonaReady || isSaving}
                        className={cn(
                          styles.saveButton,
                          !isPersonaReady &&
                            "bg-[#D4D4D4] hover:bg-[#D4D4D4] cursor-not-allowed",
                          isPersonaReady && "bg-[#171717] hover:bg-[#000000]",
                        )}
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            {/* {createdPersonaId ? null : <Rocket className="h-4 w-4" />} */}
                            <span className={styles.saveButtonText}>
                              {createdPersonaId ? "Update Persona" : "Finish building"}
                            </span>
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Preview Card with Chat Interface */}
                    <div className={cn(styles.previewCard)}>
                      <ChatInterface
                        messages={chatMessages}
                        setMessages={setChatMessages}
                        selectedModel={previewModel}
                        hidePersonaButton={true}
                        disableInput={!isTesting}
                        hideAttachButton={true}
                        disablePinning={true}
                        disableSources={true}
                        personaTestConfig={
                          isTesting || isChatMode
                            ? {
                                personaId: createdPersonaId ?? undefined,
                                prompt: currentInstruction,
                                modelId:
                                  previewModel?.modelId ??
                                  previewModel?.id ??
                                  (Number.isFinite(Number(selectedModel))
                                    ? Number(selectedModel)
                                    : null),
                              }
                            : undefined
                        }
                        // For persona test: do not share chat history with other boards
                        customEmptyState={
                          <div className="flex flex-col items-center justify-center gap-2">
                            <div className="relative w-[146px] h-[146px]">
                              <div
                                style={{
                                  position: "absolute",
                                  top: "50%",
                                  left: "50%",
                                  transform: "translate(-50%, -50%)",
                                  width: "81px",
                                  height: "81px",
                                  borderRadius: "50%",
                                  overflow: "hidden",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  backgroundColor: "#f5f5f5",
                                }}
                              >
                                <img
                                  src={(() => {
                                    const uploadedImage = uploadedFiles.find(
                                      (f) => f.type === "image",
                                    )?.url;
                                    const resolvedAvatar =
                                      getFullAvatarUrl(avatarUrl);
                                    const finalSrc =
                                      uploadedImage ||
                                      resolvedAvatar ||
                                      "/avatars/personaAvatarPlaceHolder.svg";
                                    return finalSrc;
                                  })()}
                                  alt="Persona"
                                  className="rounded-full border-2 border-main-border"
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "contain",
                                    display: "block",
                                  }}
                                />
                              </div>
                              {Array.from({ length: 7 }).map((_, index) => {
                                const angle = (index / 7) * 360;
                                const radius = 54;
                                return (
                                  <div
                                    key={index}
                                    className={cn(
                                      "-rotate-90 absolute top-1/2 left-1/2 -translate-1/2 h-2 w-2 rounded-full transition-colors duration-300",
                                      index < progressSteps
                                        ? "bg-[#009951]"
                                        : index === progressSteps &&
                                            progressSteps < 7
                                          ? "border border-[#009951] bg-transparent"
                                          : "bg-transparent",
                                    )}
                                    style={{
                                      transform: `rotate(${angle}deg) translateX(${radius}px) rotate(-${angle}deg)`,
                                    }}
                                  />
                                );
                              })}
                            </div>

                            <div className="text-center mb-2">
                              <p
                                className={cn(
                                  "font-clash font-medium text-[29px]",
                                  isPersonaReady
                                    ? "text-[#1E1E1E]"
                                    : "text-zinc-300",
                                )}
                              >
                                {personaName}
                              </p>
                              <p
                                className={cn(
                                  "max-w-[240px] w-[240px] font-normal text-center text-sm mt-1",
                                  isPersonaReady
                                    ? "text-[#333333]"
                                    : "text-zinc-300",
                                )}
                              >
                                Start chatting to test your persona
                              </p>
                            </div>

                            <Button
                              onClick={handleSaveToTest}
                              disabled={
                                !isPersonaReady || isSaving || isTesting
                              }
                              className={cn(
                                "flex items-center gap-2 rounded-[8px] px-6 py-2.5 text-sm font-medium transition-colors",
                                (!isPersonaReady || isTesting) &&
                                  "bg-[#D4D4D4] hover:bg-[#D4D4D4] cursor-not-allowed text-gray-500",
                                isPersonaReady &&
                                  !isTesting &&
                                  "bg-[#171717] hover:bg-[#000000] text-white",
                              )}
                            >
                              {isSaving ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Saving...
                                </>
                              ) : isTesting ? (
                                <>
                                  <Check className="h-4 w-4" />
                                  Ready to test
                                </>
                              ) : (
                                <>
                                  {isPersonaReady ? (
                                    <Rocket className="h-4 w-4" />
                                  ) : (
                                    <Check className="h-4 w-4" />
                                  )}
                                  Save to test
                                </>
                              )}
                            </Button>
                          </div>
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enhance Mode Overlay (disabled; now inline in System Instruction section) */}
        {false && showEnhanceMode && (
          <div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
            style={{ backdropFilter: 'blur(4px)' }}
          >
            <div
              className="bg-white rounded-[30px] relative"
              style={{
                width: '800px',
                height: '600px',
                boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.15)',
              }}
            >
              {/* Loading State */}
              {enhanceLoadingStep && (
                <div className="w-full h-full flex items-center justify-center p-10">
                  <div className="w-full max-w-[520px] rounded-3xl border border-[#E7E7E7] bg-white/80 backdrop-blur-sm shadow-sm p-7">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-[#0A0A0A] text-white flex items-center justify-center">
                        <Sparkles className="h-6 w-6 animate-pulse" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-clash font-semibold text-[20px] tracking-[-0.02em] text-[#0A0A0A]">
                          Enhance Mode
                        </div>
                        <div className="text-[13px] text-[#666666]">
                          {enhanceLoadingStep === 'analyzing'
                            ? 'Analysing the prompt…'
                            : enhanceLoadingStep === 'drafting'
                              ? 'Drafting smarter improvements…'
                              : 'Applying enhancements…'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5">
                      <div className="h-2 w-full rounded-full bg-[#EFEFEF] overflow-hidden">
                        <div
                          className="h-full bg-[#0A0A0A] transition-all duration-500"
                          style={{
                            width:
                              enhanceLoadingStep === 'analyzing'
                                ? '33%'
                                : enhanceLoadingStep === 'drafting'
                                  ? '66%'
                                  : '92%',
                          }}
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[12px]">
                        <span className={enhanceLoadingStep === 'analyzing' ? 'text-[#0A0A0A] font-medium' : 'text-[#8A8A8A]'}>
                          Analyse
                        </span>
                        <span className={enhanceLoadingStep === 'drafting' ? 'text-[#0A0A0A] font-medium' : 'text-[#8A8A8A]'}>
                          Draft
                        </span>
                        <span className={enhanceLoadingStep === 'enhancing' ? 'text-[#0A0A0A] font-medium' : 'text-[#8A8A8A]'}>
                          Enhance
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Interface */}
              {!enhanceLoadingStep && (
                <div className="w-full h-full flex flex-col p-8">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <h2
                      className="font-clash font-medium text-[24px] flex items-center gap-2"
                      style={{ letterSpacing: '-0.02em', color: '#28231D' }}
                    >
                      <Sparkles size={20} />
                      Enhance Mode
                    </h2>
                    <button
                      onClick={handleCloseEnhanceMode}
                      className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                    >
                      <X size={20} className="text-[#666666]" />
                    </button>
                  </div>

                  {/* Tab Content */}
                  <div className="flex-1 overflow-hidden mb-4">
                    {/* Tab 1: Tone Selection */}
                    {activeEnhanceTab === 0 && (
                      <div className="h-full flex flex-col">
                        <h3 className="font-medium text-[20px] text-[#0A0A0A] mb-2">
                          How should this persona sound?
                        </h3>
                        <p className="text-sm text-[#666666] mb-6">
                          Pick up to two for a blended tone.
                        </p>
                        <div className="flex-1 overflow-y-auto customScrollbar2">
                          <div className="grid grid-cols-4 gap-3">
                            {TONE_OPTIONS.map((tone) => (
                              <button
                                key={tone}
                                onClick={() => handleToneToggle(tone)}
                                className={cn(
                                  'h-[48px] px-4 rounded-lg border transition-all duration-200 cursor-pointer',
                                  'flex items-center justify-center',
                                  'text-sm font-medium',
                                  selectedTone.includes(tone)
                                    ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]'
                                    : 'bg-white text-[#0a0a0a] border-[#D9D9D9] hover:bg-[#0a0a0a] hover:text-white'
                                )}
                              >
                                {tone}
                              </button>
                            ))}
                            <button
                              onClick={() => handleToneToggle('Custom')}
                              className={cn(
                                'h-[48px] px-4 rounded-lg border transition-all duration-200 cursor-pointer',
                                'flex items-center justify-center gap-2',
                                'text-sm font-medium',
                                selectedTone.includes('Custom')
                                  ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]'
                                  : 'bg-white text-[#0a0a0a] border-[#D9D9D9] hover:bg-[#0a0a0a] hover:text-white'
                              )}
                            >
                              <Pencil size={16} />
                              Custom
                            </button>
                          </div>
                          {showCustomInput && selectedTone.includes('Custom') && (
                            <div className="mt-4">
                              <Input
                                type="text"
                                placeholder="Eg. Supportive"
                                value={customToneInput}
                                onChange={(e) => handleCustomToneChange(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleCustomToneSubmit();
                                  }
                                }}
                                className="w-full h-11 px-4 border border-[#D9D9D9] rounded-lg"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Tab 2: Dos Selection */}
                    {activeEnhanceTab === 1 && (
                      <div className="w-full h-full flex flex-col items-center border-2 border-pink-500">
                        <h3 className="font-medium text-[20px] text-[#0A0A0A] mb-2">
                          What should this persona always do?
                        </h3>
                        <p className="text-[11px] text-[#666666] mb-6">
                          Select all that apply, or write your own.
                        </p>
                        <div 
                          className="flex-1 overflow-y-auto customScrollbar2"
                          style={{ maxHeight: '320px' }}
                        >
                          <div className="grid grid-cols-2 gap-3">
                            {suggestedDos.map((doItem, index) => (
                              <button
                                key={index}
                                onClick={() => handleDosToggle(doItem)}
                                className={cn(
                                  'cursor-pointer h-auto min-h-[48px] px-4 py-3 rounded-lg border transition-all duration-200',
                                  'flex items-center justify-start text-left',
                                  'text-base font-medium',
                                  selectedDos.includes(doItem)
                                    ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]'
                                    : 'bg-white text-[#0a0a0a] border-[#D9D9D9] hover:bg-[#0a0a0a] hover:text-white'
                                )}
                              >
                                {doItem}
                              </button>
                            ))}
                            <button
                              onClick={() => {
                                setShowCustomDos(true);
                                setTimeout(() => {
                                  const input = document.getElementById('custom-dos-input') as HTMLInputElement;
                                  input?.focus();
                                }, 10);
                              }}
                              className={cn(
                                'h-[48px] px-4 rounded-lg border transition-all duration-200 cursor-pointer',
                                'flex items-center justify-center gap-2',
                                'text-sm font-medium',
                                showCustomDos
                                  ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]'
                                  : 'bg-white text-[#0a0a0a] border-[#D9D9D9] hover:bg-[#0a0a0a] hover:text-white'
                              )}
                            >
                              <Pencil size={16} />
                              Custom
                            </button>
                          </div>
                          {showCustomDos && (
                            <div className="mt-4">
                              <Textarea
                                id="custom-dos-input"
                                placeholder="Add your own DOs..."
                                value={dosText}
                                onChange={(e) => setDosText(e.target.value)}
                                className="w-full min-h-[80px] px-4 py-3 border border-[#D9D9D9] rounded-lg resize-none"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Tab 3: Donts Selection */}
                    {activeEnhanceTab === 2 && (
                      <div className="h-full flex flex-col">
                        <h3 className="font-medium text-[20px] text-[#0A0A0A] mb-2">
                          What should this persona never do?
                        </h3>
                        <p className="text-sm text-[#666666] mb-6">
                          Select all that apply, or write your own.
                        </p>
                        <div 
                          className="flex-1 overflow-y-auto customScrollbar2"
                          style={{ maxHeight: '320px' }}
                        >
                          <div className="grid grid-cols-1 gap-3">
                            {suggestedDonts.map((dontItem, index) => (
                              <button
                                key={index}
                                onClick={() => handleDontsToggle(dontItem)}
                                className={cn(
                                  'h-auto min-h-[48px] px-4 py-3 rounded-lg border transition-all duration-200',
                                  'flex items-center justify-start text-left',
                                  'text-sm font-medium',
                                  selectedDonts.includes(dontItem)
                                    ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]'
                                    : 'bg-white text-[#0a0a0a] border-[#D9D9D9] hover:bg-[#0a0a0a] hover:text-white'
                                )}
                              >
                                {dontItem}
                              </button>
                            ))}
                            <button
                              onClick={() => {
                                setShowCustomDonts(true);
                                setTimeout(() => {
                                  const input = document.getElementById('custom-donts-input') as HTMLTextAreaElement;
                                  input?.focus();
                                }, 10);
                              }}
                              className={cn(
                                'h-[48px] px-4 rounded-lg border transition-all duration-200 cursor-pointer',
                                'flex items-center justify-center gap-2',
                                'text-sm font-medium',
                                showCustomDonts
                                  ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]'
                                  : 'bg-white text-[#0a0a0a] border-[#D9D9D9] hover:bg-[#0a0a0a] hover:text-white'
                              )}
                            >
                              <Pencil size={16} />
                              Custom
                            </button>
                          </div>
                          {showCustomDonts && (
                            <div className="mt-4">
                              <Textarea
                                id="custom-donts-input"
                                placeholder="Add your own DONTs..."
                                value={dontsText}
                                onChange={(e) => setDontsText(e.target.value)}
                                className="w-full min-h-[80px] px-4 py-3 border border-[#D9D9D9] rounded-lg resize-none"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Tabs 4-7: Implementation */}
                    {/* Tab 4: Topic Focus */}
                    {activeEnhanceTab === 3 && (
                      <div className="h-full flex flex-col">
                        <h3 className="font-medium text-[20px] text-[#0A0A0A] mb-2">
                          Should this persona stick to specific topics?
                        </h3>
                        <p className="text-sm text-[#666666] mb-6">
                          Keeps conversation focused and on-brand.
                        </p>
                        <div className="flex-1 overflow-y-auto customScrollbar2">
                          <div className="flex flex-col gap-4">
                            <button
                              onClick={() => setTopicFocus('Open')}
                              className={cn(
                                'h-auto px-6 py-4 rounded-lg border transition-all duration-200',
                                'flex flex-col items-start text-left',
                                topicFocus === 'Open'
                                  ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]'
                                  : 'bg-white text-[#0a0a0a] border-[#D9D9D9] hover:bg-[#0a0a0a] hover:text-white'
                              )}
                            >
                              <span className="font-medium text-base">Open</span>
                              <span className={cn(
                                'text-sm mt-1',
                                topicFocus === 'Open' ? 'text-white/80' : 'text-[#666666]'
                              )}>
                                Can discuss anything relevant
                              </span>
                            </button>
                            <button
                              onClick={() => setTopicFocus('Focused')}
                              className={cn(
                                'h-auto px-6 py-4 rounded-lg border transition-all duration-200',
                                'flex flex-col items-start text-left',
                                topicFocus === 'Focused'
                                  ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]'
                                  : 'bg-white text-[#0a0a0a] border-[#D9D9D9] hover:bg-[#0a0a0a] hover:text-white'
                              )}
                            >
                              <span className="font-medium text-base">Focused</span>
                              <span className={cn(
                                'text-sm mt-1',
                                topicFocus === 'Focused' ? 'text-white/80' : 'text-[#666666]'
                              )}>
                                Stays close to its expertise
                              </span>
                            </button>
                            <button
                              onClick={() => setTopicFocus('Strict')}
                              className={cn(
                                'h-auto px-6 py-4 rounded-lg border transition-all duration-200',
                                'flex flex-col items-start text-left',
                                topicFocus === 'Strict'
                                  ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]'
                                  : 'bg-white text-[#0a0a0a] border-[#D9D9D9] hover:bg-[#0a0a0a] hover:text-white'
                              )}
                            >
                              <span className="font-medium text-base">Strict</span>
                              <span className={cn(
                                'text-sm mt-1',
                                topicFocus === 'Strict' ? 'text-white/80' : 'text-[#666666]'
                              )}>
                                Only discusses defined topics
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tab 5: Handling Unknowns */}
                    {activeEnhanceTab === 4 && (
                      <div className="h-full flex flex-col">
                        <h3 className="font-medium text-[20px] text-[#0A0A0A] mb-2">
                          When the persona doesn&apos;t know something...
                        </h3>
                        <p className="text-sm text-[#666666] mb-6">
                          How it handles gaps matters for trust.
                        </p>
                        <div 
                          className="flex-1 overflow-y-auto customScrollbar2"
                          style={{ maxHeight: '320px' }}
                        >
                          <div className="grid grid-cols-2 gap-3">
                            {['Admit it honestly', 'Suggest alternatives', 'Ask for more context', 'Best guess + disclaimer'].map((option) => (
                              <button
                                key={option}
                                onClick={() => {
                                  if (handlingUnknowns.includes(option)) {
                                    setHandlingUnknowns(handlingUnknowns.filter(h => h !== option));
                                  } else {
                                    setHandlingUnknowns([...handlingUnknowns, option]);
                                  }
                                }}
                                className={cn(
                                  'h-auto min-h-[48px] px-4 py-3 rounded-lg border transition-all duration-200',
                                  'flex items-center justify-start text-left',
                                  'text-sm font-medium',
                                  handlingUnknowns.includes(option)
                                    ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]'
                                    : 'bg-white text-[#0a0a0a] border-[#D9D9D9] hover:bg-[#0a0a0a] hover:text-white'
                                )}
                              >
                                {option}
                              </button>
                            ))}
                            <button
                              onClick={() => {
                                setShowCustomUnknown(true);
                                setTimeout(() => {
                                  const input = document.getElementById('custom-unknown-input') as HTMLTextAreaElement;
                                  input?.focus();
                                }, 10);
                              }}
                              className={cn(
                                'h-[48px] px-4 rounded-lg border transition-all duration-200 cursor-pointer',
                                'flex items-center justify-center gap-2',
                                'text-sm font-medium',
                                showCustomUnknown
                                  ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]'
                                  : 'bg-white text-[#0a0a0a] border-[#D9D9D9] hover:bg-[#0a0a0a] hover:text-white'
                              )}
                            >
                              <Pencil size={16} />
                              Custom
                            </button>
                          </div>
                          {showCustomUnknown && (
                            <div className="mt-4">
                              <Textarea
                                id="custom-unknown-input"
                                placeholder="Describe how to handle unknowns..."
                                value={customUnknown}
                                onChange={(e) => setCustomUnknown(e.target.value)}
                                className="w-full min-h-[80px] px-4 py-3 border border-[#D9D9D9] rounded-lg resize-none"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Tab 6: Response Structure */}
                    {activeEnhanceTab === 5 && (
                      <div className="h-full flex flex-col">
                        <h3 className="font-medium text-[20px] text-[#0A0A0A] mb-2">
                          How should the persona structure its responses?
                        </h3>
                        <p className="text-sm text-[#666666] mb-6">
                          Format affects clarity and usability.
                        </p>
                        <div 
                          className="flex-1 overflow-y-auto customScrollbar2"
                          style={{ maxHeight: '320px' }}
                        >
                          <div className="grid grid-cols-2 gap-3">
                            {['Detailed', 'Concise', 'Framework-based', 'Bullets only', 'Step-by-step'].map((option) => (
                              <button
                                key={option}
                                onClick={() => {
                                  if (responseStructure.includes(option)) {
                                    setResponseStructure(responseStructure.filter(r => r !== option));
                                  } else {
                                    setResponseStructure([...responseStructure, option]);
                                  }
                                }}
                                className={cn(
                                  'h-auto min-h-[48px] px-4 py-3 rounded-lg border transition-all duration-200',
                                  'flex items-center justify-start text-left',
                                  'text-sm font-medium',
                                  responseStructure.includes(option)
                                    ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]'
                                    : 'bg-white text-[#0a0a0a] border-[#D9D9D9] hover:bg-[#0a0a0a] hover:text-white'
                                )}
                              >
                                {option}
                              </button>
                            ))}
                            <button
                              onClick={() => {
                                setShowCustomStructure(true);
                                setTimeout(() => {
                                  const input = document.getElementById('custom-structure-input') as HTMLTextAreaElement;
                                  input?.focus();
                                }, 10);
                              }}
                              className={cn(
                                'h-[48px] px-4 rounded-lg border transition-all duration-200',
                                'flex items-center justify-center gap-2',
                                'text-sm font-medium',
                                showCustomStructure
                                  ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]'
                                  : 'bg-white text-[#0a0a0a] border-[#D9D9D9] hover:bg-[#0a0a0a] hover:text-white'
                              )}
                            >
                              <Pencil size={16} />
                              Custom
                            </button>
                          </div>
                          {showCustomStructure && (
                            <div className="mt-4">
                              <Textarea
                                id="custom-structure-input"
                                placeholder="Describe response structure..."
                                value={customStructure}
                                onChange={(e) => setCustomStructure(e.target.value)}
                                className="w-full min-h-[80px] px-4 py-3 border border-[#D9D9D9] rounded-lg resize-none"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Tab 7: Summary */}
                    {activeEnhanceTab === 6 && (
                      <div className="h-full flex flex-col">
                        <div className="flex flex-col items-center justify-center mb-6">
                          <div className="w-16 h-16 rounded-lg bg-[#28231D] flex items-center justify-center mb-4">
                            <Check size={32} className="text-white" />
                          </div>
                          <h3 className="font-medium text-[20px] text-[#28231D] mb-2">
                            Ready to apply
                          </h3>
                          <p className="text-sm text-[#666666]">
                            {improvementsList.length} improvements will be added to your prompt
                          </p>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-3 customScrollbar2">
                          {improvementsList.map((improvement, index) => (
                            <div
                              key={index}
                              className="flex items-start gap-3 px-4 py-3 border border-[#D9D9D9] rounded-lg bg-white"
                            >
                              <Check size={16} className="text-[#28231D] mt-0.5 flex-shrink-0" />
                              <span className="text-sm text-[#28231D]">{improvement}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tab Navigation Dots - Bottom Center */}
                  <div className="flex items-center justify-center gap-2 py-4">
                    {Array.from({ length: 7 }).map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setActiveEnhanceTab(index)}
                        className={cn(
                          'h-2 rounded-full transition-all duration-300',
                          activeEnhanceTab === index
                            ? 'w-12 bg-[#28231D]'
                            : 'w-2 bg-gray-300'
                        )}
                        aria-label={`Tab ${index + 1}`}
                      />
                    ))}
                  </div>

                  {/* Footer Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div className="flex gap-2">
                      {activeEnhanceTab > 0 && activeEnhanceTab < 6 && (
                        <Button
                          onClick={handleBackTab}
                          variant="ghost"
                          className="text-sm text-[#666666] hover:text-[#0A0A0A]"
                        >
                          Back
                        </Button>
                      )}
                      {activeEnhanceTab > 0 && activeEnhanceTab < 6 && (
                        <Button
                          onClick={handleSkipTab}
                          variant="ghost"
                          className="text-sm text-[#666666] hover:text-[#0A0A0A]"
                        >
                          Skip
                        </Button>
                      )}
                    </div>
                    {activeEnhanceTab === 6 ? (
                      <div className="flex gap-2">
                        <Button
                          onClick={handleCloseEnhanceMode}
                          variant="outline"
                          className="px-6 py-2.5 rounded-lg text-sm font-medium border-[#D9D9D9] text-[#666666] hover:text-[#0A0A0A]"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleApplyEnhancements}
                          className="px-6 py-2.5 rounded-lg text-sm font-medium bg-[#171717] hover:bg-[#000000] text-white"
                        >
                          Apply to prompt
                        </Button>
                      </div>
                    ) : (
                      <Button
                        onClick={handleContinueTab}
                        disabled={!canContinueTab}
                        className={cn(
                          'px-6 py-2.5 rounded-lg text-sm font-medium',
                          canContinueTab
                            ? 'bg-[#171717] hover:bg-[#000000] text-white'
                            : 'bg-[#D4D4D4] cursor-not-allowed text-gray-500'
                        )}
                      >
                        Continue
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Success Dialog */}
        <Dialog open={showSuccessDialog} onOpenChange={(open) => { if (!open) { setShowSuccessDialog(false); router.push("/personas/admin"); } }}>
          <DialogContent
            className="border-none p-0 gap-0"
            style={{
              width: "524px",
              maxWidth: "524px",
              borderRadius: "30px",
              padding: "12px",
            }}
          >
            <DialogTitle className="sr-only">Persona Created Successfully</DialogTitle>
            <div
              className="flex flex-col items-center justify-center gap-3 px-6 py-8"
              style={{
                width: "500px",
                minHeight: "371px",
              }}
            >
              {/* Persona Image */}
              <div
                style={{
                  width: "120px",
                  height: "120px",
                  borderRadius: "50%",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#f5f5f5",
                  marginBottom: "16px",
                }}
              >
                <img
                  src={(() => {
                    const uploadedImage = uploadedFiles.find(
                      (f) => f.type === "image",
                    )?.url;
                    const resolvedAvatar = getFullAvatarUrl(avatarUrl);
                    const finalSrc =
                      uploadedImage ||
                      resolvedAvatar ||
                      "/personas/persona1.png";
                    return finalSrc;
                  })()}
                  alt="Persona"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              </div>

              {/* Success Message */}
              <h2
                className="w-[304px]"
                style={{
                  fontFamily: "Clash Grotesk Variable",
                  fontWeight: 500,
                  fontSize: "28.21px",
                  lineHeight: "129%",
                  letterSpacing: "0%",
                  textAlign: "center",
                  color: "#0A0A0A",
                  marginBottom: "8px",
                }}
              >
                Persona &apos;{personaName}&apos; has been created!
              </h2>

              <p
                className="w-[368px] text-center text-sm"
                style={{
                  color: "#666666",
                  maxWidth: "400px",
                  lineHeight: "1.5",
                  marginBottom: "24px",
                }}
              >
                &apos;{personaName}&apos; was created and added to your manager
                page. Try chatting with your persona or share it with your team.
              </p>

              {/* Action Buttons */}
              <div className="flex items-center justify-center gap-3 w-full px-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowSuccessDialog(false);
                    if (createdPersonaId) {
                      router.push(`/personas/${createdPersonaId}/chat`);
                    }
                  }}
                  style={{
                    color: "#0A0A0A",
                  }}
                  className="w-[128px] h-11 rounded-lg border border-[#E5E5E5] bg-white hover:bg-[#F5F5F5] hover:text-[#0A0A0A] font-medium"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Start Chat
                </Button>
                <Button
                  onClick={() => {
                    setShowSuccessDialog(false);
                    setShowShareDialog(true);
                  }}
                  className="w-[138px] h-11 rounded-lg bg-[#171717] hover:bg-[#000000] text-white font-medium"
                >
                  <Share2 className="h-4 w-4 mr-2" />Share
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Share Dialog */}
        <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
          <DialogContent
            className="border-none p-2 gap-3"
            style={{
              width: "420px",
              maxWidth: "420px",
              borderRadius: "10px",
              padding: "8px",
            }}
          >
            <DialogTitle className="sr-only">Share Persona</DialogTitle>
            <div className="flex flex-col gap-3">
              {/* Title with Close Button */}
              <div className="flex items-center justify-between px-1">
                <h3
                  style={{
                    fontFamily: "Clash Grotesk Variable",
                    fontWeight: 400,
                    fontSize: "24px",
                    lineHeight: "120%",
                    letterSpacing: "-2%",
                    color: "#0A0A0A",
                  }}
                >
                  Share &quot;{personaName}&quot;
                </h3>
                {/* <button
                  onClick={() => setShowShareDialog(false)}
                  style={{
                    width: "16px",
                    height: "16px",
                    padding: 0,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X
                    style={{ width: "16px", height: "16px", color: "#666666" }}
                  />
                </button> */}
              </div>

              {/* Email Input */}
              <div className="w-full min-h-[36px] text-black border border-main-border rounded-[8px] flex items-center gap-2 pl-3">
                <Search size={16} className="text-[#525252]" />
                <Input
                  type="email"
                  placeholder="Enter email for adding people"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && shareEmail.trim()) {
                      toast("User added", {
                        description: `Invitation sent to ${shareEmail}`,
                      });
                      setShareEmail("");
                    }
                  }}
                  className="flex-1 h-full border-none py-[7.5px]"
                />
              </div>

              {/* User List */}
              <div
                className="flex flex-col gap-3"
                style={{
                  width: "404px",
                  height: "196px",
                  overflowY: "auto",
                }}
              >
                {/* Mock user - Owner */}
                <div
                  className="flex items-center justify-between"
                  style={{
                    width: "404px",
                    height: "40px",
                    paddingRight: "8px",
                    paddingLeft: "8px",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "50%",
                        backgroundColor: "#F5F5F5",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                      }}
                    >
                      <img
                        src={(() => {
                          const uploadedImage = uploadedFiles.find(
                            (f) => f.type === "image",
                          )?.url;
                          const resolvedAvatar = getFullAvatarUrl(avatarUrl);
                          const finalSrc =
                            uploadedImage ||
                            resolvedAvatar ||
                            "/personas/persona1.png";
                          return finalSrc;
                        })()}
                        alt="User"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    </div>
                    <div className="flex flex-col">
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: "12px",
                          lineHeight: "140%",
                          textTransform: "capitalize",
                          color: "#0A0A0A",
                        }}
                      >
                        You
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#666666",
                        }}
                      >
                        {maskEmail(user?.email)}
                      </span>
                    </div>
                  </div>
                  <div
                    className="rounded-full"
                    style={{
                      width: "86px",
                      height: "24px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#FBEEB1",
                      fontSize: "11px",
                      fontWeight: 500,
                      color: "#B47800",
                    }}
                  >
                    Owner
                  </div>
                </div>

                {/* Mock users - Shared */}
                {/* {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between"
                    style={{
                      width: "404px",
                      height: "40px",
                      paddingRight: "8px",
                      paddingLeft: "8px",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "50%",
                          backgroundColor: "#E5E5E5",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <span style={{ fontSize: "14px", color: "#666666" }}>
                          {String.fromCharCode(65 + i)}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: "12px",
                            lineHeight: "140%",
                            textTransform: "capitalize",
                            color: "#0A0A0A",
                          }}
                        >
                          Team Member {i}
                        </span>
                        <span
                          style={{
                            fontSize: "11px",
                            color: "#666666",
                          }}
                        >
                          member{i}@team.com
                        </span>
                      </div>
                    </div>
                    <div
                      style={{
                        width: "86px",
                        height: "24px",
                        minHeight: "24px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "9999px",
                        backgroundColor: "#EEF2FF",
                        paddingTop: "3px",
                        paddingRight: "2px",
                        paddingBottom: "3px",
                        paddingLeft: "2px",
                        gap: "6px",
                        fontFamily: "Geist",
                        fontSize: "12px",
                        fontWeight: 500,
                        lineHeight: "150%",
                        letterSpacing: "1.5%",
                        textAlign: "center",
                        color: "#4F46E7",
                      }}
                    >
                      Shared
                    </div>
                  </div>
                ))} */}
              </div>

              {/* Action buttons */}
              <div className="font-geist font-medium mr-2 flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  onClick={() => setShowShareDialog(false)}
                  style={{
                    fontSize: "14px",
                    color: "#666666",
                    padding: "8px 16px",
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (shareEmail.trim()) {
                      toast("User added", {
                        description: `Invitation sent to ${shareEmail}`,
                      });
                      setShareEmail("");
                    }
                  }}
                  style={{
                    width: "51px",
                    height: "32px",
                    borderRadius: "8px",
                    padding: "5.5px 3px",
                    backgroundColor: "#171717",
                    color: "#FAFAFA",
                    marginTop: "3px",
                    fontSize: "14px",
                    fontWeight: 500,
                  }}
                >
                  Add
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
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
