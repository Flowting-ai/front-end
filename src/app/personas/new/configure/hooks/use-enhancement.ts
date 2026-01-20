/**
 * Custom hook for handling system instruction enhancement
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/lib/config';
import { MOCK_ENHANCED_RESPONSE } from '../constants';
import { REFINEMENT_STEPS } from '../types';

interface UseEnhancementReturn {
  isEnhancing: boolean;
  hasEnhancedContent: boolean;
  originalInstruction: string;
  enhance: (currentInstruction: string) => Promise<string>;
  reset: () => void;
}

export function useEnhancement(): UseEnhancementReturn {
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [hasEnhancedContent, setHasEnhancedContent] = useState(false);
  const [originalInstruction, setOriginalInstruction] = useState('');

  const enhance = useCallback(
    async (currentInstruction: string): Promise<string> => {
      setIsEnhancing(true);
      setOriginalInstruction(currentInstruction);

      try {
        // TODO: Replace with actual API call
        // const csrfToken = readCookie('csrftoken');
        // const response = await fetch(`${API_BASE_URL}/api/personas/enhance-instruction/`, {
        //   method: 'POST',
        //   headers: {
        //     'Content-Type': 'application/json',
        //     'X-CSRFToken': csrfToken || '',
        //   },
        //   body: JSON.stringify({ instruction: currentInstruction }),
        // });
        // if (!response.ok) throw new Error('Enhancement failed');
        // const data = await response.json();
        // return data.enhanced_instruction;

        // Mock implementation
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const enhanced = MOCK_ENHANCED_RESPONSE;
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

