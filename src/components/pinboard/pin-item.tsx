
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
        <Card className="rounded-2xl border border-[#e6e6e6] bg-white">
            <CardContent className="space-y-3 p-4">
                <p className="text-xs text-[#1e1e1e]">
                    {isExpanded || pin.text.length <= 100 ? pin.text : `${pin.text.substring(0, 100)}...`}
                    {pin.text.length > 100 && (
                        <Button variant="link" className="h-auto p-0 ml-1 text-xs" onClick={() => setIsExpanded(!isExpanded)}>
                            {isExpanded ? "Read less" : "Read more"}
                        </Button>
                    )}
                </p>

                <div className="flex flex-wrap items-center gap-2">
                    {pin.tags.map((tag, tagIndex) => (
                        <Badge
                            key={tagIndex}
                            variant="secondary"
                            className="rounded-md bg-[#f2f2f2] px-2 py-0.5 text-[10px] font-normal text-[#1e1e1e]"
                        >
                            {tag}
                            <button onClick={() => onRemoveTag(pin.id, tagIndex)} className="ml-1.5 focus:outline-none">
                                <X className="h-3 w-3 text-[#6b6b6b]" />
                            </button>
                        </Badge>
                    ))}
                    <Input
                        placeholder="+ Add tags"
                        className="min-w-[60px] flex-1 h-6 rounded-md border border-dashed border-[#d4d4d4] bg-transparent text-xs"
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
                                className="mt-1 min-h-[24px] resize-none rounded-md border border-[#dcdcdc] bg-[#f9f9f9] p-2 text-xs text-[#1e1e1e]"
                                value={noteInput}
                                onChange={(e) => setNoteInput(e.target.value)}
                                onKeyDown={handleNoteKeyDown}
                                onBlur={handleSaveNote}
                                style={{ fontSize: '10px' }}
                                rows={1}
                            />
                        </div>
                    ) : (
                        <div className="mt-1 min-h-[24px] cursor-text rounded-md border border-transparent bg-[#f9f9f9] p-2 text-xs text-[#1e1e1e] hover:border-dashed hover:border-[#d4d4d4]">
                            {pin.notes || <span className="text-[#8a8a8a]">Add private notes...</span>}
                        </div>
                    )}
                </div>

                <div className="flex justify-between items-center pt-1">
                    <Badge variant="outline" className="rounded-md border-dashed border-[#d4d4d4] bg-transparent text-[10px] font-normal text-[#1e1e1e]">
                        {chatName || `Chat ${pin.chatId}`}
                    </Badge>
                    <span className="text-xs text-[#7a7a7a]">{formatTimestamp(pin.time)}</span>
                </div>
            </CardContent>
        </Card>
    );
};
