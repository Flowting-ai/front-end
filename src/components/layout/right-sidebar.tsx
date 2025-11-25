
"use client";

import { useState, useMemo, useContext, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  createPinFolder,
  fetchPinFolders,
  movePinToFolder,
  type PinFolder,
} from "@/lib/api/pins";

export interface PinType {
  id: string;
  text: string;
  tags: string[];
  notes: string;
  chatId: string;
  time: Date;
  messageId?: string;
  folderId?: string;
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
  onInsertToChat?: (text: string) => void;
}

type FilterMode = "all" | "current-chat" | "newest" | "oldest" | "by-folder" | "unorganized";

const samplePins: PinType[] = [
  {
    id: "pin1",
    text: "This is the first sample pin about project requirements and initial planning.",
    tags: ["planning", "urgent"],
    notes: "Remember to follow up with the design team.",
    chatId: "1",
    time: new Date(Date.now() - 3600000),
    folderId: "unorganized",
  },
  {
    id: "pin2",
    text: "A second pin containing technical details for the API implementation.",
    tags: ["technical", "api"],
    notes: "",
    chatId: "2",
    time: new Date(Date.now() - 86400000),
    folderId: "research",
  },
  {
    id: "pin3",
    text: "Here is a third one related to marketing copy and campaign ideas.",
    tags: ["marketing"],
    notes: "Check the new copy deck.",
    chatId: "1",
    time: new Date(Date.now() - 172800000),
    folderId: "research",
  },
];

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
  const [filterMode, setFilterMode] = useState<FilterMode>("current-chat");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isOrganizeDialogOpen, setIsOrganizeDialogOpen] = useState(false);
  const [pinFolders, setPinFolders] = useState<PinFolder[]>([]);
  const layoutContext = useContext(AppLayoutContext);
  const activeChatId = layoutContext?.activeChatId;
  const { csrfToken } = useAuth();

  const pinsToDisplay = pins.length > 0 ? pins : samplePins;

  const handleUpdatePin = (updatedPin: PinType) => {
    setPins((prevPins) => prevPins.map((p) => (p.id === updatedPin.id ? updatedPin : p)));
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

  const handleDeletePin = (pinId: string) => {
    setPins((prevPins) => prevPins.filter((p) => p.id !== pinId));
  };

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

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleCreateFolder = useCallback(
    async (name: string) => {
      const created = await createPinFolder(name, csrfToken);
      setPinFolders((prev) => [...prev, created]);
      return created;
    },
    [csrfToken]
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

  const getFilterLabel = () => {
    if (selectedTags.length > 0) {
      return `Filtered by ${selectedTags.length} tag(s)`;
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
        />
      </>
    );
  }

  const renderPinboard = () => (
    <div className="flex h-full flex-col">
      <div className="px-4 py-2 border-b border-[#d9d9d9]" style={{ paddingBottom: '5px' }}>
        {isSearchOpen ? (
          <div className="relative" style={{ paddingBottom: '5px' }}>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8a8a]" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search pins..."
              className="h-9 rounded-full border border-[#e2e2e2] bg-[#fafafa] pl-9 text-sm"
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
                className="rounded-md px-3 py-2 text-[#171717] hover:bg-[#f5f5f5]"
                onSelect={() => {
                  setFilterMode("all");
                  setSelectedTags([]);
                }}
              >
                Show All Pins
              </DropdownMenuItem>
              <DropdownMenuItem
                className="rounded-md px-3 py-2 text-[#171717] hover:bg-[#f5f5f5]"
                onSelect={() => {
                  setFilterMode("current-chat");
                  setSelectedTags([]);
                }}
              >
                Filter by Current Chat
              </DropdownMenuItem>
              <DropdownMenuItem
                className="rounded-md px-3 py-2 text-[#171717] hover:bg-[#f5f5f5]"
                onSelect={() => setFilterMode("newest")}
              >
                Sort by Newest
              </DropdownMenuItem>
              <DropdownMenuItem
                className="rounded-md px-3 py-2 text-[#171717] hover:bg-[#f5f5f5]"
                onSelect={() => setFilterMode("oldest")}
              >
                Sort by Oldest
              </DropdownMenuItem>
              <DropdownMenuItem
                className="rounded-md px-3 py-2 text-[#171717] hover:bg-[#f5f5f5]"
                onSelect={() => setFilterMode("by-folder")}
              >
                Filter by Folder
              </DropdownMenuItem>
              <DropdownMenuItem
                className="rounded-md px-3 py-2 text-[#171717] hover:bg-[#f5f5f5]"
                onSelect={() => setFilterMode("unorganized")}
              >
                Filter by Unorganized Pins
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="rounded-md px-3 py-2 text-[#171717] hover:bg-[#f5f5f5] data-[state=open]:bg-[#f5f5f5]">
                  Filter by Tags
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-[240px] border border-[#e6e6e6] bg-white p-2 text-[#171717]">
                  <div className="relative">
                    <Tag className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a8a8a]" />
                    <Input
                      placeholder="Search tags..."
                      className="mb-2 h-8 rounded-md pl-8 text-sm"
                      value={tagSearch}
                      onChange={(event) => setTagSearch(event.target.value)}
                      onClick={(event) => event.preventDefault()}
                    />
                  </div>
                  <ScrollArea className="max-h-48">
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
                  </ScrollArea>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              {selectedTags.length > 0 ? (
                <>
                  <Separator />
                  <DropdownMenuItem
                    onSelect={() => setSelectedTags([])}
                    className="rounded-md px-3 py-2 text-red-500 hover:bg-[#ffecec]"
                  >
                    Clear Tag Filter
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-2.5 pt-2 pb-4 flex flex-col items-center" style={{ paddingLeft: '21.5px', paddingRight: '21.5px' }}>
          {sortedAndFilteredPins.length > 0 ? (
            sortedAndFilteredPins.map((pin) => {
              const chatBoard = chatBoards.find((board) => board.id.toString() === pin.chatId);
              return (
                <PinItem
                  key={pin.id}
                  pin={pin}
                  onUpdatePin={handleUpdatePin}
                  onRemoveTag={handleRemoveTag}
                  onDeletePin={handleDeletePin}
                  chatName={chatBoard?.name}
                  onInsertToChat={onInsertToChat}
                />
              );
            })
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[#dcdcdc] px-6 py-8 text-center text-sm text-[#5a5a5a]">
              <Pin className="h-8 w-8 text-[#1e1e1e]" />
              <p className="text-base font-semibold text-[#1e1e1e]">No pins yet</p>
              <p className="text-sm text-[#5a5a5a]">
                Pin useful answers or references from your chats to keep them handy for later.
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="pinboard-footer">
        <Button
          size="sm"
          className="h-9 w-full justify-center gap-2 rounded-full bg-[#f1f1f1] text-sm font-medium text-[#1e1e1e] shadow-none hover:bg-[#e7e7e7] hover:shadow-none"
          onClick={() => setIsOrganizeDialogOpen(true)}
        >
          <FolderPlus className="h-4 w-4" />
          Organize Pins
        </Button>
        <Button
          variant="outline"
          className={cn(
            "h-9 w-full rounded-full border-[#d0d0d0] text-sm font-medium text-[#1e1e1e] shadow-none hover:bg-[#e7e7e7] hover:shadow-none hover:text-[#1e1e1e] transition-opacity",
            sortedAndFilteredPins.length === 0 && "opacity-30"
          )}
          disabled={sortedAndFilteredPins.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          Export Pins
        </Button>
      </div>
    </div>
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
        chatBoards={chatBoards}
      />
    </>
  );
}
