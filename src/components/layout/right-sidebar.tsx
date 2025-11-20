
"use client";

import { useState, useMemo, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Pin, Search, Folder, ChevronsLeft, ChevronDown, Download, Tag, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuCheckboxItem } from "../ui/dropdown-menu";
import type { ChatBoard } from "./app-layout";
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
  messageId?: string;
}

interface RightSidebarProps {
    isCollapsed: boolean;
    onToggle: () => void;
    pins: PinType[];
    setPins: React.Dispatch<React.SetStateAction<PinType[]>>;
    chatBoards: ChatBoard[];
}

type FilterMode = 'current-chat' | 'newest' | 'oldest' | 'a-z' | 'z-a';

const samplePins: PinType[] = [
    {
      id: 'pin1',
      text: 'This is the first sample pin about project requirements and initial planning.',
      tags: ['planning', 'urgent'],
      notes: 'Remember to follow up with the design team.',
      chatId: '1',
      time: new Date(Date.now() - 3600000),
    },
    {
      id: 'pin2',
      text: 'A second pin containing technical details for the API implementation.',
      tags: ['technical', 'api'],
      notes: '',
      chatId: '2',
      time: new Date(Date.now() - 86400000),
    },
    {
      id: 'pin3',
      text: 'Here is a third one related to marketing copy and campaign ideas.',
      tags: ['marketing'],
      notes: 'Check the new copy deck.',
      chatId: '1',
      time: new Date(Date.now() - 172800000),
    },
];


export function RightSidebar({ isCollapsed, onToggle, pins: initialPins, setPins: setInitialPins, chatBoards }: RightSidebarProps) {
  const [pins, setPins] = useState<PinType[]>(initialPins.length > 0 ? initialPins : samplePins);
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
        "hidden lg:flex flex-col transition-all duration-300 ease-in-out relative",
        isCollapsed ? "w-[58px]" : "w-[300px]"
        )}
        style={{ backgroundColor: 'hsl(var(--right-sidebar-background))' }}
        >
        
        <Button variant="ghost" size="icon" onClick={onToggle} className="absolute top-1/2 -translate-y-1/2 -left-4 bg-card border hover:bg-accent z-10 h-8 w-8 rounded-full">
            <ChevronsLeft className={cn("h-4 w-4 transition-transform", !isCollapsed && "rotate-180")}/>
        </Button>
        
        {!isCollapsed && (
          <div className="flex flex-col h-full">
              <div className="p-4 border-b shrink-0 space-y-2">
                  <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                          <Pin className="h-4 w-4" />
                          <h2 className="font-medium text-base">Pinboard</h2>
                      </div>
                      <Button variant="ghost" size="icon" onClick={onToggle} className="h-8 w-8 rounded-full">
                          <X className="h-4 w-4" />
                      </Button>
                  </div>
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2" style={{ backgroundColor: '#767676', color: 'white', borderColor: '#767676' }}>
                    <Folder className="h-4 w-4" />
                    Organize Pins
                  </Button>
                  <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search pins..." className="pl-9 bg-background rounded-md h-9" />
                  </div>
                  <div className="mt-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="w-full justify-between rounded-md h-9" style={{ backgroundColor: '#D9D9D9', borderColor: '#D9D9D9' }}>
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
                                    <div className="relative">
                                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                        <Input
                                            placeholder="Search tags..."
                                            className="mb-2 h-8 rounded-md pl-8"
                                            value={tagSearch}
                                            onChange={(e) => setTagSearch(e.target.value)}
                                            onClick={(e) => e.preventDefault()}
                                        />
                                    </div>
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
                      <div className="text-center text-sm text-muted-foreground py-10 flex flex-col items-center gap-2">
                          <Pin className="h-8 w-8 text-muted-foreground" />
                          <p className="font-bold text-base text-foreground">No pins yet</p>
                          <p className="max-w-xs px-4">Pin useful answers or references from your chats to keep them handy for later.</p>
                      </div>
                  )}
                  </div>
              </ScrollArea>
              <div className="p-4 border-t shrink-0">
                  <Button variant="outline" className="w-full rounded-md h-9">
                      <Download className="mr-2 h-4 w-4" />
                      Export Pins
                  </Button>
              </div>
          </div>
        )}
        {isCollapsed && (
             <div className="flex flex-col items-center py-4 space-y-4">
                  <Pin className="h-6 w-6" />
              </div>
        )}
    </aside>
  );
}
