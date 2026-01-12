"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  X,
  MoreVertical,
  Trash2,
  Edit,
  MessageSquareText,
  Tag,
  ArrowUp,
  Copy,
  FolderInput,
  Search,
  FolderPlus,
} from "lucide-react";
import { Badge } from "../ui/badge";
import { Textarea } from "../ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
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
  inOrganizeDialog?: boolean;
  isSelected?: boolean;
}

const formatTimestamp = (time: Date) => {
  const pinTime = new Date(time);
  const diffInSeconds = (Date.now() - pinTime.getTime()) / 1000;
  if (diffInSeconds < 60) {
    return "just now";
  }
  return formatDistanceToNow(pinTime, { addSuffix: true });
};

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
  inOrganizeDialog = false,
  isSelected = false,
}: PinItemProps) => {
  const router = useRouter();

  const [isTitleExpanded, setIsTitleExpanded] = useState(false);
  const TRUNCATE_TITLE_LEN = 50;
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(pin.tags);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(pin.title ?? pin.text);
  const [showComments, setShowComments] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [hoveredTagIndex, setHoveredTagIndex] = useState<number | null>(null);
  const [comments, setComments] = useState<string[]>(pin.comments || []);
  const [editingCommentIndex, setEditingCommentIndex] = useState<number | null>(
    null
  );
  const [editCommentInput, setEditCommentInput] = useState("");
  const [moveFolderSearch, setMoveFolderSearch] = useState("");
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);
  const createFolderInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const MAX_TAG_LINES = 2;
  const ESTIMATED_TAGS_PER_LINE = 4;

  const filteredFolders = useMemo(() => {
    // Filter out the current folder from the list
    const availableFolders = folders.filter((folder) => {
      // Exclude current folder (if pin has folderId, exclude that folder)
      if (pin.folderId && folder.id === pin.folderId) {
        return false;
      }
      // Exclude 'unorganized' folder from the list since we show it separately
      if (
        folder.id === "unorganized" ||
        folder.name.toLowerCase() === "unorganized pins"
      ) {
        return false;
      }
      return true;
    });

    // Apply search filter
    if (!moveFolderSearch.trim()) return availableFolders;
    return availableFolders.filter((folder) =>
      folder.name.toLowerCase().includes(moveFolderSearch.toLowerCase())
    );
  }, [folders, moveFolderSearch, pin.folderId]);

  // Calculate dynamic dropdown width based on folder names
  const dropdownWidth = useMemo(() => {
    const allNames = [
      "New Folder",
      "Unorganized",
      ...filteredFolders.map((f) => f.name),
    ];
    const maxLength = Math.max(
      ...allNames.map((name) => Math.min(name.length, 22))
    );
    // Base width of 160px, add ~8px per character
    const calculatedWidth = Math.max(160, Math.min(maxLength * 8 + 60, 240));
    return calculatedWidth;
  }, [filteredFolders]);



  useEffect(() => {
    if (isEditingTitle && titleTextareaRef.current) {
      titleTextareaRef.current.focus();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    // Only update when incoming tags differ to avoid redundant state updates
    const incoming = pin.tags || [];
    if (
      tags.length !== incoming.length ||
      incoming.some((t, i) => t !== tags[i])
    ) {
      // schedule update to avoid synchronous setState inside an effect
      const id = setTimeout(() => setTags(incoming), 0);
      return () => clearTimeout(id);
    }
  }, [pin.tags, tags]);

  useEffect(() => {
    const incoming = pin.comments || [];
    if (
      comments.length !== incoming.length ||
      incoming.some((c, i) => c !== comments[i])
    ) {
      // schedule update to avoid synchronous setState inside an effect
      const id = setTimeout(() => setComments(incoming), 0);
      return () => clearTimeout(id);
    }
  }, [pin.comments, comments]);

  useEffect(() => {
    if (showCreateFolderDialog && createFolderInputRef.current) {
      // slight delay to ensure element is rendered
      setTimeout(() => createFolderInputRef.current?.focus(), 0);
    }
  }, [showCreateFolderDialog]);

  const handleTagKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && tagInput.trim()) {
      event.preventDefault();

      // Check if adding would exceed 2 lines (approximate)
      if (tags.length >= MAX_TAG_LINES * ESTIMATED_TAGS_PER_LINE) {
        toast({
          title: "Cannot add more tags",
          description: "Maximum tag limit reached (2 lines)",
          variant: "destructive",
        });
        return;
      }

      // Add new tag at the beginning (most recent first)
      const newTags = [tagInput.trim(), ...tags];
      setTags(newTags);
      const updatedPin = { ...pin, tags: newTags };
      onUpdatePin(updatedPin);
      setTagInput("");
      toast({ title: "Tag added!" });
    }
  };

  const handleRemoveTag = (tagIndex: number) => {
    const newTags = tags.filter((_, index) => index !== tagIndex);
    setTags(newTags);
    onRemoveTag(pin.id, tagIndex);
  };



  const handleSaveTitle = () => {
    if (titleInput.trim()) {
      const updatedPin = {
        ...pin,
        title: titleInput.trim(),
        text: titleInput.trim(),
      };
      onUpdatePin(updatedPin);
      setIsEditingTitle(false);
      toast({ title: "Title updated!" });
    } else {
      // If empty, cancel edit and restore original
      setTitleInput(pin.title ?? pin.text);
      setIsEditingTitle(false);
    }
  };

  const handleTitleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSaveTitle();
    }
    if (event.key === "Escape") {
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
      setCommentInput("");
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
      setEditCommentInput("");
    }
  };

  const handleCancelEditComment = () => {
    setEditingCommentIndex(null);
    setEditCommentInput("");
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
      setMoveFolderSearch("");
    }
  };

  const handleCreateAndMove = async () => {
    if (!moveFolderSearch.trim() || !onCreateFolder || !onMovePin) return;

    try {
      const newFolder = await onCreateFolder(moveFolderSearch.trim());
      onMovePin(pin.id, newFolder.id);
      toast({ title: `Created folder and moved to ${newFolder.name}` });
      setMoveFolderSearch("");
    } catch (error) {
      console.error("Failed to create folder", error);
      toast({ title: "Failed to create folder", variant: "destructive" });
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

  const handleInsertToChat = () => {
    if (onInsertToChat) {
      onInsertToChat(bodyContent, pin);
    }
  };
  // pin card layout and texture
  return (
    <Card
      className="border bg-[#F5F5F5] overflow-hidden"
      style={
        inOrganizeDialog
          ? {
              width: "235px",
              height: "auto",
              borderRadius: "8px",
              opacity: 1,
              overflow: "hidden",
              border: isSelected ? "1px solid #756AF2" : "1px solid #e6e6e6",
              padding: 0,
            }
          : {
              width: "100%",
              minHeight:"auto",
              borderRadius: "8px",
              marginRight: "6px",
              border: "1px solid #e6e6e6",
              padding: 0,
            }
      }
    >
      {" "}
      <CardContent
        className="w-full flex flex-col overflow-hidden"
        style={
          inOrganizeDialog
            ? { gap: "8px", padding: "12px", overflow: "hidden" }
            : { gap: "10px", padding: "12px" }
        }
      >
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
                  style={{
                    fontFamily: "Inter",
                    fontWeight: 500,
                    fontSize: "16px",
                    lineHeight: "140%",
                  }}
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
              <div className="overflow-hidden">
                <div title={pin.title ?? pin.text}>
                  <p
                    className="text-[#1e1e1e] overflow-hidden"
                    style={
                      isTitleExpanded && !inOrganizeDialog
                        ? {
                            fontFamily: "Inter",
                            fontWeight: 500,
                            fontSize: "16px",
                            lineHeight: "140%",
                          }
                        : ({
                            fontFamily: "Inter",
                            fontWeight: 500,
                            fontSize: "16px",
                            lineHeight: "140%",
                            display: "-webkit-box",
                            WebkitLineClamp: inOrganizeDialog ? 2 : 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          } as React.CSSProperties)
                    }
                  >
                    {pin.title ?? pin.text}
                  </p>
                </div>
                {!inOrganizeDialog &&
                ((pin.title && pin.title.length > TRUNCATE_TITLE_LEN) ||
                  (!pin.title && pin.text.length > TRUNCATE_TITLE_LEN)) ? (
                  <button
                    className="text-xs text-[#3b82f6] mt-1 p-0"
                    onClick={() => setIsTitleExpanded((prev) => !prev)}
                  >
                    {isTitleExpanded ? "show less" : "read more..."}
                  </button>
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
              style={{
                width: "122px",
                borderRadius: "8px",
                padding: "2px",
                backgroundColor: "#FFFFFF",
                border: "1px solid #E5E5E5",
                boxShadow:
                  "0px 2px 4px -2px rgba(0, 0, 0, 0.1), 0px 4px 6px -1px rgba(0, 0, 0, 0.1)",
              }}
            >
              <DropdownMenuItem
                onClick={() => setIsEditingTitle(true)}
                className="text-[#0A0A0A] cursor-pointer"
                style={{
                  width: "118px",
                  height: "32px",
                  minHeight: "32px",
                  borderRadius: "6px",
                  gap: "8px",
                  paddingTop: "5.5px",
                  paddingRight: "8px",
                  paddingBottom: "5.5px",
                  paddingLeft: "8px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#D9D9D9";
                  e.currentTarget.style.color = "#0A0A0A";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "#0A0A0A";
                }}
              >
                <Edit className="mr-2 h-4 w-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDuplicatePin}
                className="text-[#0A0A0A] cursor-pointer"
                style={{
                  width: "118px",
                  height: "32px",
                  minHeight: "32px",
                  borderRadius: "6px",
                  gap: "8px",
                  paddingTop: "5.5px",
                  paddingRight: "8px",
                  paddingBottom: "5.5px",
                  paddingLeft: "8px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#D9D9D9";
                  e.currentTarget.style.color = "#0A0A0A";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "#0A0A0A";
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger
                  className="text-[#0A0A0A] cursor-pointer"
                  style={{
                    width: "118px",
                    height: "32px",
                    minHeight: "32px",
                    borderRadius: "6px",
                    gap: "8px",
                    paddingTop: "5.5px",
                    paddingRight: "8px",
                    paddingBottom: "5.5px",
                    paddingLeft: "8px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#D9D9D9";
                    e.currentTarget.style.color = "#0A0A0A";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "#0A0A0A";
                  }}
                >
                  <FolderInput className="mr-2 h-4 w-4" />
                  Move
                </DropdownMenuSubTrigger>
                {/*Submenu content for Move dropdown under pincards*/}
                <DropdownMenuSubContent
                  className="border border-[#e6e6e6] bg-white p-2 text-[#171717]"
                  style={{
                    width: showCreateFolderDialog
                      ? "300px"
                      : `${dropdownWidth}px`,
                  }}
                >
                  {showCreateFolderDialog ? (
                    <div
                      className="flex flex-col"
                      style={{
                        width: "300px",
                        height: "134px",
                        gap: "12px",
                        opacity: 1,
                        borderRadius: "6px",
                        border: "1px solid #E5E5E5",
                        padding: "8px",
                        backgroundColor: "#FFFFFF",
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <div className="text-sm font-medium text-[#171717]">
                        Create New Folder
                      </div>
                      <input
                        ref={createFolderInputRef}
                        type="text"
                        placeholder="Folder name"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newFolderName.trim()) {
                            e.preventDefault();
                            if (onCreateFolder) {
                              onCreateFolder(newFolderName.trim())
                                .then((newFolder) => {
                                  if (onMovePin) {
                                    onMovePin(pin.id, newFolder.id);
                                  }
                                  setNewFolderName("");
                                  setShowCreateFolderDialog(false);
                                  toast({ title: `Created ${newFolder.name}` });
                                })
                                .catch(() => {
                                  toast({
                                    title: "Failed to create folder",
                                    variant: "destructive",
                                  });
                                });
                            }
                          }
                          if (e.key === "Escape") {
                            setShowCreateFolderDialog(false);
                            setNewFolderName("");
                          }
                        }}
                        className="text-sm text-black placeholder:text-[#9a9a9a] focus:outline-none focus:ring-1 focus:ring-[#2c2c2c]"
                        style={{
                          width: "268px",
                          height: "36px",
                          minHeight: "36px",
                          borderRadius: "8px",
                          border: "1px solid #E5E5E5",
                          backgroundColor: "#FFFFFF",
                          paddingTop: "7.5px",
                          paddingBottom: "7.5px",
                          paddingLeft: "3px",
                          paddingRight: "3px",
                          gap: "8px",
                        }}
                      />
                      <div className="flex items-center" style={{ gap: "8px" }}>
                        <Button
                          onClick={() => {
                            if (!newFolderName.trim() || !onCreateFolder)
                              return;
                            onCreateFolder(newFolderName.trim())
                              .then((newFolder) => {
                                if (onMovePin) {
                                  onMovePin(pin.id, newFolder.id);
                                }
                                setNewFolderName("");
                                setShowCreateFolderDialog(false);
                                toast({ title: `Created ${newFolder.name}` });
                              })
                              .catch(() => {
                                toast({
                                  title: "Failed to create folder",
                                  variant: "destructive",
                                });
                              });
                          }}
                          className="bg-[#1e1e1e] text-white hover:bg-[#2c2c2c]"
                          style={{
                            width: "102px",
                            height: "36px",
                            minHeight: "36px",
                            borderRadius: "8px",
                            paddingTop: "7.5px",
                            paddingBottom: "7.5px",
                            paddingLeft: "4px",
                            paddingRight: "4px",
                            gap: "8px",
                          }}
                          disabled={!newFolderName.trim()}
                        >
                          Create
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowCreateFolderDialog(false);
                            setNewFolderName("");
                          }}
                          className="bg-white border border-[#E5E5E5] text-[#171717] hover:bg-[#F5F5F5]"
                          style={{
                            width: "70px",
                            height: "36px",
                            minHeight: "36px",
                            borderRadius: "8px",
                            paddingTop: "5.5px",
                            paddingBottom: "5.5px",
                            paddingLeft: "3px",
                            paddingRight: "3px",
                            gap: "6px",
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="relative mb-2">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9a9a]" />
                        <input
                          type="text"
                          placeholder="Search ..."
                          className="w-full text-sm text-black placeholder:text-black focus:outline-none focus:ring-1 focus:ring-[#2c2c2c]"
                          style={{
                            height: "36px",
                            minHeight: "36px",
                            borderRadius: "8px",
                            border: "1px solid #E5E5E5",
                            backgroundColor: "#FFFFFF",
                            paddingTop: "7.5px",
                            paddingBottom: "7.5px",
                            paddingLeft: "40px",
                            paddingRight: "20px",
                            gap: "8px",
                          }}
                          value={moveFolderSearch}
                          onChange={(event) =>
                            setMoveFolderSearch(event.target.value)
                          }
                          onClick={(event) => event.preventDefault()}
                          onKeyDown={(event) => {
                            if (
                              event.key === "Enter" &&
                              moveFolderSearch.trim() &&
                              filteredFolders.length === 0
                            ) {
                              event.preventDefault();
                              handleCreateAndMove();
                            }
                          }}
                        />
                      </div>
                      <ScrollArea className="max-h-48">
                        <div className="space-y-1" role="menu">
                          {/* New Folder option - always show at top */}
                          <DropdownMenuItem
                            className="cursor-pointer font-medium"
                            style={{
                              width: "100%",
                              height: "32px",
                              minHeight: "32px",
                              borderRadius: "6px",
                              gap: "8px",
                              paddingTop: "5.5px",
                              paddingRight: "2px",
                              paddingBottom: "5.5px",
                              paddingLeft: "2px",
                              color: "#171717",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = "#D9D9D9";
                              e.currentTarget.style.color = "#0A0A0A";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                "transparent";
                              e.currentTarget.style.color = "#171717";
                            }}
                            onSelect={(e) => {
                              e.preventDefault();
                              setMoveFolderSearch("");
                              setShowCreateFolderDialog(true);
                            }}
                          >
                            <FolderPlus className="mr-2 h-3.5 w-3.5" />
                            New Folder
                          </DropdownMenuItem>

                          {/* Show Unorganized only if pin is not already in Unorganized */}
                          {pin.folderId && (
                            <DropdownMenuItem
                              className="cursor-pointer"
                              style={{
                                width: "100%",
                                height: "32px",
                                minHeight: "32px",
                                borderRadius: "6px",
                                gap: "8px",
                                paddingTop: "5.5px",
                                paddingRight: "2px",
                                paddingBottom: "5.5px",
                                paddingLeft: "2px",
                                color: "#171717",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  "#D9D9D9";
                                e.currentTarget.style.color = "#0A0A0A";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  "transparent";
                                e.currentTarget.style.color = "#171717";
                              }}
                              onSelect={() =>
                                handleMoveToFolder(null, "Unorganized")
                              }
                            >
                              Unorganized
                            </DropdownMenuItem>
                          )}

                          {/* Show filtered folders */}
                          {filteredFolders.length > 0 ? (
                            filteredFolders.map((folder) => (
                              <DropdownMenuItem
                                key={folder.id}
                                className="cursor-pointer"
                                style={{
                                  width: "100%",
                                  height: "32px",
                                  minHeight: "32px",
                                  borderRadius: "6px",
                                  gap: "8px",
                                  paddingTop: "5.5px",
                                  paddingRight: "2px",
                                  paddingBottom: "5.5px",
                                  paddingLeft: "2px",
                                  color: "#171717",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor =
                                    "#D9D9D9";
                                  e.currentTarget.style.color = "#0A0A0A";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor =
                                    "transparent";
                                  e.currentTarget.style.color = "#171717";
                                }}
                                onSelect={() =>
                                  handleMoveToFolder(folder.id, folder.name)
                                }
                              >
                                {folder.name}
                              </DropdownMenuItem>
                            ))
                          ) : moveFolderSearch.trim() &&
                            filteredFolders.length === 0 ? (
                            <DropdownMenuItem
                              disabled
                              className="cursor-not-allowed"
                              style={{
                                width: "100%",
                                height: "32px",
                                minHeight: "32px",
                                borderRadius: "6px",
                                gap: "8px",
                                paddingTop: "5.5px",
                                paddingRight: "2px",
                                paddingBottom: "5.5px",
                                paddingLeft: "2px",
                                color: "#9a9a9a",
                              }}
                            >
                              No matching folders
                            </DropdownMenuItem>
                          ) : null}
                        </div>
                      </ScrollArea>
                    </>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem
                onClick={handleDeletePin}
                className="text-red-600 cursor-pointer"
                style={{
                  width: "118px",
                  height: "32px",
                  minHeight: "32px",
                  borderRadius: "6px",
                  gap: "8px",
                  paddingTop: "5.5px",
                  paddingRight: "8px",
                  paddingBottom: "5.5px",
                  paddingLeft: "8px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#D9D9D9";
                  e.currentTarget.style.color = "#0A0A0A";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "#DC2626";
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Inline preview removed to avoid duplicated title/content */}

        {/* Tags section */}
        <div
          className="flex flex-wrap items-center gap-2 overflow-hidden"
          style={
            inOrganizeDialog
              ? {
                  maxHeight: "36px",
                  overflow: "hidden",
                  alignContent: "flex-start",
                }
              : {
                  maxHeight: "44px",
                  overflow: "hidden",
                  alignContent: "flex-start",
                }
          }
        >
          {!inOrganizeDialog &&
            tags.length < MAX_TAG_LINES * ESTIMATED_TAGS_PER_LINE && (
              <div className="relative flex items-center">
                <Tag
                  className="absolute text-[#1e1e1e] pointer-events-none"
                  style={{ left: "6px", height: "7.25px", width: "7.25px" }}
                />
                <input
                  type="text"
                  placeholder="Add Tag"
                  className="border border-[#d4d4d4] bg-transparent text-[#1e1e1e] placeholder:text-[#9F9F9F] focus:outline-none focus:ring-0"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  style={{
                    width: "60.37px",
                    height: "17.86px",
                    minHeight: "17.86px",
                    borderRadius: "7680.2px",
                    paddingTop: "2.23px",
                    paddingBottom: "2.23px",
                    paddingLeft: "16px",
                    paddingRight: "8px",
                    fontSize: "9px",
                    gap: "4.46px",
                  }}
                />
              </div>
            )}
          {tags.map((tag, tagIndex) => {
            // Generate color based on first 2 letters of tag
            const getTagColor = (tagText: string) => {
              const colors = ["#E55959", "#9A6FF1", "#756AF2"];
              const firstTwo = tagText.substring(0, 2).toLowerCase();
              const charSum =
                firstTwo.charCodeAt(0) + (firstTwo.charCodeAt(1) || 0);
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
                  style={{
                    backgroundColor: getTagColor(tag),
                    height: "17.85px",
                    display: "flex",
                    alignItems: "center",
                  }}
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

        {/* Optional short preview in organize dialog */}
        {/* {inOrganizeDialog && (
          <div className="text-xs text-[#666666] truncate" title={bodyContent} style={{ maxWidth: '100%', marginBottom: '2px' }}>
            {bodyContent && (bodyContent.length > 90 ? `${bodyContent.substring(0, 90).trim()}...` : bodyContent)}
          </div>
        )} */}

        {/* Chat name and time */}
        <div className="flex justify-between items-center overflow-hidden">
          <span
            className="text-[#1e1e1e] truncate"
            style={{
              fontFamily: "Inter",
              fontWeight: 400,
              fontSize: "10px",
              lineHeight: "130%",
              letterSpacing: "0.015em",
            }}
          >
            {chatName || "Untitled Chat"}
          </span>
          <span className="text-xs text-[#7a7a7a] flex-shrink-0 ml-2">
            {formatTimestamp(pin.time)}
          </span>
        </div>

        {/* Action buttons row */}
        {!inOrganizeDialog && (
          <div className="flex justify-between items-center">
            <button
              onClick={() => setShowComments(!showComments)}
              className="flex items-center justify-center border border-[#D4D4D4] hover:bg-[#f5f5f5] transition-colors"
              style={
                comments.length > 0
                  ? {
                      width: "48.5px",
                      height: "24px",
                      minHeight: "24px",
                      borderRadius: "9999px",
                      paddingTop: "3px",
                      paddingBottom: "3px",
                      paddingLeft: "8px",
                      paddingRight: "8px",
                      gap: "6px",
                    }
                  : {
                      width: "24px",
                      height: "24px",
                      minHeight: "24px",
                      borderRadius: "9999px",
                      padding: "4px",
                    }
              }
            >
              <MessageSquareText
                className="text-[#666666] flex-shrink-0"
                style={{
                  width: "16px",
                  height: "16px",
                  minWidth: "16px",
                  minHeight: "16px",
                }}
              />
              {comments.length > 0 && (
                <span
                  className="flex items-center justify-center bg-[#2C2C2C] text-white font-medium flex-shrink-0"
                  style={{
                    width: "14.17px",
                    height: "14.17px",
                    minHeight: "14.17px",
                    borderRadius: "6927.73px",
                    paddingTop: "1.77px",
                    paddingBottom: "1.77px",
                    paddingLeft: "4.72px",
                    paddingRight: "4.72px",
                    fontSize: "8px",
                  }}
                >
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
                      style={{
                        width: "76px",
                        height: "24px",
                        minHeight: "24px",
                        borderRadius: "4px",
                        paddingTop: "3px",
                        paddingBottom: "3px",
                        paddingLeft: "8px",
                        paddingRight: "8px",
                        fontFamily:
                          "Inter, Clash Grotesk Variable, Clash Grotesk, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, sans-serif",
                        fontWeight: 500,
                        fontSize: "12px",
                        lineHeight: "150%",
                        letterSpacing: "1.5%",
                        textAlign: "center",
                      }}
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
                      style={{
                        width: "50px",
                        height: "24px",
                        minHeight: "24px",
                        borderRadius: "4px",
                        paddingTop: "3px",
                        paddingBottom: "3px",
                        paddingLeft: "8px",
                        paddingRight: "8px",
                        fontFamily:
                          "Inter, Clash Grotesk Variable, Clash Grotesk, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, sans-serif",
                        fontWeight: 500,
                        fontSize: "12px",
                        lineHeight: "150%",
                        letterSpacing: "1.5%",
                        textAlign: "center",
                      }}
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
        )}

        {/* Comment section */}
        {!inOrganizeDialog && showComments && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Display existing comments */}
            {comments.length > 0 && (
              <div className="space-y-2 max-h-[120px] overflow-y-auto scrollbar-hidden">
                {comments.map((comment, index) => (
                  <div
                    key={index}
                    className="group relative rounded-lg bg-[#F9F9F9] p-2 pr-10 text-xs text-[#1e1e1e]"
                  >
                    {editingCommentIndex === index ? (
                      <div className="space-y-2">
                        <Input
                          value={editCommentInput}
                          onChange={(e) => setEditCommentInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && editCommentInput.trim()) {
                              handleSaveEditedComment();
                            }
                            if (e.key === "Escape") {
                              handleCancelEditComment();
                            }
                          }}
                          className="w-full rounded-[6px] border border-[#dcdcdc] bg-white text-xs text-[#1e1e1e]"
                          style={{
                            height: "32px",
                            paddingLeft: "8px",
                            paddingRight: "8px",
                          }}
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
                        <div className="absolute top-1 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[#F9F9F9]">
                          <button
                            onClick={() => handleEditComment(index)}
                            className="rounded hover:bg-[#E5E5E5] p-1"
                          >
                            <Edit className="h-3 w-3 text-[#666666]" />
                          </button>
                          <button
                            onClick={() => {
                              const updatedComments = comments.filter(
                                (_, i) => i !== index
                              );
                              setComments(updatedComments);
                              onUpdatePin({
                                ...pin,
                                comments: updatedComments,
                              });
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
            <div
              className="relative flex items-center"
              style={{ width: "100%" }}
            >
              <Input
                placeholder="Add your comment..."
                className="w-full rounded-[8px] border border-[#dcdcdc] bg-white pr-12 text-xs text-[#1e1e1e]"
                style={{
                  height: "36px",
                  minHeight: "36px",
                  paddingTop: "7.5px",
                  paddingBottom: "7.5px",
                  paddingLeft: "12px",
                }}
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && commentInput.trim()) {
                    handleAddComment();
                  }
                  if (e.key === "Escape") {
                    setShowComments(false);
                    setCommentInput("");
                  }
                }}
              />
              <button
                onClick={handleAddComment}
                disabled={!commentInput.trim()}
                className="absolute right-2 flex h-6 w-6 items-center justify-center rounded-full border border-[#1e1e1e] hover:bg-[#f5f5f5] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ top: "50%", transform: "translateY(-50%)" }}
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
