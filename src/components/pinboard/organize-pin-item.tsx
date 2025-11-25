
"use client"
import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import type { PinType } from "../layout/right-sidebar";
import { formatTimestamp } from '@/lib/utils';
import { allTags as initialTags } from '@/lib/config';

interface OrganizePinItemProps {
    pin: PinType;
    chatName?: string;
    onUpdate: (pin: PinType) => void;
    isSelected: boolean;
    onSelectionChange: (selected: boolean) => void;
}

export const OrganizePinItem = ({ pin, chatName, onUpdate, isSelected, onSelectionChange }: OrganizePinItemProps) => {
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [notes, setNotes] = useState(pin.notes || "");
    const [tags, setTags] = useState(pin.tags || []);
    const [allTags, setAllTags] = useState(initialTags);
    const [newTag, setNewTag] = useState('');

    const notesTextareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isEditingNotes && notesTextareaRef.current) {
            notesTextareaRef.current.focus();
            notesTextareaRef.current.style.height = `${notesTextareaRef.current.scrollHeight}px`;
        }
    }, [isEditingNotes]);


    const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setNotes(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
    };

    const handleNotesBlur = () => {
        setIsEditingNotes(false);
        if (notes !== pin.notes) {
            onUpdate({ ...pin, notes });
        }
    };

    const handleAddTag = (tag: string) => {
        if (tag && !tags.includes(tag)) {
            const newTags = [...tags, tag];
            setTags(newTags);
            onUpdate({ ...pin, tags: newTags });
        }
        if (tag && !allTags.includes(tag)) {
            setAllTags([...allTags, tag]);
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        const newTags = tags.filter(tag => tag !== tagToRemove);
        setTags(newTags);
        onUpdate({ ...pin, tags: newTags });
    };

    return (
        <Card className="mb-4 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 bg-white dark:bg-card">
            <CardContent className="p-3">
                <div className="flex items-start">
                    <Checkbox
                        checked={isSelected}
                        onCheckedChange={onSelectionChange}
                        className="mr-3 mt-1 rounded-lg"
                    />
                    <div className="flex-1">
                        <p className="text-sm text-foreground/90 pr-2 break-words">{pin.text}</p>
                        <div className="mt-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-muted-foreground hover:bg-muted/50 rounded-md">
                                            <Plus className="h-3 w-3 mr-1" /> Add tags
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-48 p-0">
                                        <Command>
                                            <CommandInput
                                                placeholder="Add or create tag..."
                                                value={newTag}
                                                onValueChange={setNewTag}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && newTag.trim()) {
                                                        e.preventDefault();
                                                        handleAddTag(newTag.trim());
                                                        setNewTag('');
                                                    }
                                                }}
                                            />
                                            <CommandEmpty>
                                                {newTag.trim() ? `Press Enter to create "${newTag.trim()}"` : "No tags found."}
                                            </CommandEmpty>
                                            <CommandGroup>
                                                {allTags.filter(t => !tags.includes(t)).map((tag) => (
                                                    <CommandItem key={tag} onSelect={() => handleAddTag(tag)}>
                                                        {tag}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                                {tags.map(tag => (
                                    <Badge key={tag} variant="secondary" className="rounded-md font-normal text-xs pl-2 pr-1">
                                        {tag}
                                        <button onClick={() => handleRemoveTag(tag)} className="ml-1 rounded-full hover:bg-background/50 p-0.5">
                                            <X className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                ))}
                            </div>

                            <div onClick={() => setIsEditingNotes(true)} className="mt-1">
                                {isEditingNotes ? (
                                    <Textarea
                                        ref={notesTextareaRef}
                                        value={notes}
                                        onChange={handleNotesChange}
                                        onBlur={handleNotesBlur}
                                        placeholder="Add private notes..."
                                        className="text-xs bg-card mt-1 p-1 rounded-md min-h-[24px] resize-none overflow-hidden border border-dashed border-input"
                                    />
                                ) : (
                                    <div className="text-xs bg-card mt-1 p-1 rounded-md min-h-[24px] cursor-text border border-transparent hover:border-dashed hover:border-input">
                                        {pin.notes || <span className="text-muted-foreground">Add private notes...</span>}
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-between items-center pt-1 mt-1">
                                <Badge variant="outline" className="font-normal border-dashed text-[10px] rounded-md">{chatName || `Chat ${pin.chatId}`}</Badge>
                                <span className="text-xs text-muted-foreground">{formatTimestamp(pin.time)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
