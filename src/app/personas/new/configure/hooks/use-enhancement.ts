/**
 * Custom hook for handling system instruction enhancement
 */

import { useState, useCallback } from 'react';
import { toast } from '@/lib/toast-helper';
import { analyzePersona, type PersonaAnalyzeResponse } from "@/lib/api/personas";

interface UseEnhancementReturn {
  isEnhancing: boolean;
  hasEnhancedContent: boolean;
  originalInstruction: string;
  enhance: (currentInstruction: string, csrfToken?: string | null) => Promise<PersonaAnalyzeResponse>;
  reset: () => void;
}

export function useEnhancement(): UseEnhancementReturn {
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [hasEnhancedContent, setHasEnhancedContent] = useState(false);
  const [originalInstruction, setOriginalInstruction] = useState('');

  const enhance = useCallback(
    async (
      currentInstruction: string,
      csrfToken?: string | null
    ): Promise<PersonaAnalyzeResponse> => {
      setIsEnhancing(true);
      setOriginalInstruction(currentInstruction);

      try {
        const enhanced = await analyzePersona(currentInstruction, csrfToken);
        setHasEnhancedContent(true);
        return enhanced;
      } catch (error) {
        console.error('Error enhancing instruction:', error);
        toast.error('Enhancement failed', {
          description: 'Unable to enhance the instruction. Please try again.',
        });
        throw error;
      } finally {
        setIsEnhancing(false);
      }
    },
    [toast]
  );

  const reset = useCallback(() => {
    setHasEnhancedContent(false);
    setOriginalInstruction('');
  }, []);

  return {
    isEnhancing,
    hasEnhancedContent,
    originalInstruction,
    enhance,
    reset,
  };
}

