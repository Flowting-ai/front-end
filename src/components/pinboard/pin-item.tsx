
"use client";

import { useState, KeyboardEvent, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pin, X } from "lucide-react";
import { Badge } from "../ui/badge";
import { Textarea } from "../ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from 'date-fns';
import type { PinType } from "../layout/right-sidebar";

interface PinItemProps {
    pin: PinType;
    onUpdatePin: (updatedPin: PinType) => void;
    onRemoveTag: (pinId: string, tagIndex: number) => void;
    chatName?: string;
}

const formatTimestamp = (time: Date) => {
    const pinTime = new Date(time);
    const diffInSeconds = (Date.now() - pinTime.getTime()) / 1000;
    if (diffInSeconds < 60) {
        return "just now";
    }
    return formatDistanceToNow(pinTime, { addSuffix: true });
}

export const PinItem = ({ pin, onUpdatePin, onRemoveTag, chatName }: PinItemProps) => {
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
                        <Badge key={tagIndex} variant="secondary" className="font-normal text-foreground text-[10px] py-0.5 rounded-md">
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
                    <span className="text-xs text-muted-foreground">{formatTimestamp(pin.time)}</span>
                </div>
            </CardContent>
        </Card>
    );
};
