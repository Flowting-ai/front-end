
import { createContext } from 'react';
import type { Pin } from '@/components/layout/right-sidebar';
import type { ChatBoard } from '@/components/layout/app-layout';
import type { AIModel } from '@/types/ai-model';

export const AppLayoutContext = createContext<{
  pins: Pin[];
  chatBoards: ChatBoard[];
  setChatBoards: React.Dispatch<React.SetStateAction<ChatBoard[]>>;
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  selectedModel: AIModel | null;
  ensureChatOnServer?: (options: { firstMessage: string; selectedModel: AIModel }) => Promise<{ chatId: string, initialResponse: string, initialMessageId: string } | null>;
}>({ 
  pins: [], 
  chatBoards: [], 
  setChatBoards: () => {},
  activeChatId: null, 
  setActiveChatId: () => {},
  selectedModel: null,
});
