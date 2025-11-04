
"use client";

import { useState, KeyboardEvent, type Dispatch, type SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Pin, Search, X, Files, ChevronDown } from "lucide-react";
import { Badge } from "../ui/badge";
import { Textarea } from "../ui/textarea";
import { cn } from "@/lib/utils";

export interface Pin {
  id: string;
  text: string;
  tags: string[];
  notes: string;
  chat: string;
  time: string;
}

const initialPins: Pin[] = [
  {
    id: "pin-1",
    text: "The Q4 analysis shows a 25% increase user engagement, which is a significant metric for our growth strategy. We should focus on this for the next quarter.",
    tags: ["Finance Research"],
    notes: "This is a private note for the Q4 analysis pin.",
    chat: "Product Analysis Q4",
    time: "2m",
  },
  {
    id: "pin-2",
    text: "Competitive landscape is shifting towards AI-driven features. We need to accelerate our roadmap to stay ahead of the curve and capture market share.",
    tags: ["Market Research"],
    notes: "",
    chat: "Competitive Landscape",
    time: "1 Day",
  },
  {
    id: "pin-3",
    text: "User feedback indicates a strong desire for a mobile app. This has been a recurring theme in our latest surveys and interviews.",
    tags: ["User Feedback"],
    notes: "",
    chat: "User Feedback Synthesis",
    time: "1month",
  },
  {
    id: "pin-4",
    text: "The Q1 analysis shows a 15% decrease in churn. This is great news and a testament to the recent product improvements.",
    tags: ["User Retention"],
    notes: "",
    chat: "Product Analysis Q1",
    time: "2m",
  },
    {
    id: "pin-5",
    text: "New marketing slogan brainstorm: 'AI that flows with you.' It's catchy, modern, and speaks to our core value proposition.",
    tags: ["Marketing"],
    notes: "",
    chat: "Marketing Campaign Ideas",
    time: "3d",
  },
];


interface RightSidebarProps {
    isCollapsed: boolean;
    pins: Pin[];
    setPins: Dispatch<SetStateAction<Pin[]>>;
}

const PinItem = ({ pin, index, onUpdatePin }: { pin: Pin, index: number, onUpdatePin: (index: number, updatedPin: Pin) => void }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [tagInput, setTagInput] = useState('');
    const [noteInput, setNoteInput] = useState(pin.notes);

    const handleTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' && tagInput.trim()) {
          event.preventDefault();
          const updatedPin = { ...pin, tags: [...pin.tags, tagInput.trim()] };
          onUpdatePin(index, updatedPin);
          setTagInput('');
        }
    };

    const removeTag = (tagIndex: number) => {
        const updatedTags = pin.tags.filter((_, i) => i !== tagIndex);
        onUpdatePin(index, { ...pin, tags: updatedTags });
    };

    const handleNoteKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            onUpdatePin(index, { ...pin, notes: noteInput });
            (event.target as HTMLTextAreaElement).blur();
        }
    }

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
                        onBlur={() => onUpdatePin(index, { ...pin, notes: noteInput })}
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


export function RightSidebar({ isCollapsed, pins: propPins, setPins }: RightSidebarProps) {
  const [localPins, setLocalPins] = useState(initialPins);
  const [activeTab, setActiveTab] = useState("Pins");
  
  // Combine props and local state for display
  const allPins = [...propPins, ...localPins];

  const handleUpdatePin = (index: number, updatedPin: Pin) => {
    // This function needs to decide whether to update the prop (via setPins)
    // or the local state. For simplicity, we'll assume for now that only
    // pins that originated from props can be updated in the parent.
    const pinToUpdate = allPins[index];
    if (propPins.some(p => p.id === pinToUpdate.id)) {
        const propIndex = propPins.findIndex(p => p.id === pinToUpdate.id);
        const newPropPins = [...propPins];
        newPropPins[propIndex] = updatedPin;
        setPins(newPropPins);
    } else {
        const localIndex = localPins.findIndex(p => p.id === pinToUpdate.id);
        const newLocalPins = [...localPins];
        newLocalPins[localIndex] = updatedPin;
        setLocalPins(newLocalPins);
    }
  };


  return (
    <aside className={cn(
        "border-l bg-card hidden lg:flex flex-col transition-all duration-300 ease-in-out",
        isCollapsed ? "w-[58px]" : "w-[258px]"
        )}>
        
        {isCollapsed ? (
            <div className="flex flex-col items-center py-4">
                <Pin className="h-6 w-6" />
            </div>
        ) : (
            <>
                <div className="p-4 border-b">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-semibold" style={{ fontSize: '16px' }}>Pinboard</h2>
                        <Pin className="h-5 w-5" />
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
                <ScrollArea className="flex-1">
                    <div className="p-4 space-y-3">
                    {allPins.map((pin, index) => (
                        <PinItem key={pin.id} pin={pin} index={index} onUpdatePin={handleUpdatePin} />
                    ))}
                    </div>
                </ScrollArea>
                <div className="p-4 border-t mt-auto">
                    <Button className="w-full rounded-[25px]">
                        Export Pins
                    </Button>
                </div>
            </>
        )}
    </aside>
  );
}
