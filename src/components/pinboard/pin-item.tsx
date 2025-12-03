
"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pin, X, MoreVertical, Trash2, Edit, MessageSquareText, Tag, ArrowUp, Info, Copy, FolderInput, Search, ChevronRight, FolderPlus } from "lucide-react";
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
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PinFolder } from "@/lib/api/pins";
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
    onInsertToChat?: (text: string, pin: PinType) => void;
    onGoToChat?: (pin: PinType) => void;
    compact?: boolean;
    folders?: PinFolder[];
    onDuplicatePin?: (pin: PinType) => void;
    onMovePin?: (pinId: string, folderId: string | null) => void;
    onCreateFolder?: (name: string) => Promise<PinFolder>;
}

const formatTimestamp = (time: Date) => {
    const pinTime = new Date(time);
    const diffInSeconds = (Date.now() - pinTime.getTime()) / 1000;
    if (diffInSeconds < 60) {
        return "just now";
    }
    return formatDistanceToNow(pinTime, { addSuffix: true });
}

export const PinItem = ({
    pin,
    onUpdatePin,
    onRemoveTag,
    onDeletePin,
    chatName,
    onInsertToChat,
    onGoToChat,
    compact = false,
    folders = [],
    onDuplicatePin,
    onMovePin,
    onCreateFolder,
}: PinItemProps) => {
    const router = useRouter();
    const [showInfo, setShowInfo] = useState(false);
    const [isTitleExpanded, setIsTitleExpanded] = useState(false);
    const TRUNCATE_TITLE_LEN = 50;
    const [tagInput, setTagInput] = useState('');
    const [tags, setTags] = useState<string[]>(pin.tags);
    const [noteInput, setNoteInput] = useState(pin.notes);
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [titleInput, setTitleInput] = useState(pin.title ?? pin.text);
    const [showComments, setShowComments] = useState(false);
    const [commentInput, setCommentInput] = useState('');
    const [hoveredTagIndex, setHoveredTagIndex] = useState<number | null>(null);
    const [comments, setComments] = useState<string[]>(pin.comments || []);
    const [editingCommentIndex, setEditingCommentIndex] = useState<number | null>(null);
    const [editCommentInput, setEditCommentInput] = useState('');
    const [moveFolderSearch, setMoveFolderSearch] = useState('');
    const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
    const titleTextareaRef = useRef<HTMLTextAreaElement>(null);
    const { toast } = useToast();
    
    const MAX_TAG_LINES = 2;
    const ESTIMATED_TAGS_PER_LINE = 4;

    const filteredFolders = useMemo(() => {
        if (!moveFolderSearch.trim()) return folders;
        return folders.filter(folder => 
            folder.name.toLowerCase().includes(moveFolderSearch.toLowerCase())
        );
    }, [folders, moveFolderSearch]);

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

    useEffect(() => {
        setComments(pin.comments || []);
    }, [pin.comments]);

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
          
          // Add new tag at the beginning (most recent first)
          const newTags = [tagInput.trim(), ...tags];
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
            const updatedPin = { ...pin, title: titleInput.trim(), text: titleInput.trim() };
            onUpdatePin(updatedPin);
            setIsEditingTitle(false);
            toast({ title: "Title updated!" });
        } else {
            // If empty, cancel edit and restore original
            setTitleInput(pin.title ?? pin.text);
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
            setTitleInput(pin.title ?? pin.text);
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

    const handleEditComment = (index: number) => {
        setEditingCommentIndex(index);
        setEditCommentInput(comments[index]);
    };

    const handleSaveEditedComment = () => {
        if (editCommentInput.trim() && editingCommentIndex !== null) {
            const updatedComments = [...comments];
            updatedComments[editingCommentIndex] = editCommentInput.trim();
            setComments(updatedComments);
            onUpdatePin({ ...pin, comments: updatedComments });
            toast({ title: "Comment updated!" });
            setEditingCommentIndex(null);
            setEditCommentInput('');
        }
    };

    const handleCancelEditComment = () => {
        setEditingCommentIndex(null);
        setEditCommentInput('');
    };

    const handleDuplicatePin = () => {
        if (onDuplicatePin) {
            onDuplicatePin(pin);
            toast({ title: "Pin duplicated!" });
        }
    };

    const handleMoveToFolder = (folderId: string | null, folderName: string) => {
        if (onMovePin) {
            onMovePin(pin.id, folderId);
            toast({ title: `Moved to ${folderName}` });
            setMoveFolderSearch('');
        }
    };

    const handleCreateAndMove = async () => {
        if (!moveFolderSearch.trim() || !onCreateFolder || !onMovePin) return;
        
        try {
            const newFolder = await onCreateFolder(moveFolderSearch.trim());
            onMovePin(pin.id, newFolder.id);
            toast({ title: `Created folder and moved to ${newFolder.name}` });
            setMoveFolderSearch('');
        } catch (error) {
            console.error('Failed to create folder', error);
            toast({ title: 'Failed to create folder', variant: 'destructive' });
        }
    };

    const handleGoToChat = () => {
        // Allow parent to own navigation; otherwise fallback to URL redirect.
        if (onGoToChat) {
            onGoToChat(pin);
            return;
        }
        // Simple redirect to chat; preserve messageId when available.
        const searchParams = new URLSearchParams();
        if (pin.chatId) searchParams.set("chatId", String(pin.chatId));
        if (pin.messageId) searchParams.set("messageId", String(pin.messageId));
        const suffix = searchParams.toString();
        const target = suffix ? `/?${suffix}` : "/";
        router.push(target);
    };

    const cleanContent = (raw: string) => {
        if (!raw) return "";
        let content = raw;
        // Remove one or more leading "Pinned response (model: ...):" prefixes
        content = content.replace(/^(Pinned response\s*\(model:[^)]+\):\s*)+/i, "");
        content = content
            .replace(/\*\*/g, "")
            .replace(/`/g, "")
            .replace(/#+\s*/g, "")
            .replace(/\|/g, " ")
            .replace(/[\u2022-\u2023]/g, "-");
        return content.replace(/\s+/g, " ").trim();
    };

    const bodyContent = cleanContent(pin.formattedContent ?? pin.text);
    // If the pin has a title that repeats at the start of the content, strip it for previews
    const previewContent = (pin.title && bodyContent.startsWith((pin.title))) ? bodyContent.substring((pin.title).length).trim() : bodyContent;
    const handleInsertToChat = () => {
        if (onInsertToChat) {
            onInsertToChat(bodyContent, pin);
        }
    };

        return (
            <Card className="border border-[#e6e6e6] bg-white" style={{ width: '100%', minHeight: compact ? 'auto' : '160px', borderRadius: '8px', marginRight: '6px' }}>
            <CardContent className="flex flex-col p-3" style={{ gap: '10px' }}>
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
                                            setTitleInput(pin.title ?? pin.text);
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
                            <div>
                                <div title={pin.title ?? pin.text}>
                                    <p
                                        className="text-[#1e1e1e]"
                                        style={isTitleExpanded ? { fontFamily: 'Inter', fontWeight: 500, fontSize: '16px', lineHeight: '140%' } : { fontFamily: 'Inter', fontWeight: 500, fontSize: '16px', lineHeight: '140%', display: '-webkit-box', WebkitLineClamp: 2 as any, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}
                                    >
                                        {pin.title ?? pin.text}
                                    </p>
                                </div>
                                {(pin.title && (pin.title.length > TRUNCATE_TITLE_LEN)) || (!pin.title && pin.text.length > TRUNCATE_TITLE_LEN) ? (
                                    <button className="text-xs text-[#3b82f6] mt-1 p-0" onClick={() => setIsTitleExpanded(prev => !prev)}>{isTitleExpanded ? 'show less' : 'read more...'}</button>
                                ) : null}
                            </div>
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
                        <DropdownMenuContent
                            align="end"
                            className="bg-white border border-[#E5E5E5] z-[70]"
                            style={{ width: '140px', borderRadius: '8px' }}
                        >
                            <DropdownMenuItem onClick={() => setIsEditingTitle(true)} className="text-[#1e1e1e] rounded-md px-3 py-2 hover:bg-[#f5f5f5]">
                                <Edit className="mr-2 h-4 w-4" />
                                Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleDuplicatePin} className="text-[#1e1e1e] rounded-md px-3 py-2 hover:bg-[#f5f5f5]">
                                <Copy className="mr-2 h-4 w-4" />
                                Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="rounded-md px-3 py-2 text-[#1e1e1e] hover:bg-[#f5f5f5] data-[state=open]:bg-[#f5f5f5]">
                                    <FolderInput className="mr-2 h-4 w-4" />
                                    Move
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="w-[240px] border border-[#e6e6e6] bg-white p-2 text-[#171717]">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a8a8a]" />
                                        <Input
                                            placeholder="Search folders..."
                                            className="mb-2 h-8 rounded-md pl-8 text-sm"
                                            value={moveFolderSearch}
                                            onChange={(event) => setMoveFolderSearch(event.target.value)}
                                            onClick={(event) => event.preventDefault()}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' && moveFolderSearch.trim() && filteredFolders.length === 0) {
                                                    event.preventDefault();
                                                    handleCreateAndMove();
                                                }
                                            }}
                                        />
                                    </div>
                                    <ScrollArea className="max-h-48">
                                        <div className="space-y-1" role="menu">
                                            <DropdownMenuItem
                                                className="rounded-md px-2 py-1.5 text-[#171717] hover:bg-[#f5f5f5] cursor-pointer"
                                                onSelect={() => handleMoveToFolder(null, 'Unorganized')}
                                            >
                                                Unorganized
                                            </DropdownMenuItem>
                                            {filteredFolders.length > 0 ? (
                                                filteredFolders.map((folder) => (
                                                    <DropdownMenuItem
                                                        key={folder.id}
                                                        className="rounded-md px-2 py-1.5 text-[#171717] hover:bg-[#f5f5f5] cursor-pointer"
                                                        onSelect={() => handleMoveToFolder(folder.id, folder.name)}
                                                    >
                                                        {folder.name}
                                                    </DropdownMenuItem>
                                                ))
                                            ) : moveFolderSearch.trim() ? (
                                                <DropdownMenuItem
                                                    className="rounded-md px-2 py-1.5 text-[#171717] hover:bg-[#f5f5f5] cursor-pointer"
                                                    onSelect={handleCreateAndMove}
                                                >
                                                    <FolderPlus className="mr-2 h-3.5 w-3.5" />
                                                    Create "{moveFolderSearch.trim()}"
                                                </DropdownMenuItem>
                                            ) : (
                                                <DropdownMenuItem disabled className="px-2 py-1.5 text-[#9a9a9a]">
                                                    No matching folders
                                                </DropdownMenuItem>
                                            )}
                                        </div>
                                    </ScrollArea>
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuItem onClick={handleDeletePin} className="text-red-600 rounded-md px-3 py-2 hover:bg-[#f5f5f5]">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                                {/* Inline preview removed to avoid duplicated title/content */}

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

                    {/* summary icon commented */}
                    {/* <button
                        onClick={() => setShowInfo(!showInfo)}
                        className="flex items-center justify-center border border-[#D4D4D4] hover:bg-[#f5f5f5] transition-colors"
                        style={{ width: '24px', height: '24px', minHeight: '24px', borderRadius: '9999px', padding: '4px' }}
                        title={showInfo ? 'Hide details' : 'Show details'}
                    >
                        <Info className="text-[#666666]" style={{ width: '16px', height: '16px' }} />
                    </button> */}
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
                            <div className="space-y-2 max-h-[120px] overflow-y-auto scrollbar-hidden">
                                {comments.map((comment, index) => (
                                    <div 
                                        key={index}
                                        className="group relative rounded-lg bg-[#F9F9F9] p-2 text-xs text-[#1e1e1e]"
                                    >
                                        {editingCommentIndex === index ? (
                                            <div className="space-y-2">
                                                <Input
                                                    value={editCommentInput}
                                                    onChange={(e) => setEditCommentInput(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && editCommentInput.trim()) {
                                                            handleSaveEditedComment();
                                                        }
                                                        if (e.key === 'Escape') {
                                                            handleCancelEditComment();
                                                        }
                                                    }}
                                                    className="w-full rounded-[6px] border border-[#dcdcdc] bg-white text-xs text-[#1e1e1e]"
                                                    style={{ height: '32px', paddingLeft: '8px', paddingRight: '8px' }}
                                                    autoFocus
                                                />
                                                <div className="flex gap-2 justify-end">
                                                    <button
                                                        onClick={handleSaveEditedComment}
                                                        disabled={!editCommentInput.trim()}
                                                        className="flex h-5 w-5 items-center justify-center rounded-full border border-[#1e1e1e] hover:bg-[#f5f5f5] disabled:opacity-40 disabled:cursor-not-allowed"
                                                    >
                                                        <ArrowUp className="h-3 w-3 text-[#1e1e1e]" />
                                                    </button>
                                                    <button
                                                        onClick={handleCancelEditComment}
                                                        className="text-[10px] text-[#666666] hover:text-[#1e1e1e] px-2"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                {comment}
                                                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleEditComment(index)}
                                                        className="rounded hover:bg-[#E5E5E5] p-1"
                                                    >
                                                        <Edit className="h-3 w-3 text-[#666666]" />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            const updatedComments = comments.filter((_, i) => i !== index);
                                                            setComments(updatedComments);
                                                            onUpdatePin({ ...pin, comments: updatedComments });
                                                            toast({ title: "Comment deleted" });
                                                        }}
                                                        className="rounded hover:bg-[#E5E5E5] p-1"
                                                    >
                                                        <Trash2 className="h-3 w-3 text-[#666666]" />
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {/* Comment input area */}
                        <div className="relative flex items-center" style={{ width: '100%' }}>
                            <Input 
                                placeholder="Add your comment..." 
                                className="w-full rounded-[8px] border border-[#dcdcdc] bg-white pr-12 text-xs text-[#1e1e1e]"
                                style={{ height: '36px', minHeight: '36px', paddingTop: '7.5px', paddingBottom: '7.5px', paddingLeft: '12px' }}
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
                                style={{ top: '50%', transform: 'translateY(-50%)' }}
                            >
                                <ArrowUp className="h-3.5 w-3.5 text-[#1e1e1e]" />
                            </button>
                        </div>
                    </div>
                )}

                {/* summary feature */}
                {/* Info panel: toggled by Info button */}
                {/* {showInfo && (
                    <div className="relative space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                        <button
                            onClick={() => setShowInfo(false)}
                            className="absolute top-1 right-1 rounded-md p-1 hover:bg-[#f0f0f0]"
                            aria-label="Close summary"
                        >
                            <X className="h-3.5 w-3.5 text-[#666666]" />
                        </button>
                        <div className="text-xs text-[#6b6b6b]">Summary</div>
                        <div className="rounded-lg bg-[#fafafa] p-2 text-sm text-[#1e1e1e]">
                            {previewContent.length > 200 ? `${previewContent.substring(0, 200)}...` : previewContent}
                        </div>
                    </div>
                )} */}
                {/* Removed inline expansion — 'read more' now opens the Info summary panel */}
            </CardContent>
        </Card>
    );
};
