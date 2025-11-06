
"use client";

import { useState, useMemo, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Pin, Search, Files, ChevronsLeft, ChevronDown, Download, X } from "lucide-react";
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuCheckboxItem } from "../ui/dropdown-menu";
import type { ChatBoard } from "./chat-list-sidebar";
import { PinItem } from "../pinboard/pin-item";
import { AppLayoutContext } from "./app-layout";
import { Separator } from "../ui/separator";

export interface PinType {
  id: string;
  text: string;
  tags: string[];
  notes: string;
  chatId: string;
  time: Date;
}

interface RightSidebarProps {
    isCollapsed: boolean;
    onToggle: () => void;
    pins: PinType[];
    setPins: React.Dispatch<React.SetStateAction<PinType[]>>;
    chatBoards: ChatBoard[];
}

type FilterMode = 'current-chat' | 'newest' | 'oldest' | 'a-z' | 'z-a';

export function RightSidebar({ isCollapsed, onToggle, pins, setPins, chatBoards }: RightSidebarProps) {
  const [activeTab, setActiveTab] = useState("Pins");
  const [filterMode, setFilterMode] = useState<FilterMode>('current-chat');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState('');
  const layoutContext = useContext(AppLayoutContext);
  const activeChatId = layoutContext?.activeChatId;

  const handleUpdatePin = (updatedPin: PinType) => {
    setPins(prevPins => prevPins.map(p => p.id === updatedPin.id ? updatedPin : p));
  };
  
  const handleRemoveTag = (pinId: string, tagIndex: number) => {
      setPins(prevPins => prevPins.map(p => {
          if (p.id === pinId) {
              const updatedTags = p.tags.filter((_, i) => i !== tagIndex);
              return { ...p, tags: updatedTags };
          }
          return p;
      }));
  };

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    pins.forEach(pin => pin.tags.forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [pins]);

  const filteredTags = useMemo(() => {
    if (!tagSearch) {
      return allTags.slice(0, 5);
    }
    return allTags.filter(tag => tag.toLowerCase().includes(tagSearch.toLowerCase())).slice(0, 5);
  }, [allTags, tagSearch]);


  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const sortedAndFilteredPins = useMemo(() => {
    let filtered = pins;
    
    if (selectedTags.length > 0) {
        filtered = pins.filter(pin => selectedTags.every(tag => pin.tags.includes(tag)));
    }

    switch(filterMode) {
      case 'current-chat':
        return filtered.filter(p => p.chatId === activeChatId?.toString()).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      case 'newest':
        return [...filtered].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      case 'oldest':
        return [...filtered].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
      case 'a-z':
        return [...filtered].sort((a, b) => a.text.localeCompare(b.text));
      case 'z-a':
        return [...filtered].sort((a, b) => b.text.localeCompare(a.text));
      default:
        return filtered;
    }
  }, [pins, filterMode, activeChatId, selectedTags]);

  const getFilterLabel = () => {
    if (selectedTags.length > 0) {
        return `Filtered by ${selectedTags.length} tag(s)`;
    }
    switch (filterMode) {
        case 'current-chat': return 'Filter by Current Chat';
        case 'newest': return 'Sort by Newest';
        case 'oldest': return 'Sort by Oldest';
        case 'a-z': return 'Sort A-Z';
        case 'z-a': return 'Sort Z-A';
        default: return 'Filter & Sort';
    }
  }


  return (
    <aside className={cn(
        "border-l bg-card hidden lg:flex flex-col transition-all duration-300 ease-in-out relative",
        isCollapsed ? "w-[58px]" : "w-[300px]"
        )}>
        
        <Button variant="ghost" size="icon" onClick={onToggle} className="absolute top-1/2 -translate-y-1/2 -left-4 bg-card border hover:bg-accent z-10 h-8 w-8 rounded-full">
            <ChevronsLeft className={cn("h-4 w-4 transition-transform", !isCollapsed && "rotate-180")}/>
        </Button>
        
        <div className="flex flex-col h-full">
          {isCollapsed ? (
              <div className="flex flex-col items-center py-4 space-y-4">
                  <Pin className="h-6 w-6" />
              </div>
          ) : (
            <>
              <div className="p-4 border-b shrink-0">
                  <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                          <Pin className="h-4 w-4" />
                          <h2 className="font-medium text-base">Pinboard</h2>
                      </div>
                  </div>
                  <div className="relative mt-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search pins..." className="pl-9 bg-background rounded-[25px]" />
                  </div>
                  <div className="mt-4 flex gap-2">
                      <Button variant="outline" className="w-full rounded-[25px] h-9" onClick={() => setActiveTab('Pins')}>
                          <Pin className="mr-2 h-4 w-4" />
                          Pins
                      </Button>
                      <Button variant="outline" className="w-full rounded-[25px] h-9" onClick={() => setActiveTab('Files')}>
                          <Files className="mr-2 h-4 w-4" />
                          Files
                      </Button>
                  </div>
                  <div className="mt-4">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="w-full justify-between rounded-[25px] h-9">
                                <span>{getFilterLabel()}</span>
                                <ChevronDown className="h-4 w-4 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[268px]">
                            <DropdownMenuItem onSelect={() => { setFilterMode('current-chat'); setSelectedTags([]); }}>Filter by Current Chat</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setFilterMode('newest')}>Sort by Newest</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setFilterMode('oldest')}>Sort by Oldest</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setFilterMode('a-z')}>Sort A-Z</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setFilterMode('z-a')}>Sort Z-A</DropdownMenuItem>
                            <Separator />
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger>Filter by Tags</DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="p-2">
                                    <Input
                                        placeholder="Search tags..."
                                        className="mb-2 h-8"
                                        value={tagSearch}
                                        onChange={(e) => setTagSearch(e.target.value)}
                                        onClick={(e) => e.preventDefault()}
                                    />
                                    <ScrollArea className="h-auto max-h-48">
                                        <div className="space-y-1">
                                            {filteredTags.length > 0 ? filteredTags.map(tag => (
                                                <DropdownMenuCheckboxItem
                                                    key={tag}
                                                    checked={selectedTags.includes(tag)}
                                                    onCheckedChange={() => handleTagToggle(tag)}
                                                    onSelect={(e) => e.preventDefault()}
                                                >
                                                    {tag}
                                                </DropdownMenuCheckboxItem>
                                            )) : (
                                                <DropdownMenuItem disabled>No matching tags</DropdownMenuItem>
                                            )}
                                        </div>
                                    </ScrollArea>
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                             {selectedTags.length > 0 && (
                                <>
                                <Separator />
                                <DropdownMenuItem onSelect={() => setSelectedTags([])} className="text-red-500">Clear Tag Filter</DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
              </div>
              <ScrollArea className="flex-1 min-h-0">
                  <div className="p-4 space-y-3">
                  {sortedAndFilteredPins.length > 0 ? sortedAndFilteredPins.map((pin) => {
                      const chatBoard = chatBoards.find(board => board.id.toString() === pin.chatId);
                      return (
                        <PinItem key={pin.id} pin={pin} onUpdatePin={handleUpdatePin} onRemoveTag={handleRemoveTag} chatName={chatBoard?.name} />
                      )
                  }) : (
                      <div className="text-center text-sm text-muted-foreground py-10">
                          No pins found for this filter.
                      </div>
                  )}
                  </div>
              </ScrollArea>
              <div className="p-4 border-t shrink-0">
                  <Button variant="ghost" className="w-full rounded-[25px] h-9">
                      <Download className="mr-2 h-4 w-4" />
                      Export Pins
                  </Button>
              </div>
            </>
          )}
        </div>
    </aside>
  );
}
