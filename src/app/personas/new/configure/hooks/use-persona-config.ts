/**
 * Main hook for managing persona configuration state
 * Production-ready with proper validation and error handling
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { AIModel } from '@/types/ai-model';
import { MODELS } from '../constants';
import { createPreviewModel } from '../utils';
import { DEFAULT_TEMPERATURE } from '../constants';

interface UsePersonaConfigReturn {
  personaName: string;
  selectedModel: string;
  systemInstruction: string;
  temperature: number[];
  previewModel: AIModel | null;
  setPersonaName: (name: string) => void;
  setSelectedModel: (model: string) => void;
  setSystemInstruction: (instruction: string) => void;
  setTemperature: (temp: number[]) => void;
}

export function usePersonaConfig(): UsePersonaConfigReturn {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [personaName, setPersonaName] = useState('Persona name');
  const [selectedModel, setSelectedModel] = useState('');
  const [systemInstruction, setSystemInstruction] = useState('');
  const [temperature, setTemperature] = useState([DEFAULT_TEMPERATURE]);
  const [previewModel, setPreviewModel] = useState<AIModel | null>(null);

  // Load persona name from URL params
  useEffect(() => {
    const nameParam = searchParams.get('name');
    if (nameParam) {
      setPersonaName(nameParam);
    }
  }, [searchParams]);

  // Update preview model when selected model changes
  useEffect(() => {
    if (selectedModel) {
      const model = MODELS.find((m) => m.value === selectedModel);
      if (model) {
        setPreviewModel(createPreviewModel(model));
      } else {
        setPreviewModel(null);
      }
    } else {
      setPreviewModel(null);
    }
  }, [selectedModel]);

  // Validate temperature range
  const setTemperatureValidated = useCallback((temp: number[]) => {
    const validated = temp.map((t) => Math.max(0, Math.min(1, t))); // Clamp between 0 and 1
    setTemperature(validated);
  }, []);

  return {
    personaName,
    selectedModel,
    systemInstruction,
    temperature,
    previewModel,
    setPersonaName,
    setSelectedModel,
    setSystemInstruction,
    setTemperature: setTemperatureValidated,
  };
}

