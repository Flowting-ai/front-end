
"use client";

// ?pinboard=empty - for empty state
// ?pinboard=filled - for filled state

// Sources:
// Query param: add ?pinboard=empty or ?pinboard=filled to the URL.
// LocalStorage: set localStorage.setItem('pinboardDevState', 'empty') or 'auto'.
// DevTools helper: window.__setPinboardDevState('empty') or 'auto'.

import { useState, useMemo, useContext, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Pin,
  Search,
  FolderPlus,
  ChevronDown,
  Download,
  Tag,
  X,
  File,
  UserPlus,
  GitCompare,
  MessagesSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { stripMarkdown } from "@/lib/markdown-utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuCheckboxItem,
} from "../ui/dropdown-menu";
import type { ChatBoard, RightSidebarPanel } from "./app-layout";
import { PinItem } from "../pinboard/pin-item";
import { AppLayoutContext } from "./app-layout";
import { Separator } from "../ui/separator";
import { OrganizePinsDialog } from "../pinboard/organize-pins-dialog";
import { useAuth } from "@/context/auth-context";
import { toast } from "@/lib/toast-helper";
import {
  createPin,
  createPinFolder,
  fetchPinFolders,
  movePinToFolder,
  deletePin,
  renamePinFolder,
  deletePinFolder,
  updatePinComments,
  type PinFolder,
} from "@/lib/api/pins";

export interface PinType {
  id: string;
  text: string; // display title
  title?: string | null;
  tags: string[];
  notes: string;
  chatId: string;
  time: Date;
  messageId?: string;
  folderId?: string;
  folderName?: string | null;
  sourceChatId?: string | null;
  sourceMessageId?: string | null;
  formattedContent?: string | null;
  comments?: string[];
}

interface RightSidebarProps {
  isOpen: boolean;
  activePanel: RightSidebarPanel | null;
  onClose: () => void;
  pins: PinType[];
  setPins: React.Dispatch<React.SetStateAction<PinType[]>>;
  chatBoards: ChatBoard[];
  className?: string;
  onInsertToChat?: (text: string, pin: PinType) => void;
}

const PIN_INSERT_EVENT = "pin-insert-to-chat";

type FilterMode = "all" | "current-chat" | "newest" | "oldest" | "by-folder" | "unorganized";

const PANEL_METADATA: Record<RightSidebarPanel, { title: string; description?: string }> = {
  pinboard: {
    title: "Pinboard",
  },
  files: {
    title: "Files",
    description: "Upload files to ground your conversations with more context.",
  },
  personas: {
    title: "Personas",
    description: "Switch between saved personas to tailor the assistant's style.",
  },
  compare: {
    title: "Compare Models",
    description: "Benchmark and contrast model responses side-by-side.",
  },
};

const EMPTY_PLACEHOLDERS: Record<Exclude<RightSidebarPanel, "pinboard">, { title: string; description: string }> = {
  files: {
    title: "No files yet",
    description: "Upload documents to keep them handy for future prompts.",
  },
  personas: {
    title: "No personas yet",
    description: "Create a persona to reuse tone, goals, and guardrails across chats.",
  },
  compare: {
    title: "No comparisons",
    description: "Pick models to compare their answers or performance metrics.",
  },
};

export function RightSidebar({
  isOpen,
  activePanel,
  onClose,
  pins,
  setPins,
  chatBoards,
  className,
  onInsertToChat,
}: RightSidebarProps) {
  /**
   * Dev-only Pinboard state toggle
   * - Allows developers to switch between empty and filled states without UI controls.
   * - Usage (development only):
   *   • Query param: ?pinboard=empty | ?pinboard=filled
   *   • DevTools: localStorage.setItem('pinboardDevState', 'empty' | 'auto')
   *   • DevTools helper: window.__setPinboardDevState('empty' | 'auto')
   */
  const [forceEmptyPinboard, setForceEmptyPinboard] = useState<boolean>(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isDev = process.env.NODE_ENV !== 'production';
    if (!isDev) {
      setForceEmptyPinboard(false);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const param = params.get('pinboard');
    if (param === 'empty') {
      setForceEmptyPinboard(true);
    } else if (param === 'filled') {
      setForceEmptyPinboard(false);
    } else {
      const stored = window.localStorage.getItem('pinboardDevState');
      setForceEmptyPinboard(stored === 'empty');
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'pinboardDevState') {
        setForceEmptyPinboard(e.newValue === 'empty');
      }
    };
    window.addEventListener('storage', onStorage);

    // Provide a small helper for DevTools convenience
    (window as any).__setPinboardDevState = (state: 'empty' | 'auto') => {
      window.localStorage.setItem('pinboardDevState', state === 'empty' ? 'empty' : 'auto');
      setForceEmptyPinboard(state === 'empty');
      // eslint-disable-next-line no-console
      console.log('Pinboard dev state set to', state);
    };

    return () => {
      window.removeEventListener('storage', onStorage);
      try {
        delete (window as any).__setPinboardDevState;
      } catch {
        /* ignore */
      }
    };
  }, []);
  const [filterMode, setFilterMode] = useState<FilterMode>("current-chat"); //
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [folderSearch, setFolderSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isOrganizeDialogOpen, setIsOrganizeDialogOpen] = useState(false);
  const [pinFolders, setPinFolders] = useState<PinFolder[]>([]);
  const layoutContext = useContext(AppLayoutContext);
  const activeChatId = layoutContext?.activeChatId;
  const { csrfToken } = useAuth();

  const pinsToDisplay = pins;

  const handleUpdatePin = (updatedPin: PinType) => {
    setPins((prevPins) => {
      const prevMap = new Map(prevPins.map((p) => [p.id, p]));
      const previous = prevMap.get(updatedPin.id);

      // Persist comment changes to backend
      const prevComments = previous?.comments ?? [];
      const nextComments = updatedPin.comments ?? [];
      const commentsChanged =
        prevComments.length !== nextComments.length ||
        prevComments.some((val, idx) => val !== nextComments[idx]);
      if (commentsChanged && updatedPin.id) {
        updatePinComments(updatedPin.id, nextComments, csrfToken).catch((error) =>
          console.error("Failed to update pin comments", error)
        );
      }

      return prevPins.map((p) => (p.id === updatedPin.id ? updatedPin : p));
    });
  };

  const handleRemoveTag = (pinId: string, tagIndex: number) => {
    setPins((prevPins) =>
      prevPins.map((p) => {
        if (p.id === pinId) {
          const updatedTags = p.tags.filter((_, i) => i !== tagIndex);
          return { ...p, tags: updatedTags };
        }
        return p;
      })
    );
  };

  const handleDeletePin = useCallback(
    async (pinId: string) => {
      try {
        await deletePin(pinId, csrfToken);
      } catch (error) {
        console.error("Failed to delete pin", error);
      }
      setPins((prevPins) => prevPins.filter((p) => p.id !== pinId));
    },
    [csrfToken, setPins]
  );

  const handleDuplicatePin = useCallback(
    async (pin: PinType) => {
      try {
        if (!pin.sourceChatId || !pin.sourceMessageId) {
          console.error("Cannot duplicate pin: missing source chat or message ID");
          return;
        }
        
        const newPin = await createPin(
          pin.sourceChatId,
          pin.sourceMessageId,
          csrfToken,
          {
            folderId: pin.folderId || null,
            tags: [...pin.tags],
            comments: [...(pin.comments || [])],
          }
        );
        
        const createdAt = newPin.created_at ? new Date(newPin.created_at) : new Date();
        const resolvedChatId = newPin.chat || newPin.sourceChatId || pin.sourceChatId || "";
        const resolvedTitle = newPin.title || pin.title || pin.text || "Untitled Pin";
        const resolvedFolderId = newPin.folderId || newPin.folder_id || pin.folderId || undefined;
        
        const formattedPin: PinType = {
          id: newPin.id,
          text: resolvedTitle,
          title: resolvedTitle,
          tags: newPin.tags || [...pin.tags],
          notes: pin.notes || "",
          chatId: resolvedChatId,
          time: createdAt,
          messageId: newPin.sourceMessageId || pin.sourceMessageId || undefined,
          folderId: resolvedFolderId,
          folderName: newPin.folderName || pin.folderName || null,
          sourceChatId: newPin.sourceChatId || pin.sourceChatId || null,
          sourceMessageId: newPin.sourceMessageId || pin.sourceMessageId || null,
          formattedContent: newPin.formattedContent || pin.formattedContent || null,
          comments: newPin.comments || [...(pin.comments || [])],
        };
        
        setPins((prevPins) => [formattedPin, ...prevPins]);
      } catch (error) {
        console.error("Failed to duplicate pin", error);
      }
    },
    [csrfToken, setPins]
  );

  const handleMovePin = useCallback(
    async (pinId: string, folderId: string | null) => {
      try {
        await movePinToFolder(pinId, folderId, csrfToken);
        
        setPins((prevPins) =>
          prevPins.map((p) =>
            p.id === pinId
              ? {
                  ...p,
                  folderId: folderId || undefined,
                  folderName: folderId
                    ? pinFolders.find((f) => f.id === folderId)?.name || null
                    : null,
                }
              : p
          )
        );
      } catch (error) {
        console.error("Failed to move pin", error);
      }
    },
    [csrfToken, setPins, pinFolders]
  );

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    pinsToDisplay.forEach((pin) => pin.tags.forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [pinsToDisplay]);

  const loadFolders = useCallback(async () => {
    if (!isOpen) return;
    try {
      const folders = await fetchPinFolders(csrfToken);
      setPinFolders(folders);
    } catch (error) {
      console.error("Failed to load pin folders", error);
      setPinFolders((prev) =>
        prev.length > 0 ? prev : [{ id: "unorganized", name: "Unorganized" }]
      );
    }
  }, [csrfToken, isOpen]);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    if (isOpen) return;
    setIsOrganizeDialogOpen(false);
    setSearchTerm("");
    setTagSearch("");
    setSelectedTags([]);
    setFolderSearch("");
    setSelectedFolders([]);
    setFilterMode("current-chat");
    setIsSearchOpen(false);
  }, [isOpen]);

  const filteredTags = useMemo(() => {
    if (!tagSearch) {
      return allTags.slice(0, 5);
    }
    const query = tagSearch.toLowerCase();
    return allTags
      .filter((tag) => tag.toLowerCase().includes(query))
      .slice(0, 5);
  }, [allTags, tagSearch]);

  const filteredFolders = useMemo(() => {
    const folders = pinFolders.filter(f => f.id !== "unorganized");
    if (!folderSearch) {
      return folders.slice(0, 5);
    }
    const query = folderSearch.toLowerCase();
    return folders
      .filter((folder) => folder.name.toLowerCase().includes(query))
      .slice(0, 5);
  }, [pinFolders, folderSearch]);

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) => {
      const next = prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag];
      // When any tag is selected, switch to global view so tags filter across all chats
      if (next.length > 0) {
        setFilterMode("all");
      }
      return next;
    });
  };

  const handleFolderToggle = (folderId: string) => {
    setSelectedFolders((prev) => {
      const next = prev.includes(folderId) ? prev.filter((f) => f !== folderId) : [...prev, folderId];
      // When any folder is selected, switch to global view
      if (next.length > 0) {
        setFilterMode("all");
      }
      return next;
    });
  };

  const handleCreateFolder = useCallback(
    async (name: string) => {
      const created = await createPinFolder(name, csrfToken);
      setPinFolders((prev) => [...prev, created]);
      return created;
    },
    [csrfToken]
  );

  const handleRenameFolderRemote = useCallback(
    async (folderId: string, name: string) => {
      if (folderId === "unorganized") {
        return { id: folderId, name };
      }
      const updated = await renamePinFolder(folderId, name, csrfToken);
      setPinFolders((prev) =>
        prev.map((folder) => (folder.id === folderId ? updated : folder))
      );
      return { id: updated.id, name: updated.name };
    },
    [csrfToken]
  );

  const handleDeleteFolderRemote = useCallback(
    async (folderId: string) => {
      if (folderId === "unorganized") {
        return;
      }

      // Move pins out of the folder first so backend deletion succeeds (backend rejects non-empty folders).
      const pinsInFolder = pins.filter((pin) => pin.folderId === folderId);
      if (pinsInFolder.length > 0) {
        await Promise.all(
          pinsInFolder.map((pin) => movePinToFolder(pin.id, null, csrfToken))
        );
        setPins((prev) =>
          prev.map((pin) =>
            pin.folderId === folderId
              ? { ...pin, folderId: undefined, folderName: null }
              : pin
          )
        );
      }

      await deletePinFolder(folderId, csrfToken);
      setPinFolders((prev) => prev.filter((folder) => folder.id !== folderId));
    },
    [csrfToken, pins, setPins]
  );

  const handleOrganizePinsUpdate = useCallback(
    async (updatedPins: PinType[]) => {
      const currentById = new Map(pins.map((p) => [p.id, p]));
      const moves: { pinId: string; folderId: string | null }[] = [];
      for (const pin of updatedPins) {
        const prev = currentById.get(pin.id);
        const prevFolder = prev?.folderId ?? null;
        const nextFolder = pin.folderId ?? null;
        if (prevFolder !== nextFolder) {
          moves.push({ pinId: pin.id, folderId: nextFolder });
        }
      }

      if (moves.length > 0) {
        try {
          for (const move of moves) {
            const folderIdToSend =
              !move.folderId || move.folderId === "unorganized"
                ? null
                : move.folderId;
            await movePinToFolder(move.pinId, folderIdToSend, csrfToken);
          }
          loadFolders();
        } catch (error) {
          console.error("Failed to update pin folders", error);
        }
      }

      setPins(updatedPins);
    },
    [csrfToken, loadFolders, pins, setPins]
  );

  const handleInsertPin = useCallback(
    async (text: string, pin: PinType) => {
      // Strip markdown symbols to ensure clean plain text insertion
      const cleanText = stripMarkdown(text);
      if (onInsertToChat) {
        onInsertToChat(cleanText, pin);
      } else if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent(PIN_INSERT_EVENT, { detail: { text: cleanText, pin } })
        );
        toast("Inserted into prompt", {
          description: "Pin content moved to the chat input.",
        });
      }
    },
    [onInsertToChat]
  );

  const sortedAndFilteredPins = useMemo(() => {
    let filtered = pinsToDisplay;

    if (searchTerm.trim()) {
      const query = searchTerm.trim().toLowerCase();
      filtered = filtered.filter((pin) => {
        const textMatch = pin.text.toLowerCase().includes(query);
        const noteMatch = pin.notes.toLowerCase().includes(query);
        const tagMatch = pin.tags.some((tag) => tag.toLowerCase().includes(query));
        return textMatch || noteMatch || tagMatch;
      });
    }

    if (selectedTags.length > 0) {
      filtered = filtered.filter((pin) =>
        selectedTags.every((tag) => pin.tags.includes(tag))
      );
    }

    if (selectedFolders.length > 0) {
      filtered = filtered.filter((pin) =>
        pin.folderId && selectedFolders.includes(pin.folderId)
      );
    }

    switch (filterMode) {
      case "all":
        return [...filtered].sort(
          (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
        );
      case "current-chat":
        if (!activeChatId) {
          return [...filtered].sort(
            (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
          );
        }
        return filtered
          .filter((p) => p.chatId === activeChatId.toString())
          .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      case "newest":
        return [...filtered].sort(
          (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
        );
      case "oldest":
        return [...filtered].sort(
          (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
        );
      case "by-folder":
        return filtered.filter((p) => p.folderId && p.folderId !== "unorganized");
      case "unorganized":
        return filtered.filter((p) => !p.folderId || p.folderId === "unorganized");
      default:
        return filtered;
    }
  }, [pinsToDisplay, searchTerm, selectedTags, filterMode, activeChatId]);

  const handleGoToChat = useCallback(
    (pin: PinType) => {
      if (!pin.chatId) {
        toast.error("Chat not found", {
          description: "This pin is not linked to a chat.",
        });
        return;
      }
      layoutContext?.setActiveChatId(String(pin.chatId));
      setIsOrganizeDialogOpen(false);
    },
    [layoutContext]
  );

  const exportPinsToPdf = useCallback(() => {
    if (sortedAndFilteredPins.length === 0) {
      toast("No pins to export", {
        description: "Add or select pins before exporting.",
      });
      return;
    }
    if (typeof window === "undefined") return;

    const now = new Date();
    const htmlPins = sortedAndFilteredPins
      .map((pin) => {
        const tags = pin.tags.length
          ? `<div style="margin-top:6px; font-size:11px; color:#444;">Tags: ${pin.tags.join(
              ", "
            )}</div>`
          : "";
        const comments =
          Array.isArray(pin.comments) && pin.comments.length
            ? `<div style="margin-top:6px; font-size:11px; color:#444;">Comments: ${pin.comments.join(
                " | "
              )}</div>`
            : "";
        return `
          <div style="padding:12px 14px; border:1px solid #e1e1e1; border-radius:10px; margin-bottom:10px;">
            <div style="font-weight:600; font-size:14px; color:#111; margin-bottom:4px;">${stripMarkdown(
              pin.title || pin.text
            )}</div>
            <div style="font-size:12px; color:#222; white-space:pre-wrap;">${stripMarkdown(pin.text)}</div>
            ${tags}
            ${comments}
          </div>
        `;
      })
      .join("");

    const docHtml = `
      <html>
        <head>
          <title>Pins Export</title>
          <style>
            @page { margin: 18mm; }
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
            .meta { font-size: 12px; color: #555; margin-bottom: 12px; }
            .container { padding: 16px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="meta">Exported ${sortedAndFilteredPins.length} pin(s) · ${now.toLocaleString()}</div>
            ${htmlPins}
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=900,height=1200");
    if (!printWindow) {
      toast.error("Popup blocked", {
        description: "Allow popups to export pins.",
      });
      return;
    }
    printWindow.document.open();
    printWindow.document.write(docHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    setTimeout(() => {
      try {
        printWindow.close();
      } catch {
        /* ignore */
      }
    }, 300);
  }, [sortedAndFilteredPins, toast]);

  const getFilterLabel = () => {
    if (selectedTags.length > 0 && selectedFolders.length > 0) {
      return `Filtered by ${selectedTags.length} tag(s) & ${selectedFolders.length} folder(s)`;
    }
    if (selectedTags.length > 0) {
      return `Filtered by ${selectedTags.length} tag(s)`;
    }
    if (selectedFolders.length > 0) {
      return `Filtered by ${selectedFolders.length} folder(s)`;
    }
    switch (filterMode) {
      case "all":
        return "Show All Pins";
      case "current-chat":
        return "Filter by Current Chat";
      case "newest":
        return "Sort by Newest";
      case "oldest":
        return "Sort by Oldest";
      case "by-folder":
        return "Filter by Folder";
      case "unorganized":
        return "Filter by Unorganized Pins";
      default:
        return "Filter & Sort";
    }
  };

  if (!isOpen || !activePanel) {
    return (
      <>
        <OrganizePinsDialog
          isOpen={isOrganizeDialogOpen}
          onClose={() => setIsOrganizeDialogOpen(false)}
          pins={pins}
          folders={pinFolders}
          onCreateFolder={handleCreateFolder}
          onPinsUpdate={handleOrganizePinsUpdate}
          onRenameFolder={handleRenameFolderRemote}
          onDeleteFolder={handleDeleteFolderRemote}
        />
      </>
    );
  }

  const renderPinboard = () => (
    <>
      <style>{`
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: transparent transparent;
          overflow-x: hidden;
        }
        .custom-scrollbar:hover {
          scrollbar-color: #e0e0e0 #f5f5f5;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 10px;
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: transparent;
          border-radius: 8px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar {
          background: #f5f5f5;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background: #e0e0e0;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
          border-radius: 8px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-track {
          background: #f5f5f5;
        }
      `}</style>
    <div className="flex h-full flex-col">
      <div className="px-4 py-2 border-b border-[#d9d9d9] mb-1.25">
        {isSearchOpen ? (
          <div className="relative mb-1.5">
            <Search className="absolute top-[50%] left-3 -translate-y-1/2 w-4 h-4 text-[#8a8a8a]" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search Pins..."
              className="h-9 text-sm bg-[#fafafa] border border-[#e2e2e2] rounded-[7px] pl-9"
              autoFocus
            />
          </div>
        ) : null}
        <div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="flex h-9 w-full items-center justify-between rounded-[8px] bg-[#f5f5f5] px-3 text-sm font-medium text-[#171717] shadow-none hover:bg-[#E5E5E5] hover:shadow-none">
                <span className="flex items-center gap-2">
                  <MessagesSquare className="h-4 w-4 text-[#6a6a6a]" />
                  <span>{getFilterLabel()}</span>
                </span>
                <ChevronDown className="h-4 w-4 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[260px] border border-[#e6e6e6] bg-white p-1 text-[#171717]">
              <DropdownMenuItem
                className="cursor-pointer rounded-md px-3 py-2 text-[#171717] hover:bg-[#f5f5f5]"
                onSelect={() => {
                  setFilterMode("all");
                  setSelectedTags([]);
                }}
              >
                Show All Pins
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer rounded-md px-3 py-2 text-[#171717] hover:bg-[#f5f5f5]"
                onSelect={() => {
                  setFilterMode("current-chat");
                  setSelectedTags([]);
                }}
              >
                Filter by Current Chat
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer rounded-md px-3 py-2 text-[#171717] hover:bg-[#f5f5f5]"
                onSelect={() => setFilterMode("newest")}
              >
                Sort by Newest
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer rounded-md px-3 py-2 text-[#171717] hover:bg-[#f5f5f5]"
                onSelect={() => setFilterMode("oldest")}
              >
                Sort by Oldest
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer rounded-md px-3 py-2 text-[#171717] hover:bg-[#f5f5f5]"
                onSelect={() => setFilterMode("unorganized")}
              >
                Filter by Unorganized Pins
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer rounded-md px-3 py-2 text-[#171717] hover:bg-[#f5f5f5] data-[state=open]:bg-[#f5f5f5]">
                  Filter by Tags
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-[240px] border border-[#e6e6e6] bg-white p-2 text-[#171717]">
                  <div className="relative mb-2">
                    <Tag className="absolute left-3 top-[50%] h-3.5 w-3.5 -translate-y-1/2 text-[#8a8a8a]" />
                    <Input
                      placeholder="Search tags..."
                      className="h-8 rounded-md pl-8 text-sm"
                      value={tagSearch}
                      onChange={(event) => setTagSearch(event.target.value)}
                      onClick={(event) => event.preventDefault()}
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto custom-scrollbar">
                    <div className="space-y-1">
                      {filteredTags.length > 0 ? (
                      filteredTags.map((tag) => (
                          <DropdownMenuCheckboxItem
                            key={tag}
                            className="rounded-md px-2 py-1.5 text-[#171717] data-[state=checked]:bg-[#f0f0f0]"
                            checked={selectedTags.includes(tag)}
                            onCheckedChange={() => handleTagToggle(tag)}
                            onSelect={(event) => event.preventDefault()}
                          >
                            {tag}
                          </DropdownMenuCheckboxItem>
                        ))
                      ) : (
                        <DropdownMenuItem disabled className="px-2 py-1.5 text-[#9a9a9a]">No matching tags</DropdownMenuItem>
                      )}
                    </div>
                  </div>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer rounded-md px-3 py-2 text-[#171717] hover:bg-[#f5f5f5] data-[state=open]:bg-[#f5f5f5]">
                  Filter by Folder
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-[240px] border border-[#e6e6e6] bg-white p-2 text-[#171717]">
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-[50%] h-3.5 w-3.5 -translate-y-1/2 text-[#8a8a8a]" />
                    <Input
                      placeholder="Search folders..."
                      className="h-8 rounded-md pl-8 text-sm"
                      value={folderSearch}
                      onChange={(event) => setFolderSearch(event.target.value)}
                      onClick={(event) => event.preventDefault()}
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto custom-scrollbar">
                    <div className="space-y-1">
                      {filteredFolders.length > 0 ? (
                        filteredFolders.map((folder) => (
                          <DropdownMenuCheckboxItem
                            key={folder.id}
                            className="rounded-md px-2 py-1.5 text-[#171717] data-[state=checked]:bg-[#f0f0f0]"
                            checked={selectedFolders.includes(folder.id)}
                            onCheckedChange={() => handleFolderToggle(folder.id)}
                            onSelect={(event) => event.preventDefault()}
                          >
                            {folder.name}
                          </DropdownMenuCheckboxItem>
                        ))
                      ) : (
                        <DropdownMenuItem disabled className="px-2 py-1.5 text-[#9a9a9a]">No matching folders</DropdownMenuItem>
                      )}
                    </div>
                  </div>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              {(selectedTags.length > 0 || selectedFolders.length > 0) ? (
                <>
                  <Separator />
                  {selectedTags.length > 0 && (
                    <DropdownMenuItem
                      onSelect={() => setSelectedTags([])}
                      className="rounded-md px-3 py-2 text-red-500 hover:bg-[#ffecec]"
                    >
                      Clear Tag Filter
                    </DropdownMenuItem>
                  )}
                  {selectedFolders.length > 0 && (
                    <DropdownMenuItem
                      onSelect={() => setSelectedFolders([])}
                      className="rounded-md px-3 py-2 text-red-500 hover:bg-[#ffecec]"
                    >
                      Clear Folder Filter
                    </DropdownMenuItem>
                  )}
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {(sortedAndFilteredPins.length > 0 && !forceEmptyPinboard) ? (
          <div className="space-y-2.5 pt-2 pb-24 flex flex-col items-center" style={{ paddingLeft: '21.5px', paddingRight: '21.5px' }}>
            {sortedAndFilteredPins.map((pin) => {
              const chatBoard = chatBoards.find((board) => board.id.toString() === pin.chatId);
              return (
                <PinItem
                  key={pin.id}
                  pin={pin}
                  onUpdatePin={handleUpdatePin}
                  onRemoveTag={handleRemoveTag}
                  onDeletePin={handleDeletePin}
                  chatName={chatBoard?.name}
                  onInsertToChat={handleInsertPin}
                  onGoToChat={handleGoToChat}
                  folders={pinFolders}
                  onDuplicatePin={handleDuplicatePin}
                  onMovePin={handleMovePin}
                  onCreateFolder={handleCreateFolder}
                />
              );
            })}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center" style={{ paddingLeft: '21.5px', paddingRight: '21.5px' }}>
            <div className="flex flex-col items-center gap-2 w-[231px] h-[200px] text-center text-sm text-[#5a5a5a]">
              {/* Pin Icon Dimensions in right-sidebar */}
              <Pin className="h-20 w-16 text-[#ABABAB]" />
              <p className="text-base font-semibold text-[#1e1e1e]">No pins yet</p>
              <p className="text-sm text-[#5a5a5a]">
                Pin useful answers or references from your chats to keep them handy for later.
              </p>
            </div>
          </div>
        )}
      </div>
      <div className="pinboard-footer">
        {/* Organise pins button CTA*/}
        <Button
          size="sm"
          className="h-9 w-full justify-center gap-2 rounded-[7px] bg-[#f1f1f1] text-sm font-medium text-[#1e1e1e] shadow-none hover:bg-[#e7e7e7] hover:shadow-none"
          onClick={() => setIsOrganizeDialogOpen(true)}
        >
          <FolderPlus className="cursor-pointer h-4 w-4" />
          Organize Pins
        </Button>

        {/* Export Pins button CTA */}
        <Button
          variant="outline"
          className={cn(
            "cursor-pointer h-9 w-full rounded-[7px] border-[#d0d0d0] text-sm font-medium text-[#1e1e1e] shadow-none hover:bg-[#e7e7e7] hover:shadow-none hover:text-[#1e1e1e] transition-opacity",
            sortedAndFilteredPins.length === 0 && "opacity-30"
          )}
          disabled={sortedAndFilteredPins.length === 0}
          onClick={exportPinsToPdf}
        >
          <Download className="mr-2 h-4 w-4" />
          Export Pins
        </Button>
      </div>
    </div>
    </>
  );

  const renderPlaceholder = (panel: Exclude<RightSidebarPanel, "pinboard">) => (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="rounded-full bg-[#f5f5f5] p-4">
        {panel === "files" ? (
          <File className="h-8 w-8 text-[#1e1e1e]" />
        ) : panel === "personas" ? (
          <UserPlus className="h-8 w-8 text-[#1e1e1e]" />
        ) : (
          <GitCompare className="h-8 w-8 text-[#1e1e1e]" />
        )}
      </div>
      <div>
        <p className="text-base font-semibold text-[#1e1e1e]">
          {EMPTY_PLACEHOLDERS[panel].title}
        </p>
        <p className="mt-1 text-sm text-[#5a5a5a]">
          {EMPTY_PLACEHOLDERS[panel].description}
        </p>
      </div>
    </div>
  );

  const panelContent =
    activePanel === "pinboard"
      ? renderPinboard()
      : renderPlaceholder(activePanel as Exclude<RightSidebarPanel, "pinboard">);

  const header = PANEL_METADATA[activePanel];

  return (
    <>
      <aside
        className={cn(
          "hidden h-full w-[278px] flex-shrink-0 flex-col border-l border-[#d9d9d9] bg-white shadow-sm lg:flex",
          className
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-[#d9d9d9] px-4 py-4">
            <p className="text-base font-semibold text-[#1e1e1e]">{header.title}</p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSearchOpen((prev) => !prev)}
                aria-pressed={isSearchOpen}
                className={cn(
                  "border border-transparent bg-[#f5f5f5] text-[#1e1e1e] hover:bg-[#e8e8e8] group",
                  isSearchOpen && "border-[#1e1e1e]"
                )}
                style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px', borderRadius: '8px', padding: '7px' }}
              >
                <Search className="h-full w-full text-[#1e1e1e] group-hover:text-black" strokeWidth={1.5} style={{ strokeWidth: '1.5' }} />
                <span className="sr-only">Toggle search</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="bg-[#f5f5f5] text-[#1e1e1e] hover:bg-[#e8e8e8] group"
                style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px', borderRadius: '8px', padding: '7px' }}
              >
                <X className="h-full w-full text-[#1e1e1e] group-hover:text-black" strokeWidth={1.5} style={{ strokeWidth: '1.5' }} />
                <span className="sr-only">Close sidebar</span>
              </Button>
            </div>
          </div>
          {panelContent}
        </div>
      </aside>
      <OrganizePinsDialog
        isOpen={isOrganizeDialogOpen}
        onClose={() => setIsOrganizeDialogOpen(false)}
        pins={pins}
        folders={pinFolders}
        onCreateFolder={handleCreateFolder}
        onPinsUpdate={handleOrganizePinsUpdate}
        onRenameFolder={handleRenameFolderRemote}
        onDeleteFolder={handleDeleteFolderRemote}
        chatBoards={chatBoards}
      />
    </>
  );
}
