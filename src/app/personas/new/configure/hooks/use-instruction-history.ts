/**
 * Custom hook for managing instruction history (undo/redo)
 * Production-ready with proper state management and validation
 */

import { useState, useCallback, useMemo } from 'react';

interface UseInstructionHistoryReturn {
  currentInstruction: string;
  instructionHistory: string[];
  historyIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  setInstruction: (instruction: string) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
}

const MAX_HISTORY_SIZE = 50; // Prevent memory bloat

export function useInstructionHistory(initialInstruction: string = ''): UseInstructionHistoryReturn {
  const [instructionHistory, setInstructionHistory] = useState<string[]>([initialInstruction]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const canUndo = useMemo(() => historyIndex > 0, [historyIndex]);
  const canRedo = useMemo(
    () => historyIndex < instructionHistory.length - 1,
    [historyIndex, instructionHistory.length]
  );

  const currentInstruction = useMemo(
    () => instructionHistory[historyIndex] || '',
    [instructionHistory, historyIndex]
  );

  const setInstruction = useCallback((instruction: string) => {
    setInstructionHistory((prev) => {
      // Remove any future history (after current index)
      const newHistory = prev.slice(0, historyIndex + 1);
      
      // Add new instruction
      newHistory.push(instruction);
      
      // Limit history size to prevent memory issues
      if (newHistory.length > MAX_HISTORY_SIZE) {
        return newHistory.slice(-MAX_HISTORY_SIZE);
      }
      
      return newHistory;
    });
    
    setHistoryIndex((prev) => {
      const newIndex = prev + 1;
      // Ensure index doesn't exceed MAX_HISTORY_SIZE
      return Math.min(newIndex, MAX_HISTORY_SIZE - 1);
    });
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (canUndo) {
      setHistoryIndex((prev) => prev - 1);
    }
  }, [canUndo]);

  const redo = useCallback(() => {
    if (canRedo) {
      setHistoryIndex((prev) => prev + 1);
    }
  }, [canRedo]);

  const reset = useCallback(() => {
    setInstructionHistory([initialInstruction]);
    setHistoryIndex(0);
  }, [initialInstruction]);

  return {
    currentInstruction,
    instructionHistory,
    historyIndex,
    canUndo,
    canRedo,
    setInstruction,
    undo,
    redo,
    reset,
  };
}

