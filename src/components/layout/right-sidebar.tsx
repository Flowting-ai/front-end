
"use client";

import { useState, useMemo, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Pin, Search, Files, ChevronsLeft, ChevronDown, Download, X } from "lucide-react";
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import type { ChatBoard } from "./chat-list-sidebar";
import { PinItem } from "../pinboard/pin-item";
import { AppLayoutContext } from "./app-layout";

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

export function RightSidebar({ isCollapsed, onToggle, pins, setPins, chatBoards }: RightSidebarProps) {
  const [activeTab, setActiveTab] = useState("Pins");
  const [filterMode, setFilterMode] = useState<'current-chat' | 'newest' | 'oldest' | 'tags'>('current-chat');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
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
    return Array.from(tagSet);
  }, [pins]);

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => {
        const newSelected = prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag];
        if (newSelected.length > 0) {
            setFilterMode('tags');
        } else {
            setFilterMode('current-chat');
        }
        return newSelected;
    });
  };

  const sortedAndFilteredPins = useMemo(() => {
    let filtered = pins;
    
    switch(filterMode) {
      case 'current-chat':
        filtered = pins.filter(p => p.chatId === activeChatId?.toString());
        return filtered.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      case 'newest':
        return [...pins].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      case 'oldest':
        return [...pins].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
      case 'tags':
        if(selectedTags.length === 0) return [];
        return pins.filter(pin => selectedTags.every(tag => pin.tags.includes(tag)));
      default:
        return pins;
    }
  }, [pins, filterMode, activeChatId, selectedTags]);

  const getFilterLabel = () => {
    switch (filterMode) {
        case 'current-chat': return 'Filter by Current Chat';
        case 'newest': return 'Filter by Newest';
        case 'oldest': return 'Filter by Oldest';
        case 'tags': return `Filtered by ${selectedTags.length} tag(s)`;
        default: return 'Filter by...';
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
                      <Button variant={activeTab === 'Pins' ? 'outline' : 'ghost'} className="w-full rounded-[25px] h-9" onClick={() => setActiveTab('Pins')}>
                          <Pin className="mr-2 h-4 w-4" />
                          Pins
                      </Button>
                      <Button variant={activeTab === 'Files' ? 'outline' : 'ghost'} className="w-full rounded-[25px] h-9" onClick={() => setActiveTab('Files')}>
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
                            <DropdownMenuItem onSelect={() => setFilterMode('current-chat')}>Filter by Current Chat</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setFilterMode('newest')}>Filter by Newest</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setFilterMode('oldest')}>Filter by Oldest</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {allTags.length > 0 && (
                      <div className="mt-2 space-y-2">
                          <h4 className="text-xs font-semibold text-muted-foreground px-2">Filter by Tags</h4>
                          <div className="flex flex-wrap gap-1">
                              {allTags.map(tag => (
                                  <Badge
                                      key={tag}
                                      variant={selectedTags.includes(tag) ? 'default' : 'secondary'}
                                      onClick={() => handleTagToggle(tag)}
                                      className="cursor-pointer font-normal text-foreground text-[10px] py-0.5 rounded-md"
                                  >
                                      {tag}
                                      {selectedTags.includes(tag) && <X className="ml-1 h-3 w-3" />}
                                  </Badge>
                              ))}
                          </div>
                      </div>
                  )}
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
