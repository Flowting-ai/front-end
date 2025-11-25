
"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pin, X, MoreVertical, Trash2, Edit, MessageSquareText, Tag, ArrowUp } from "lucide-react";
import { Badge } from "../ui/badge";
import { Textarea } from "../ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from 'date-fns';
import type { PinType } from "../layout/right-sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useRouter } from "next/navigation";

interface PinItemProps {
    pin: PinType;
    onUpdatePin: (updatedPin: PinType) => void;
    onRemoveTag: (pinId: string, tagIndex: number) => void;
    onDeletePin?: (pinId: string) => void;
    chatName?: string;
    onInsertToChat?: (text: string) => void;
    compact?: boolean;
}

const formatTimestamp = (time: Date) => {
    const pinTime = new Date(time);
    const diffInSeconds = (Date.now() - pinTime.getTime()) / 1000;
    if (diffInSeconds < 60) {
        return "just now";
    }
    return formatDistanceToNow(pinTime, { addSuffix: true });
}

export const PinItem = ({ pin, onUpdatePin, onRemoveTag, onDeletePin, chatName, onInsertToChat, compact = false }: PinItemProps) => {
    const router = useRouter();
    const [isExpanded, setIsExpanded] = useState(false);
    const [tagInput, setTagInput] = useState('');
    const [tags, setTags] = useState<string[]>(pin.tags);
    const [noteInput, setNoteInput] = useState(pin.notes);
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [titleInput, setTitleInput] = useState(pin.text);
    const [showComments, setShowComments] = useState(false);
    const [commentInput, setCommentInput] = useState('');
    const [hoveredTagIndex, setHoveredTagIndex] = useState<number | null>(null);
    const [comments, setComments] = useState<string[]>(pin.comments || []);
    const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
    const titleTextareaRef = useRef<HTMLTextAreaElement>(null);
    const { toast } = useToast();
    
    const MAX_TAG_LINES = 2;
    const ESTIMATED_TAGS_PER_LINE = 4;

    useEffect(() => {
        if (isEditingNotes && notesTextareaRef.current) {
            notesTextareaRef.current.focus();
        }
    }, [isEditingNotes]);

    useEffect(() => {
        if (isEditingTitle && titleTextareaRef.current) {
            titleTextareaRef.current.focus();
        }
    }, [isEditingTitle]);

    useEffect(() => {
        setTags(pin.tags);
    }, [pin.tags]);

    const handleTagKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' && tagInput.trim()) {
          event.preventDefault();
          
          // Check if adding would exceed 2 lines (approximate)
          if (tags.length >= MAX_TAG_LINES * ESTIMATED_TAGS_PER_LINE) {
            toast({ 
              title: "Cannot add more tags", 
              description: "Maximum tag limit reached (2 lines)",
              variant: "destructive"
            });
            return;
          }
          
          const newTags = [...tags, tagInput.trim()];
          setTags(newTags);
          const updatedPin = { ...pin, tags: newTags };
          onUpdatePin(updatedPin);
          setTagInput('');
          toast({ title: "Tag added!" });
        }
    };

    const handleRemoveTag = (tagIndex: number) => {
        const newTags = tags.filter((_, index) => index !== tagIndex);
        setTags(newTags);
        onRemoveTag(pin.id, tagIndex);
    };
    
    const handleSaveNote = () => {
        onUpdatePin({ ...pin, notes: noteInput });
        setIsEditingNotes(false);
        toast({ title: "Note saved!" });
    };

    const handleSaveTitle = () => {
        if (titleInput.trim()) {
            const updatedPin = { ...pin, text: titleInput.trim() };
            onUpdatePin(updatedPin);
            setIsEditingTitle(false);
            toast({ title: "Title updated!" });
        } else {
            // If empty, cancel edit and restore original
            setTitleInput(pin.text);
            setIsEditingTitle(false);
        }
    };

    const handleTitleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSaveTitle();
        }
        if (event.key === 'Escape') {
            setIsEditingTitle(false);
            setTitleInput(pin.text);
        }
    };

    const handleDeletePin = () => {
        if (onDeletePin) {
            onDeletePin(pin.id);
            toast({ title: "Pin deleted" });
        }
    };

    const handleAddComment = () => {
        if (commentInput.trim()) {
            const updatedComments = [...comments, commentInput.trim()];
            setComments(updatedComments);
            onUpdatePin({ ...pin, comments: updatedComments });
            toast({ title: "Comment added!" });
            setCommentInput('');
            setShowComments(false);
        }
    };

    const handleGoToChat = () => {
        // Navigate to the chat and scroll to the specific message
        router.push(`/?chatId=${pin.chatId}&messageId=${pin.messageId || ''}`);
        toast({ title: "Navigating to chat..." });
    };

    const handleInsertToChat = () => {
        if (onInsertToChat) {
            onInsertToChat(pin.text);
            toast({ title: "Pin inserted to chat" });
        }
    };

    return (
            <Card className="border border-[#e6e6e6] bg-white" style={{ width: '235px', minHeight: compact ? 'auto' : '180.72px', borderRadius: '8px' }}>
            <CardContent className="flex flex-col p-3" style={{ gap: '8px' }}>
                {/* Title with dropdown menu */}
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        {isEditingTitle ? (
                            <div className="space-y-2">
                                <Textarea 
                                    ref={titleTextareaRef}
                                    className="min-h-[60px] resize-none rounded-md border border-[#dcdcdc] bg-white p-2 text-[#1e1e1e] scrollbar-transparent"
                                    value={titleInput}
                                    onChange={(e) => setTitleInput(e.target.value)}
                                    onKeyDown={handleTitleKeyDown}
                                    rows={2}
                                    style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: '16px', lineHeight: '140%' }}
                                />
                                <div className="flex gap-2">
                                    <Button 
                                        onClick={handleSaveTitle} 
                                        size="sm" 
                                        className="h-6 px-3 text-xs bg-[#1e1e1e] text-white hover:bg-[#2c2c2c]"
                                    >
                                        Save
                                    </Button>
                                    <Button 
                                        onClick={() => {
                                            setIsEditingTitle(false);
                                            setTitleInput(pin.text);
                                        }} 
                                        size="sm" 
                                        variant="ghost"
                                        className="h-6 px-3 text-xs hover:bg-[#f5f5f5]"
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-[#1e1e1e]" style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: '16px', lineHeight: '140%' }}>
                                {isExpanded || pin.text.length <= 50 ? pin.text : `${pin.text.substring(0, 50)}...`}
                                {pin.text.length > 50 && (
                                    <Button variant="link" className="h-auto p-0 ml-1 text-xs text-[#3b82f6] hover:text-[#2563eb]" onClick={() => setIsExpanded(!isExpanded)}>
                                        {isExpanded ? "Read less" : "Read more"}
                                    </Button>
                                )}
                            </p>
                        )}
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button 
                                variant="ghost" 
                                size="icon"
                                className="h-6 w-6 rounded-md hover:bg-[#f5f5f5] flex-shrink-0"
                            >
                                <MoreVertical className="h-4 w-4 text-[#666666]" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-white border border-[#E5E5E5]" style={{ width: '99px', borderRadius: '8px' }}>
                            <DropdownMenuItem onClick={() => setIsEditingTitle(true)} className="text-[#1e1e1e]">
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleDeletePin} className="text-red-600">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Tags section */}
                <div className="flex flex-wrap items-center gap-2" style={{ maxHeight: '44px', overflow: 'hidden', alignContent: 'flex-start' }}>
                    {tags.length < MAX_TAG_LINES * ESTIMATED_TAGS_PER_LINE && (
                        <div className="relative flex items-center">
                            <Tag className="absolute text-[#1e1e1e] pointer-events-none" style={{ left: '6px', height: '7.25px', width: '7.25px' }} />
                            <input
                                type="text"
                                placeholder="Add Tag"
                                className="border border-[#d4d4d4] bg-transparent text-[#1e1e1e] placeholder:text-[#9F9F9F] focus:outline-none focus:ring-0"
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={handleTagKeyDown}
                                style={{ 
                                    width: '60.37px', 
                                    height: '17.86px', 
                                    minHeight: '17.86px', 
                                    borderRadius: '7680.2px',
                                    paddingTop: '2.23px',
                                    paddingBottom: '2.23px',
                                    paddingLeft: '16px',
                                    paddingRight: '8px',
                                    fontSize: '9px',
                                    gap: '4.46px'
                                }}
                            />
                        </div>
                    )}
                    {tags.map((tag, tagIndex) => {
                        // Generate color based on first 2 letters of tag
                        const getTagColor = (tagText: string) => {
                            const colors = ['#E55959', '#9A6FF1', '#756AF2'];
                            const firstTwo = tagText.substring(0, 2).toLowerCase();
                            const charSum = firstTwo.charCodeAt(0) + (firstTwo.charCodeAt(1) || 0);
                            return colors[charSum % colors.length];
                        };
                        
                        return (
                            <div
                                key={tagIndex}
                                className="group relative"
                                onMouseEnter={() => setHoveredTagIndex(tagIndex)}
                                onMouseLeave={() => setHoveredTagIndex(null)}
                            >
                                <Badge
                                    variant="secondary"
                                    className="rounded-md px-2 text-[10px] font-normal text-white border-0"
                                    style={{ backgroundColor: getTagColor(tag), height: '17.85px', display: 'flex', alignItems: 'center' }}
                                >
                                    {tag}
                                </Badge>
                                {hoveredTagIndex === tagIndex && (
                                    <button 
                                        onClick={() => handleRemoveTag(tagIndex)} 
                                        className="absolute top-0.5 right-0.5 rounded-full bg-white border border-[#E5E5E5] p-0.5 hover:bg-[#F5F5F5] shadow-sm transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        <X className="h-2.5 w-2.5 text-[#666666]" />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Chat name and time */}
                <div className="flex justify-between items-center">
                    <span className="text-[#1e1e1e]" style={{ fontFamily: 'Inter', fontWeight: 400, fontSize: '10px', lineHeight: '130%', letterSpacing: '0.015em' }}>
                        {chatName || 'Untitled Chat'}
                    </span>
                    <span className="text-xs text-[#7a7a7a]">{formatTimestamp(pin.time)}</span>
                </div>

                {/* Action buttons row */}
                <div className="flex justify-between items-center">
                    <button
                        onClick={() => setShowComments(!showComments)}
                        className="flex items-center justify-center border border-[#D4D4D4] hover:bg-[#f5f5f5] transition-colors"
                        style={comments.length > 0 ? { width: '48.5px', height: '24px', minHeight: '24px', borderRadius: '9999px', paddingTop: '3px', paddingBottom: '3px', paddingLeft: '8px', paddingRight: '8px', gap: '6px' } : { width: '24px', height: '24px', minHeight: '24px', borderRadius: '9999px', padding: '4px' }}
                    >
                        <MessageSquareText className="text-[#666666] flex-shrink-0" style={{ width: '16px', height: '16px', minWidth: '16px', minHeight: '16px' }} />
                        {comments.length > 0 && (
                            <span className="flex items-center justify-center bg-[#2C2C2C] text-white font-medium flex-shrink-0" style={{ width: '14.17px', height: '14.17px', minHeight: '14.17px', borderRadius: '6927.73px', paddingTop: '1.77px', paddingBottom: '1.77px', paddingLeft: '4.72px', paddingRight: '4.72px', fontSize: '8px' }}>
                                {comments.length}
                            </span>
                        )}
                    </button>
                    <TooltipProvider delayDuration={300}>
                        <div className="flex items-center gap-2">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button 
                                        variant="outline"
                                        size="sm"
                                        onClick={handleGoToChat}
                                        className="bg-[#F5F5F5] border border-[#D4D4D4] text-[#1e1e1e] hover:bg-[#E5E5E5] hover:text-[#1e1e1e] font-bold"
                                        style={{ width: '76px', height: '24px', minHeight: '24px', borderRadius: '4px', paddingTop: '3px', paddingBottom: '3px', paddingLeft: '8px', paddingRight: '8px', fontFamily: 'Geist', fontWeight: 500, fontSize: '12px', lineHeight: '150%', letterSpacing: '1.5%', textAlign: 'center' }}
                                    >
                                        Go to chat
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="text-xs">
                                    Navigate to chat
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button 
                                        size="sm"
                                        onClick={handleInsertToChat}
                                        className="bg-[#1e1e1e] border-0 text-white hover:bg-[#333333] hover:text-white font-bold"
                                        style={{ width: '50px', height: '24px', minHeight: '24px', borderRadius: '4px', paddingTop: '3px', paddingBottom: '3px', paddingLeft: '8px', paddingRight: '8px', fontFamily: 'Geist', fontWeight: 500, fontSize: '12px', lineHeight: '150%', letterSpacing: '1.5%', textAlign: 'center' }}
                                    >
                                        Insert
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="text-xs">
                                    Insert pin to current chat
                                </TooltipContent>
                            </Tooltip>
                        </div>
                    </TooltipProvider>
                </div>

                {/* Comment section */}
                {showComments && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                        {/* Display existing comments */}
                        {comments.length > 0 && (
                            <div className="space-y-2 max-h-[120px] overflow-y-auto">
                                {comments.map((comment, index) => (
                                    <div 
                                        key={index}
                                        className="group relative rounded-lg bg-[#F9F9F9] p-2 text-xs text-[#1e1e1e]"
                                    >
                                        {comment}
                                        <button
                                            onClick={() => {
                                                const updatedComments = comments.filter((_, i) => i !== index);
                                                setComments(updatedComments);
                                                onUpdatePin({ ...pin, comments: updatedComments });
                                                toast({ title: "Comment deleted" });
                                            }}
                                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity rounded hover:bg-[#E5E5E5] p-1"
                                        >
                                            <Trash2 className="h-3 w-3 text-[#666666]" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {/* Comment input area */}
                        <div className="relative flex items-center" style={{ width: '211px' }}>
                            <Input 
                                placeholder="Add your comment..." 
                                className="w-full rounded-[8px] border border-[#dcdcdc] bg-white pr-9 text-xs text-[#1e1e1e]"
                                style={{ height: '36px', minHeight: '36px', paddingTop: '7.5px', paddingBottom: '7.5px', paddingLeft: '12px', paddingRight: '6px' }}
                                value={commentInput}
                                onChange={(e) => setCommentInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && commentInput.trim()) {
                                        handleAddComment();
                                    }
                                    if (e.key === 'Escape') {
                                        setShowComments(false);
                                        setCommentInput('');
                                    }
                                }}
                            />
                            <button
                                onClick={handleAddComment}
                                disabled={!commentInput.trim()}
                                className="absolute right-2 flex h-6 w-6 items-center justify-center rounded-full border border-[#1e1e1e] hover:bg-[#f5f5f5] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <ArrowUp className="h-3.5 w-3.5 text-[#1e1e1e]" />
                            </button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
