"use client";

import React, { useState, useMemo, useEffect } from "react";
import { X, Search } from "lucide-react";
import { workflowAPI } from "./workflow-api";

interface Chat {
  id: string;
  name: string;
  pinnedDate?: string;
}

interface SelectChatsDialogProps {
  allChats: Chat[];
  selectedChatId?: string;
  onClose: () => void;
  onSelect: (chatId: string) => void;
}

function formatDate(dateString?: string): string {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleString("en-US", { month: "short" });
    return `${day}${getOrdinalSuffix(day)} ${month}`;
  } catch {
    return "";
  }
}

function getOrdinalSuffix(num: number): string {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}

export function SelectChatsDialog({
  allChats: propChats,
  selectedChatId,
  onClose,
  onSelect,
}: SelectChatsDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [localSelectedId, setLocalSelectedId] = useState<string | undefined>(selectedChatId);
  const [chats, setChats] = useState<Chat[]>(propChats);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Always try to fetch fresh data when dialog opens
    const fetchChatData = async () => {
      setIsLoading(true);
      
      // Use provided chats if available
      if (propChats.length > 0) {
        console.log('Using provided chats:', propChats);
        setChats(propChats);
        setIsLoading(false);
        return;
      }

      // Check sessionStorage cache
      const cached = sessionStorage.getItem("allChats");
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as Chat[];
          console.log('Using cached chats:', parsed);
          if (parsed.length > 0) {
            setChats(parsed);
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.error('Failed to parse cached chats:', e);
        }
      }

      // Fetch from API
      try {
        console.log('Fetching chats from API...');
        const data = await workflowAPI.fetchChats();
        console.log('Fetched chats:', data);
        setChats(data);
        if (data.length > 0) {
          sessionStorage.setItem("allChats", JSON.stringify(data));
        }
      } catch (error) {
        console.error("Failed to fetch chats:", error);
        setChats([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchChatData();
  }, [propChats]);

  const filteredChats = useMemo(() => {
    return chats.filter((chat) => {
      if (!chat || !chat.name) return false;
      return chat.name.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [chats, searchQuery]);

  const handleToggleChat = (chatId: string) => {
    setLocalSelectedId(chatId);
  };

  const handleAdd = () => {
    if (localSelectedId) {
      onSelect(localSelectedId);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-white rounded-[10px] border border-[#E5E5E5] shadow-lg flex flex-col gap-3 p-2"
        style={{
          width: "420px",
          height: "365px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-2">
          <h2 className="font-clash font-normal text-[24px] text-[#0A0A0A]">
            Select Chat
          </h2>
          <button
            onClick={onClose}
            className="cursor-pointer text-[#757575] hover:text-black transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative px-2">
          <Search className="absolute left-4 top-2.5 h-4 w-4 text-[#9F9F9F]" />
          <input
            type="text"
            placeholder="Search for your chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8 pl-9 pr-3 py-1.5 rounded-[8px] border border-[#E5E5E5] font-geist font-normal text-sm text-[#0A0A0A] placeholder-[#737373] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
          />
        </div>

        {/* Chats List */}
        <div className="flex-1 overflow-y-auto px-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-sm text-[#757575]">Loading chats...</div>
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[#757575] text-sm gap-2">
              <div className="font-medium">No chats found</div>
              {searchQuery ? (
                <div className="text-xs">Try a different search term</div>
              ) : chats.length === 0 ? (
                <div className="text-xs text-center">
                  Start a conversation to see chats here
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-0">
              {filteredChats.map((chat) => (
                <div
                  key={chat.id}
                  className="flex items-center justify-between h-8 px-2 py-1.5 rounded-[8px] hover:bg-[#F5F5F5] transition-colors duration-300 group cursor-pointer"
                  onClick={() => handleToggleChat(chat.id)}
                >
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="radio"
                      checked={localSelectedId === chat.id}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleToggleChat(chat.id);
                      }}
                      className="w-4 h-4 cursor-pointer accent-black transition-colors"
                    />
                    <span className="text-sm text-[#0A0A0A] truncate">
                      {chat.name}
                    </span>
                  </div>
                  {chat.pinnedDate && (
                    <span className="text-xs text-[#757575] ml-2 whitespace-nowrap hidden group-hover:inline">
                      {formatDate(chat.pinnedDate)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer - Cancel and Select Buttons */}
        <div className="flex items-center justify-end gap-2 px-2 py-1 border-t border-[#E5E5E5]">
          <button
            onClick={onClose}
            className="cursor-pointer h-8 rounded-[8px] px-4 bg-white text-sm font-medium text-[#0A0A0A] hover:bg-[#F5F5F5] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!localSelectedId}
            className="cursor-pointer h-8 rounded-[8px] px-4 bg-[#2C2C2C] text-white text-sm font-medium hover:bg-[#1F1F1F] transition-colors disabled:bg-[#D4D4D4] disabled:text-[#757575] disabled:cursor-not-allowed"
          >
            Select
          </button>
        </div>
      </div>
    </div>
  );
}
