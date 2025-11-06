
"use client";

import { useState, KeyboardEvent, type Dispatch, type SetStateAction, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Pin, Search, X, Files, ChevronsLeft, ChevronDown, Download } from "lucide-react";
import { Badge } from "../ui/badge";
import { Textarea } from "../ui/textarea";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { formatDistanceToNow } from 'date-fns';
import type { ChatBoard } from "./chat-list-sidebar";

export interface Pin {
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
    pins: Pin[];
    setPins: Dispatch<SetStateAction<Pin[]>>;
    chatBoards: ChatBoard[];
}

const PinItem = ({ pin, onUpdatePin, onRemoveTag, chatName }: { pin: Pin, onUpdatePin: (updatedPin: Pin) => void, onRemoveTag: (pinId: string, tagIndex: number) => void, chatName?: string }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [tagInput, setTagInput] = useState('');
    const [noteInput, setNoteInput] = useState(pin.notes);
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (isEditingNotes && notesTextareaRef.current) {
            notesTextareaRef.current.focus();
        }
    }, [isEditingNotes]);

    const handleTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' && tagInput.trim()) {
          event.preventDefault();
          const updatedPin = { ...pin, tags: [...pin.tags, tagInput.trim()] };
          onUpdatePin(updatedPin);
          setTagInput('');
        }
    };
    
    const handleSaveNote = () => {
        onUpdatePin({ ...pin, notes: noteInput });
        setIsEditingNotes(false);
        toast({ title: "Note saved!" });
    };

    const handleNoteKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSaveNote();
        }
    }

    return (
        <Card className="bg-background rounded-2xl">
            <CardContent className="p-3 space-y-2">
                <p className="text-xs text-card-foreground/90">
                    {isExpanded || pin.text.length <= 100 ? pin.text : `${pin.text.substring(0, 100)}...`}
                    {pin.text.length > 100 && (
                        <Button variant="link" className="h-auto p-0 ml-1 text-xs" onClick={() => setIsExpanded(!isExpanded)}>
                            {isExpanded ? "Read less" : "Read more"}
                        </Button>
                    )}
                </p>

                <div className="flex items-center gap-2 flex-wrap">
                    {pin.tags.map((tag, tagIndex) => (
                        <Badge key={tagIndex} variant="default" className="font-normal bg-primary/90 text-primary-foreground text-[10px] py-0.5 rounded-md">
                            {tag}
                            <button onClick={() => onRemoveTag(pin.id, tagIndex)} className="ml-1.5 focus:outline-none">
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    ))}
                    <Input 
                        placeholder="+ Add tags" 
                        className="text-xs h-6 flex-1 min-w-[60px] bg-transparent border-dashed rounded-md"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleTagKeyDown}
                        style={{ fontSize: '10px' }}
                    />
                </div>
                
                <div onClick={() => !isEditingNotes && setIsEditingNotes(true)}>
                    {isEditingNotes ? (
                        <div className="relative">
                            <Textarea 
                                ref={notesTextareaRef}
                                placeholder="Add private notes..." 
                                className="text-xs bg-card mt-1 resize-none pr-8 rounded-md p-1 min-h-[24px]" 
                                value={noteInput}
                                onChange={(e) => setNoteInput(e.target.value)}
                                onKeyDown={handleNoteKeyDown}
                                onBlur={handleSaveNote}
                                style={{ fontSize: '10px' }}
                                rows={1}
                            />
                        </div>
                    ) : (
                        <div className="text-xs bg-card mt-1 p-1 rounded-md min-h-[24px] cursor-text border border-transparent hover:border-dashed hover:border-input">
                            {pin.notes || <span className="text-muted-foreground">Add private notes...</span>}
                        </div>
                    )}
                </div>

                <div className="flex justify-between items-center pt-1">
                    <Badge variant="outline" className="font-normal border-dashed text-[10px] rounded-md">{chatName || `Chat ${pin.chatId}`}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(pin.time), { addSuffix: true })}</span>
                </div>
            </CardContent>
        </Card>
    );
};


export function RightSidebar({ isCollapsed, onToggle, pins, setPins, chatBoards }: RightSidebarProps) {
  const [activeTab, setActiveTab] = useState("Pins");
  const [sortOrder, setSortOrder] = useState('newest');

  const handleUpdatePin = (updatedPin: Pin) => {
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

  const sortedPins = [...pins].sort((a, b) => {
      if (sortOrder === 'newest') {
          return new Date(b.time).getTime() - new Date(a.time).getTime();
      }
      // Add logic for 'chats' sorting if needed
      return 0;
  });

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
                      <Button variant={activeTab === 'Pins' ? 'secondary' : 'ghost'} className="w-full rounded-[25px] h-9" onClick={() => setActiveTab('Pins')}>
                          <Pin className="mr-2 h-4 w-4" />
                          Pins
                      </Button>
                      <Button variant={activeTab === 'Files' ? 'secondary' : 'ghost'} className="w-full rounded-[25px] h-9" onClick={() => setActiveTab('Files')}>
                          <Files className="mr-2 h-4 w-4" />
                          Files
                      </Button>
                  </div>
                  <div className="mt-4">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="w-full justify-between rounded-[25px] h-9">
                                <span>{sortOrder === 'newest' ? 'Filter by Newest' : 'Filter by Chats'}</span>
                                <ChevronDown className="h-4 w-4 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[268px]">
                            <DropdownMenuItem onSelect={() => setSortOrder('chats')}>Filter by Chats</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setSortOrder('newest')}>Filter by Newest</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
              </div>
              <ScrollArea className="flex-1 min-h-0">
                  <div className="p-4 space-y-3">
                  {sortedPins.length > 0 ? sortedPins.map((pin) => {
                      const chatBoard = chatBoards.find(board => board.id.toString() === pin.chatId);
                      return (
                        <PinItem key={pin.id} pin={pin} onUpdatePin={handleUpdatePin} onRemoveTag={handleRemoveTag} chatName={chatBoard?.name} />
                      )
                  }) : (
                      <div className="text-center text-sm text-muted-foreground py-10">
                          No pins yet.
                      </div>
                  )}
                  </div>
              </ScrollArea>
              <div className="p-4 border-t shrink-0">
                  <Button variant="secondary" className="w-full rounded-[25px] h-9">
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
