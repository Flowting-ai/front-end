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

const MAX_HISTORY_SIZE = 50;

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
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(instruction);
      if (newHistory.length > MAX_HISTORY_SIZE) {
        return newHistory.slice(-MAX_HISTORY_SIZE);
      }
      return newHistory;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, MAX_HISTORY_SIZE - 1));
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (canUndo) setHistoryIndex((prev) => prev - 1);
  }, [canUndo]);

  const redo = useCallback(() => {
    if (canRedo) setHistoryIndex((prev) => prev + 1);
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
