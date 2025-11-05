
"use client";

import { useState, KeyboardEvent, type Dispatch, type SetStateAction, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Pin, Search, X, Files, ChevronDown, ChevronsLeft } from "lucide-react";
import { Badge } from "../ui/badge";
import { Textarea } from "../ui/textarea";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export interface Pin {
  id: string;
  text: string;
  tags: string[];
  notes: string;
  chat: string;
  time: string;
}

interface RightSidebarProps {
    isCollapsed: boolean;
    onToggle: () => void;
    pins: Pin[];
    setPins: Dispatch<SetStateAction<Pin[]>>;
}

const PinItem = ({ pin, onUpdatePin }: { pin: Pin, onUpdatePin: (updatedPin: Pin) => void }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [tagInput, setTagInput] = useState('');
    const [noteInput, setNoteInput] = useState(pin.notes);
    const { toast } = useToast();

    const handleTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' && tagInput.trim()) {
          event.preventDefault();
          const updatedPin = { ...pin, tags: [...pin.tags, tagInput.trim()] };
          onUpdatePin(updatedPin);
          setTagInput('');
        }
    };

    const removeTag = (tagIndex: number) => {
        const updatedTags = pin.tags.filter((_, i) => i !== tagIndex);
        onUpdatePin({ ...pin, tags: updatedTags });
    };

    const handleNoteKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            onUpdatePin({ ...pin, notes: noteInput });
            toast({ title: "Note saved!" });
            (event.target as HTMLTextAreaElement).blur();
        }
    }
    
    const handleNoteBlur = () => {
        if (noteInput !== pin.notes) {
            onUpdatePin({ ...pin, notes: noteInput });
            toast({ title: "Note saved!" });
        }
    };

    return (
        <Card className="bg-background">
            <CardContent className="p-3 space-y-2">
                <p className="text-xs">
                    {isExpanded || pin.text.length <= 100 ? pin.text : `${pin.text.substring(0, 100)}...`}
                    {pin.text.length > 100 && (
                        <Button variant="link" className="h-auto p-0 ml-1 text-xs" onClick={() => setIsExpanded(!isExpanded)}>
                            {isExpanded ? "Read less" : "Read more"}
                        </Button>
                    )}
                </p>
                <div className="flex items-center gap-1 flex-wrap">
                    {pin.tags.map((tag, tagIndex) => (
                        <Badge key={tagIndex} variant="secondary" className="font-normal" style={{ fontSize: '8px', padding: '2px 4px' }}>
                            {tag}
                            <button onClick={() => removeTag(tagIndex)} className="ml-1 focus:outline-none">
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    ))}
                </div>
                 <Input 
                    placeholder="Add tags..." 
                    className="text-xs h-6 mt-1"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    style={{ fontSize: '10px' }}
                />
                <div>
                    <Textarea 
                        placeholder="Add private notes..." 
                        className="text-xs bg-card mt-1" 
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        onKeyDown={handleNoteKeyDown}
                        onBlur={handleNoteBlur}
                        style={{ fontSize: '10px' }}
                    />
                </div>
                <div className="flex justify-between items-center pt-2">
                    <Badge variant="outline" className="font-normal border-dashed text-[10px]">{pin.chat}</Badge>
                    <span className="text-xs text-muted-foreground">{pin.time}</span>
                </div>
            </CardContent>
        </Card>
    );
};


export function RightSidebar({ isCollapsed, onToggle, pins, setPins }: RightSidebarProps) {
  const [activeTab, setActiveTab] = useState("Pins");

  const handleUpdatePin = (updatedPin: Pin) => {
    setPins(prevPins => prevPins.map(p => p.id === updatedPin.id ? updatedPin : p));
  };


  return (
    <aside className={cn(
        "border-l bg-card hidden lg:flex flex-col transition-all duration-300 ease-in-out relative",
        isCollapsed ? "w-[58px]" : "w-[258px]"
        )}>
        
        <Button variant="ghost" size="icon" onClick={onToggle} className="absolute top-1/2 -translate-y-1/2 -left-4 bg-card border hover:bg-accent z-10 h-8 w-8 rounded-full">
            <ChevronsLeft className={cn("h-4 w-4 transition-transform", isCollapsed ? "rotate-180" : "rotate-0")}/>
        </Button>
        
        {isCollapsed ? (
            <div className="flex flex-col items-center py-4 space-y-4">
                <Pin className="h-6 w-6" />
            </div>
        ) : (
            <div className="flex flex-col h-full">
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
                        <Button variant={activeTab === 'Pins' ? 'default' : 'outline'} className="w-full rounded-[25px]" onClick={() => setActiveTab('Pins')}>
                            <Pin className="mr-2 h-4 w-4" />
                            Pins
                        </Button>
                        <Button variant={activeTab === 'Files' ? 'default' : 'outline'} className="w-full rounded-[25px]" onClick={() => setActiveTab('Files')}>
                            <Files className="mr-2 h-4 w-4" />
                            Files
                        </Button>
                    </div>
                    <div className="mt-4">
                        <Button variant="outline" className="w-full justify-between rounded-[25px]">
                            <span>Filter by Chats</span>
                            <ChevronDown className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                <ScrollArea className="flex-1 min-h-0">
                    <div className="p-4 space-y-3">
                    {pins.length > 0 ? pins.map((pin) => (
                        <PinItem key={pin.id} pin={pin} onUpdatePin={handleUpdatePin} />
                    )) : (
                        <div className="text-center text-sm text-muted-foreground py-10">
                            No pins yet.
                        </div>
                    )}
                    </div>
                </ScrollArea>
                <div className="p-4 border-t shrink-0">
                    <Button className="w-full rounded-[25px]">
                        Export Pins
                    </Button>
                </div>
            </div>
        )}
    </aside>
  );
}
