/**
 * Custom hook for handling persona refinement steps
 */

import { useState, useCallback, useEffect } from 'react';
import { REFINEMENT_STEPS } from '../types';
import { MOCK_SUGGESTED_DOS, MOCK_SUGGESTED_DONTS } from '../constants';

interface UseRefinementReturn {
  currentStep: number;
  selectedTone: string | null;
  customToneInput: string;
  showCustomInput: boolean;
  dosText: string;
  dontsText: string;
  selectedDos: string[];
  selectedDonts: string[];
  suggestedDos: string[];
  suggestedDonts: string[];
  dosSkipped: boolean;
  setCurrentStep: (step: number) => void;
  setDosText: (value: string) => void;
  setDontsText: (value: string) => void;
  handleToneSelect: (tone: string) => void;
  handleCustomToneChange: (value: string) => void;
  handleCustomToneSubmit: () => void;
  handleDosToggle: (dos: string) => void;
  handleDontsToggle: (dont: string) => void;
  handleSkip: () => void;
  reset: () => void;
}

export function useRefinement(hasEnhancedContent: boolean): UseRefinementReturn {
  const [currentStep, setCurrentStep] = useState<number>(REFINEMENT_STEPS.TONE);
  const [selectedTone, setSelectedTone] = useState<string | null>(null);
  const [customToneInput, setCustomToneInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [dosText, setDosText] = useState('');
  const [dontsText, setDontsText] = useState('');
  const [selectedDos, setSelectedDos] = useState<string[]>([]);
  const [selectedDonts, setSelectedDonts] = useState<string[]>([]);
  const [suggestedDos, setSuggestedDos] = useState<string[]>([]);
  const [suggestedDonts, setSuggestedDonts] = useState<string[]>([]);
  const [dosSkipped, setDosSkipped] = useState(false);

  // Fetch suggested Dos and Don'ts when step >= 2
  useEffect(() => {
    if (hasEnhancedContent && currentStep >= REFINEMENT_STEPS.DOS) {
      // TODO: Replace with actual API call
      setSuggestedDos(MOCK_SUGGESTED_DOS);
      setSuggestedDonts(MOCK_SUGGESTED_DONTS);
    }
  }, [hasEnhancedContent, currentStep]);

  // Reset when enhancement is cleared
  useEffect(() => {
    if (!hasEnhancedContent) {
      reset();
    }
  }, [hasEnhancedContent]);

  const handleToneSelect = useCallback((tone: string) => {
    if (tone === 'Custom') {
      setShowCustomInput(true);
      setSelectedTone('Custom');
    } else {
      setShowCustomInput(false);
      setSelectedTone(tone);
      setCustomToneInput('');
      setCurrentStep(REFINEMENT_STEPS.DOS);
    }
  }, []);

  const handleCustomToneChange = useCallback((value: string) => {
    setCustomToneInput(value);
  }, []);

  const handleCustomToneSubmit = useCallback(() => {
    if (!customToneInput.trim()) return;
    setSelectedTone('Custom');
    setShowCustomInput(false);
    setCurrentStep(REFINEMENT_STEPS.DOS);
  }, [customToneInput]);

  const handleDosToggle = useCallback((dos: string) => {
    setSelectedDos((prev) => {
      const newSelected = prev.includes(dos)
        ? prev.filter((d) => d !== dos)
        : [...prev, dos];
      
      if (newSelected.length > 0) {
        setCurrentStep(REFINEMENT_STEPS.DONTS);
      }
      
      return newSelected;
    });
  }, []);

  const handleDontsToggle = useCallback((dont: string) => {
    setSelectedDonts((prev) =>
      prev.includes(dont)
        ? prev.filter((d) => d !== dont)
        : [...prev, dont]
    );
  }, []);

  const handleSkip = useCallback(() => {
    if (currentStep === REFINEMENT_STEPS.TONE) {
      setCurrentStep(REFINEMENT_STEPS.DOS);
    } else if (currentStep === REFINEMENT_STEPS.DOS) {
      setDosSkipped(true);
      setCurrentStep(REFINEMENT_STEPS.DONTS);
    } else {
      reset();
    }
  }, [currentStep]);

  const reset = useCallback(() => {
    setCurrentStep(REFINEMENT_STEPS.TONE);
    setDosSkipped(false);
    setSelectedTone(null);
    setShowCustomInput(false);
    setCustomToneInput('');
    setDosText('');
    setDontsText('');
    setSelectedDos([]);
    setSelectedDonts([]);
    setSuggestedDos([]);
    setSuggestedDonts([]);
  }, []);

  return {
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
    handleToneSelect,
    handleCustomToneChange,
    handleCustomToneSubmit,
    handleDosToggle,
    handleDontsToggle,
    handleSkip,
    reset,
  };
}

