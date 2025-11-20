
"use client";

import { useState, KeyboardEvent, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { Badge } from "../ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from 'date-fns';
import type { PinType } from "../layout/right-sidebar";
import { cn } from "@/lib/utils";

interface PinItemProps {
    pin: PinType;
    onUpdatePin: (updatedPin: PinType) => void;
    onRemoveTag: (pinId: string, tagIndex: number) => void;
    chatName?: string;
}

const formatTimestamp = (time: Date) => {
    if (!time || !(time instanceof Date) || isNaN(time.getTime())) {
        return 'Invalid date';
    }
    const diffInSeconds = (Date.now() - time.getTime()) / 1000;
    
    if (diffInSeconds < 60) {
        return "just now";
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
        return `${diffInMinutes}m`;
    }
    
    return formatDistanceToNow(time, { addSuffix: true });
}


export const PinItem = ({ pin, onUpdatePin, onRemoveTag, chatName }: PinItemProps) => {
    const [isNotesExpanded, setIsNotesExpanded] = useState(false);
    const [tagInput, setTagInput] = useState('');
    const [noteInput, setNoteInput] = useState(pin.notes);
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const notesInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    
    const isNoteLong = pin.notes.length > 100;

    useEffect(() => {
        if (isEditingNotes && notesInputRef.current) {
            notesInputRef.current.focus();
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
        if (pin.notes === noteInput) {
             setIsEditingNotes(false);
             return;
        }
        onUpdatePin({ ...pin, notes: noteInput });
        setIsEditingNotes(false);
        toast({ title: "Note saved!" });
    };

    const handleNoteKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleSaveNote();
        }
    }

    const truncatedTitle = pin.title.length > 50 ? `${pin.title.substring(0, 50)}...` : pin.title;

    return (
        <Card className="bg-background rounded-[10px] flex-grow flex flex-col border shadow-sm">
            <CardContent className="p-3 space-y-3 flex flex-col flex-1">
                 <div>
                    <p className="font-semibold text-sm leading-tight">{truncatedTitle}</p>
                 </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <Input 
                        placeholder="+ Add tags" 
                        className="text-xs h-7 flex-grow min-w-[80px] bg-card border-dashed rounded-md px-2"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleTagKeyDown}
                    />
                    {pin.tags.map((tag, tagIndex) => (
                        <Badge key={tagIndex} variant="secondary" className="font-normal text-white bg-gray-800 hover:bg-gray-700 rounded-md">
                            {tag}
                            <button onClick={() => onRemoveTag(pin.id, tagIndex)} className="ml-1.5 focus:outline-none">
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    ))}
                </div>
                
                <div onClick={() => !isEditingNotes && setIsEditingNotes(true)}>
                    {isEditingNotes ? (
                        <div className="relative">
                            <Input 
                                ref={notesInputRef}
                                placeholder="Add private notes..." 
                                className="text-sm bg-card mt-1 rounded-md p-2 h-auto" 
                                value={noteInput}
                                onChange={(e) => setNoteInput(e.target.value)}
                                onKeyDown={handleNoteKeyDown}
                                onBlur={handleSaveNote}
                            />
                        </div>
                    ) : (
                        <div className={cn(
                            "text-sm mt-1 p-2 rounded-md min-h-[36px] cursor-text border",
                             pin.notes ? "bg-card border-input" : "bg-transparent border-input"
                        )}>
                            {pin.notes ? (
                                <>
                                    {isNoteLong && !isNotesExpanded ? `${pin.notes.substring(0, 100)}...` : pin.notes}
                                    {isNoteLong && (
                                        <Button variant="link" className="h-auto p-0 ml-1 text-xs" onClick={() => setIsNotesExpanded(!isNotesExpanded)}>
                                            {isNotesExpanded ? "Read less" : "Read more"}
                                        </Button>
                                    )}
                                </>
                            ) : <span className="text-muted-foreground">Add private notes...</span>}
                        </div>
                    )}
                </div>

                <div className="flex justify-between items-center pt-2">
                    <Badge variant="outline" className="font-normal text-xs rounded-md">{chatName || `Chat ${pin.chatId}`}</Badge>
                    <span className="text-xs text-muted-foreground">{formatTimestamp(pin.time)}</span>
                </div>
            </CardContent>
        </Card>
    );
};
