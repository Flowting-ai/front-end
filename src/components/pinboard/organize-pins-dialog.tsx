"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Folder, Unlink, MoreVertical, Trash2, Edit, Move, FolderPlus, Search, ChevronDown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PinType } from "../layout/right-sidebar";
import { PinItem } from "./pin-item";

interface FolderType {
  id: string;
  name: string;
}

interface OrganizePinsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  pins: PinType[];
  onPinsUpdate?: (pins: PinType[]) => void;
  folders?: FolderType[];
  onCreateFolder?: (name: string) => Promise<FolderType> | FolderType;
  onRenameFolder?: (folderId: string, name: string) => Promise<FolderType> | FolderType;
  onDeleteFolder?: (folderId: string) => Promise<void> | void;
  chatBoards?: Array<{ id: string; name: string }>;
}

const initialFolders: FolderType[] = [
  { id: "unorganized", name: "Unorganized Pins" },
];

const dummyPins: PinType[] = [
  {
    id: "dummy-1",
    text: "Do Androids Dream of Electric Sheep? is a science fiction novel exploring the nature of humanity and empathy through the story of a bounty hunter tracking down rogue androids.",
    tags: ["Finance", "Tech", "Sci-fi"],
    time: new Date(Date.now() - 3600000),
    chatId: "chat-1",
    notes: "",
    comments: [],
  },
  {
    id: "dummy-2",
    text: "Machine learning algorithms can be categorized into supervised, unsupervised, and reinforcement learning approaches, each with distinct use cases and methodologies.",
    tags: ["AI", "Tech", "Research"],
    time: new Date(Date.now() - 7200000),
    chatId: "chat-2",
    notes: "",
    comments: [],
    folderId: "research",
  },
  {
    id: "dummy-3",
    text: "The Fibonacci sequence is a mathematical pattern where each number is the sum of the two preceding ones, commonly found in nature and used in various applications.",
    tags: ["Math", "Science"],
    time: new Date(Date.now() - 86400000),
    chatId: "chat-1",
    notes: "",
    comments: [],
  },
  {
    id: "dummy-4",
    text: "Project deadline for Q4 deliverables is December 15th. Need to coordinate with design team for final mockups and development resources.",
    tags: ["Work", "Planning"],
    time: new Date(Date.now() - 10800000),
    chatId: "chat-3",
    notes: "",
    comments: [],
    folderId: "work",
  },
  {
    id: "dummy-5",
    text: "Remember to book vacation flights for summer trip to Japan. Check for cherry blossom season timing and accommodation options in Tokyo and Kyoto.",
    tags: ["Travel", "Personal"],
    time: new Date(Date.now() - 14400000),
    chatId: "chat-4",
    notes: "",
    comments: [],
    folderId: "personal",
  },
  {
    id: "dummy-6",
    text: "Neural networks use backpropagation to adjust weights during training, optimizing the model's performance on specific tasks through gradient descent.",
    tags: ["AI", "Deep Learning"],
    time: new Date(Date.now() - 21600000),
    chatId: "chat-2",
    notes: "",
    comments: [],
    folderId: "research",
  },
  {
    id: "dummy-7",
    text: "Review quarterly budget allocations and prepare presentation for stakeholder meeting next week. Focus on cost optimization strategies.",
    tags: ["Finance", "Work"],
    time: new Date(Date.now() - 28800000),
    chatId: "chat-5",
    notes: "",
    comments: [],
    folderId: "work",
  },
];

export function OrganizePinsDialog({
  isOpen,
  onClose,
  pins: initialPins,
  onPinsUpdate = () => {},
  folders: foldersProp,
  onCreateFolder,
   onRenameFolder,
   onDeleteFolder,
  chatBoards = [],
}: OrganizePinsDialogProps) {
  const [folders, setFolders] = useState<FolderType[]>(
    foldersProp?.length ? foldersProp : initialFolders
  );
  const [selectedPinIds, setSelectedPinIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchFolderQuery, setSearchFolderQuery] = useState<string>("");
  const [moveFolderSearch, setMoveFolderSearch] = useState("");
  const [isMoveMode, setIsMoveMode] = useState(false);
  const [selectedMoveFolder, setSelectedMoveFolder] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>("");
  const [isEditingFolder, setIsEditingFolder] = useState<boolean>(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState<string>("");
  const createInputRef = useRef<HTMLInputElement | null>(null);
  const editInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>(["unorganized"]);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollThumbRef = useRef<HTMLDivElement | null>(null);
  const [scrollThumbTop, setScrollThumbTop] = useState(0);

  // Reset states when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      // Reset move mode and selections when dialog closes
      setIsMoveMode(false);
      setSelectedMoveFolder(null);
      setSelectedPinIds([]);
      setMoveFolderSearch('');
      setSearchQuery('');
      setSearchFolderQuery('');
    }
  }, [isOpen]);

  // When folders from the backend change, sync them into local state so
  // pre-existing folders are always shown instead of only the static defaults.
  useEffect(() => {
    if (foldersProp && foldersProp.length > 0) {
      // Treat any backend "Unorganized" / default folder as the same bucket
      // as our top-level "Unorganized Pins" instead of a separate row.
      const cleanedRemote = foldersProp.filter((folder) => {
        const name = folder.name?.trim().toLowerCase();
        return name !== "unorganized" && name !== "unorganized pins";
      });
      const next: FolderType[] = [
        { id: "unorganized", name: "Unorganized Pins" },
        ...cleanedRemote,
      ];
      setFolders(next);
    } else {
      setFolders(initialFolders);
    }
  }, [foldersProp]);

  useEffect(() => {
    if (isCreatingFolder) {
      setTimeout(() => createInputRef.current?.focus(), 0);
    }
  }, [isCreatingFolder]);

  useEffect(() => {
    if (isEditingFolder) {
      setTimeout(() => editInputRef.current?.focus(), 0);
    }
  }, [isEditingFolder]);
  
  // Use dummy pins if no real pins exist
  const pinsToDisplay = initialPins.length > 0 ? initialPins : dummyPins;

  const pinsByFolder = useMemo(() => {
    const grouped: Record<string, PinType[]> = {};
    folders.forEach(folder => {
      grouped[folder.id] = [];
    });
    
    pinsToDisplay.forEach(pin => {
      const folderId = pin.folderId || "unorganized";
      if (grouped[folderId]) {
        grouped[folderId].push(pin);
      } else {
        grouped["unorganized"].push(pin);
      }
    });

    return grouped;
  }, [pinsToDisplay, folders]);

  const unorganizedPins = pinsByFolder["unorganized"] || [];
  const selectedFolderPins = useMemo(() => {
    // Aggregate pins from all selected folders
    const pins: PinType[] = [];
    selectedFolderIds.forEach(id => {
      const list = pinsByFolder[id] || [];
      list.forEach(p => pins.push(p));
    });
    return pins;
  }, [pinsByFolder, selectedFolderIds]);

  // Handle scroll for custom scrollbar
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      const scrollTop = container.scrollTop;
      
      if (scrollHeight <= clientHeight) {
        setScrollThumbTop(0);
        return;
      }
      
      const scrollRatio = scrollTop / (scrollHeight - clientHeight);
      const trackHeight = 541; // Total track height
      const thumbHeight = 48; // Thumb height
      const maxThumbTop = trackHeight - thumbHeight;
      
      setScrollThumbTop(scrollRatio * maxThumbTop);
    };

    container.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial calculation
    
    return () => container.removeEventListener('scroll', handleScroll);
  }, [selectedFolderPins]);


  const filteredMoveableFolders = useMemo(() => {
    if (!moveFolderSearch.trim()) return folders;
    return folders.filter(folder => 
      folder.name.toLowerCase().includes(moveFolderSearch.toLowerCase())
    );
  }, [folders, moveFolderSearch]);

  const handlePinUpdate = (updatedPin: PinType) => {
    if (initialPins.length > 0) {
      const existingPin = initialPins.find(p => p.id === updatedPin.id);
      if (existingPin) {
        // Update existing pin
        onPinsUpdate(initialPins.map(p => p.id === updatedPin.id ? updatedPin : p));
      } else {
        // Add new pin (for duplication)
        onPinsUpdate([...initialPins, updatedPin]);
      }
    }
  };

  const handleRemoveTag = (pinId: string, tagIndex: number) => {
    const pin = pinsToDisplay.find(p => p.id === pinId);
    if (pin) {
      const newTags = pin.tags.filter((_, i) => i !== tagIndex);
      handlePinUpdate({ ...pin, tags: newTags });
    }
  };

  const handleDeletePin = (pinId: string) => {
    if (initialPins.length > 0) {
      onPinsUpdate(initialPins.filter(p => p.id !== pinId));
    } else {
      // For dummy pins, create new array and replace contents to trigger re-render
      const remainingPins = dummyPins.filter(p => p.id !== pinId);
      dummyPins.length = 0;
      dummyPins.push(...remainingPins);
    }
  };

  const handleCreateFolder = () => {
    setIsCreatingFolder(true);
    setNewFolderName("");
  };

  const handleConfirmCreateFolder = async () => {
    let folderName = newFolderName.trim() || "New Folder";
    
    // Check for duplicate folder names and auto-increment if needed
    let counter = 1;
    let finalName = folderName;
    while (folders.some(f => f.name.toLowerCase() === finalName.toLowerCase())) {
      finalName = `${folderName} (${counter})`;
      counter++;
    }
    
    let createdFolder: FolderType | undefined;
    if (onCreateFolder) {
      try {
        const result = await onCreateFolder(finalName);
        if (result && result.id) {
          createdFolder = result;
        }
      } catch (err) {
        // swallow and fallback to local creation below
        createdFolder = undefined;
      }
    }

    if (!createdFolder) {
      createdFolder = { id: `folder-${Date.now()}`, name: finalName };
    }

    // Insert after Unorganized folder (index 0) using latest state
    setFolders((prev) => {
      const base = prev.length ? prev : initialFolders;
      return [base[0], createdFolder!, ...base.slice(1)];
    });

    // If in move mode, auto-select the newly created folder
    if (isMoveMode && createdFolder) {
      setSelectedMoveFolder(createdFolder.id);
    }

    setIsCreatingFolder(false);
    setNewFolderName("");
  };

  const handleRenameFolder = (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (folder) {
      setEditingFolderId(folderId);
      setEditFolderName(folder.name);
      setIsEditingFolder(true);
    }
  };

  const handleConfirmRenameFolder = async () => {
    if (editingFolderId) {
      const nextName = editFolderName.trim();
      if (!nextName) {
        setIsEditingFolder(false);
        setEditingFolderId(null);
        setEditFolderName("");
        return;
      }

      try {
        let updatedFolder: FolderType | null = null;
        if (onRenameFolder) {
          const result = await onRenameFolder(editingFolderId, nextName);
          if (result && result.id) {
            updatedFolder = { id: result.id, name: result.name };
          }
        }

        setFolders((prev) =>
          prev.map((folder) =>
            folder.id === editingFolderId
              ? { ...folder, name: updatedFolder?.name ?? nextName }
              : folder
          )
        );
      } catch (error) {
        // If the backend rejects the rename (e.g., duplicate or default folder),
        // keep the previous name and just log the error.
        console.error("Failed to rename folder", error);
      }
    }
    setIsEditingFolder(false);
    setEditingFolderId(null);
    setEditFolderName("");
  };

  const handleDeleteFolder = async (folderId: string) => {
    try {
      if (onDeleteFolder) {
        await onDeleteFolder(folderId);
      }

      // Move all pins from this folder to Unorganized locally
      if (initialPins.length > 0) {
        const updatedPins = initialPins.map(pin =>
          pin.folderId === folderId
            ? { ...pin, folderId: undefined }
            : pin
        );
        onPinsUpdate(updatedPins);
      } else {
        // For dummy pins
        pinsToDisplay.forEach(pin => {
          if (pin.folderId === folderId) {
            pin.folderId = undefined;
          }
        });
      }

      // Remove the folder from local state
      setFolders((prev) => prev.filter((folder) => folder.id !== folderId));
    } catch (error) {
      // Backend will enforce "cannot delete default" and "must be empty";
      // if it fails, keep UI as-is.
      console.error("Failed to delete folder", error);
    }
  };

  const handleTogglePinSelection = (pinId: string) => {
    setSelectedPinIds(prev => 
      prev.includes(pinId) 
        ? prev.filter(id => id !== pinId)
        : [...prev, pinId]
    );
  };

  const handleSelectAll = () => {
    if (selectedPinIds.length === selectedFolderPins.length) {
      setSelectedPinIds([]);
    } else {
      setSelectedPinIds(selectedFolderPins.map(p => p.id));
    }
  };

  const handleBulkDelete = () => {
    if (onPinsUpdate) {
      const updatedPins = pinsToDisplay.filter(p => !selectedPinIds.includes(p.id));
      onPinsUpdate(updatedPins);
    }
    setSelectedPinIds([]);
  };

  const handleConfirmMove = (targetFolderId?: string) => {
    const folderId = targetFolderId || selectedMoveFolder;
    if (!folderId) return;
    
    // Update pins with new folder assignment
    if (onPinsUpdate) {
      const updatedPins = pinsToDisplay.map(pin => 
        selectedPinIds.includes(pin.id) 
          ? { ...pin, folderId: folderId === 'unorganized' ? undefined : folderId }
          : pin
      );
      onPinsUpdate(updatedPins);
    }
    
    // Reset state
    setSelectedPinIds([]);
    setMoveFolderSearch('');
    setIsMoveMode(false);
    setSelectedMoveFolder(null);
  };

  const handleCancelMove = () => {
    setIsMoveMode(false);
    setSelectedPinIds([]);
    setSelectedMoveFolder(null);
    setMoveFolderSearch('');
    setSearchFolderQuery('');
  };

  const handleDeletePins = () => {
    if (selectedPinIds.length === 0) return;
    setShowDeleteConfirm(true);
  };

  const confirmDeletePins = () => {
    if (onPinsUpdate) {
      const updatedPins = initialPins.filter(pin => !selectedPinIds.includes(pin.id));
      onPinsUpdate(updatedPins);
    }
    setSelectedPinIds([]);
    setShowDeleteConfirm(false);
  };

  const handleMoveClick = () => {
    if (selectedPinIds.length === 0) return;
    setIsMoveMode(true);
  };

  const handleCreateFolderAndMove = async () => {
    if (!moveFolderSearch.trim() || !onCreateFolder) return;
    
    try {
      const newFolder = await onCreateFolder(moveFolderSearch.trim());
      setSelectedMoveFolder(newFolder.id);
      setMoveFolderSearch('');
    } catch (error) {
      console.error('Failed to create folder', error);
    }
  };

  return (
    <>
      <style>{`
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: transparent transparent;
          overflow-x: hidden;
        }
        .custom-scrollbar:hover {
          scrollbar-color: #e0e0e0 #f5f5f5;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 10px;
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: transparent;
          border-radius: 8px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar {
          background: #f5f5f5;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background: #e0e0e0;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
          border-radius: 8px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-track {
          background: #f5f5f5;
        }
      `}</style>
      <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="organize-dialog flex flex-col p-0 text-[#171717] gap-0 bg-white"
        style={{
          width: '633px',
          maxWidth: 'min(633px, 95vw)',
          height: '691px',
          maxHeight: 'min(691px, 90vh)',
          borderRadius: '10px',
          opacity: 1,
          overflow: 'hidden',
          padding: 0
        }}
      >
        <div className="organize-dialog-inner relative flex flex-col h-full overflow-hidden bg-white">
        <DialogHeader className="bg-white text-[#171717] space-y-4 flex-shrink-0" style={{ paddingTop: '15px', paddingLeft: '24px', paddingRight: '24px', paddingBottom: '12px', borderBottom: 'none' }}>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-left text-[#171717] font-semibold text-base sm:text-lg">Organize Pins</DialogTitle>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose}
              className="h-8 w-8 rounded-md hover:bg-[#f5f5f5] text-[#666666] hover:text-[#1e1e1e]"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Search Input with Move and Delete buttons */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-[380px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#9a9a9a]" />
              <input
                type="text"
                placeholder={isMoveMode ? "Search folders..." : "Search pins..."}
                value={isMoveMode ? searchFolderQuery : searchQuery}
                onChange={(e) => isMoveMode ? setSearchFolderQuery(e.target.value) : setSearchQuery(e.target.value)}
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
                  paddingRight: (isMoveMode ? searchFolderQuery : searchQuery) ? "60px" : "20px",
                  gap: "8px"
                }}
              />
              {isMoveMode && searchFolderQuery && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-[#666666]">
                  {folders.filter(folder => 
                    folder.name.toLowerCase().includes(searchFolderQuery.toLowerCase())
                  ).length} results
                </div>
              )}
              {!isMoveMode && searchQuery && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-[#666666]">
                  {selectedFolderPins.filter(pin => 
                    pin.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    pin.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
                  ).length} results
                </div>
              )}
            </div>
          </div>
          
          {/* Horizontal divider below search */}
          <div style={{ width: '589px', height: '1px', background: '#E5E5E5', opacity: 1, marginTop: '12px' }} />
        </DialogHeader>
        
        {/* folder column padding */}
        <div className="flex-1 flex overflow-hidden px-4 min-h-0" style={{ gap: "12px", width: '100%', backgroundColor: '#FFFFFF', paddingTop: '16px' }}>
          
          {/* Move Mode - Show only folder selection column */}
          {isMoveMode ? (
            <div 
              className="flex flex-col bg-[#F5F5F5] flex-shrink-0" 
              style={{ 
                width: '592px',
                height: '100%',
                maxHeight: '531px',
                borderRadius: '10px',
                gap: '16px',
                paddingTop: '12px',
                paddingRight: '16px',
                paddingBottom: '12px',
                paddingLeft: '16px'
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex flex-col gap-1">
                  <h3 
                    style={{
                      width: '94px',
                      height: '20px',
                      fontFamily: 'Geist, sans-serif',
                      fontWeight: 600,
                      fontSize: '14px',
                      lineHeight: '140%',
                      letterSpacing: '0%',
                      color: '#171717',
                      opacity: 1
                    }}
                  >
                    Select folders
                  </h3>
                  <p 
                    style={{
                      width: '265px',
                      height: '17px',
                      fontFamily: 'Geist, sans-serif',
                      fontWeight: 400,
                      fontSize: '12px',
                      lineHeight: '140%',
                      letterSpacing: '0%',
                      color: '#666666',
                      opacity: 1
                    }}
                  >
                    Select the folder you want to move the pins to.
                  </p>
                </div>
                <Button
                  onClick={() => setIsCreatingFolder(true)}
                  style={{
                    width: '126.25px',
                    height: '36px',
                    minHeight: '36px',
                    borderRadius: '8px',
                    backgroundColor: '#171717',
                    color: '#FFFFFF',
                    fontFamily: 'Geist, sans-serif',
                    fontWeight: 400,
                    fontSize: '14px',
                    paddingTop: '7.5px',
                    paddingBottom: '7.5px',
                    paddingLeft: '12px',
                    paddingRight: '12px',
                    gap: '8px'
                  }}
                  className="hover:bg-[#000000] flex items-center justify-center"
                >
                  <FolderPlus className="h-4 w-4 mr-2" />
                  New Folder
                </Button>
              </div>
              <div 
                className="flex-1 overflow-y-auto custom-scrollbar"
                style={{ maxHeight: 'calc(100% - 80px)' }}
              >
                <div className="space-y-2 pr-2">
                  {folders
                    .filter(folder => 
                      !searchFolderQuery.trim() || 
                      folder.name.toLowerCase().includes(searchFolderQuery.toLowerCase())
                    )
                    .map(folder => (
                    <div
                      key={folder.id}
                      onClick={() => {
                        setSelectedMoveFolder(folder.id);
                      }}
                      className="cursor-pointer transition-colors"
                      style={{
                        width: '560px',
                        height: '41px',
                        minHeight: '32px',
                        borderRadius: '6px',
                        gap: '8px',
                        paddingTop: '5.5px',
                        paddingRight: '8px',
                        paddingBottom: '5.5px',
                        paddingLeft: '8px',
                        backgroundColor: '#F5F5F5',
                        border: selectedMoveFolder === folder.id ? '1px solid #171717' : '1px solid transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#E6E6E6';
                        if (selectedMoveFolder !== folder.id) {
                          e.currentTarget.style.border = '1px solid #D4D4D4';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#F5F5F5';
                        if (selectedMoveFolder !== folder.id) {
                          e.currentTarget.style.border = '1px solid transparent';
                        }
                      }}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {folder.id === 'unorganized' ? <Unlink className="h-4 w-4 text-[#666666] flex-shrink-0" /> : <Folder className="h-4 w-4 text-[#666666] flex-shrink-0" />}
                        <span className="text-sm text-[#171717] truncate" title={folder.name}>
                          {folder.name.length > 30 ? `${folder.name.substring(0, 30)}...` : folder.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-[#f0f0f0] text-[#171717] text-xs px-2 py-0.5 rounded-full">
                          {pinsByFolder[folder.id]?.length || 0}
                        </Badge>
                        {folder.id !== 'unorganized' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded hover:bg-[#e5e5e5]"
                                onPointerDown={(event) => event.stopPropagation()}
                                onClick={(event) => {
                                  event.stopPropagation();
                                }}
                              >
                                <MoreVertical className="h-4 w-4 text-[#666666]" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-[120px] bg-white border border-[#e6e6e6] z-[70]"
                            >
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                handleRenameFolder(folder.id);
                              }} className="text-[#171717] hover:bg-[#E5E5E5] cursor-pointer">
                                <Edit className="mr-2 h-4 w-4" />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteFolder(folder.id);
                              }} className="text-red-600 hover:bg-[#ffecec] cursor-pointer">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
          {/* Left Section (Folders) */}
          <div 
            className="flex flex-col bg-[#F5F5F5] flex-shrink-0 overflow-hidden" 
            style={{ 
              width: '300px',
              height: '100%',
              maxHeight: '531px',
              borderRadius: '10px',
              paddingTop: '12px',
              paddingRight: '16px',
              paddingBottom: '12px',
              paddingLeft: '16px',
              gap: '16px',
              opacity: 1
            }}
          >
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold text-[#171717]">Folders</h3>
              {folders.length > 1 && (
                <Button
                  onClick={handleCreateFolder}
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded hover:bg-[#e5e5e5] group"
                  title="New folder"
                >
                  <FolderPlus className="h-4 w-4 text-[#666666]" strokeWidth={2.5} />
                </Button>
              )}
            </div>
            
                <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ maxHeight: 'calc(100% - 60px)' }}>
              <div className="space-y-1 pr-2">
                {folders.map(folder => (
                  <div
                    key={folder.id}
                    className={`w-full flex items-center justify-between rounded-lg text-sm cursor-pointer transition-colors duration-150 ${
                      'bg-[#F5F5F5] hover:bg-[#e8e8e8] border border-transparent hover:border-[#D4D4D4]'
                    }`}
                    style={{
                      height: '41px',
                      minHeight: '32px',
                      borderRadius: '6px',
                      paddingTop: '5.5px',
                      paddingRight: '8px',
                      paddingBottom: '5.5px',
                      paddingLeft: '8px',
                      gap: '8px',
                      opacity: 1
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if ((e as React.KeyboardEvent).ctrlKey || (e as React.KeyboardEvent).metaKey || (e as React.KeyboardEvent).shiftKey) { setSelectedFolderIds(prev => prev.includes(folder.id) ? prev.filter(id => id !== folder.id) : [...prev, folder.id]); } else { setSelectedFolderIds([folder.id]); } } }}
                  >
                    <div 
                      className="flex items-center gap-2 flex-1 min-w-0"
                      onClick={(e) => {
                        const ev = e as React.MouseEvent;
                        // In move mode with selected pins, clicking folder moves pins there
                        if (isMoveMode && selectedPinIds.length > 0) {
                          handleConfirmMove(folder.id);
                        } else if (ev.ctrlKey || ev.metaKey || ev.shiftKey) {
                          setSelectedFolderIds(prev => prev.includes(folder.id) ? prev.filter(id => id !== folder.id) : [...prev, folder.id]);
                        } else {
                          setSelectedFolderIds([folder.id]);
                        }
                      }}
                    >
                      {folder.id === 'unorganized' ? <Unlink className="h-4 w-4 text-[#666666] flex-shrink-0" /> : <Folder className="h-4 w-4 text-[#666666] flex-shrink-0" />}
                      <span className="text-[#171717] truncate" title={folder.name}>
                        {folder.name.length > 18 ? `${folder.name.substring(0, 18)}...` : folder.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-[#f0f0f0] text-[#171717] text-xs px-2 py-0.5 rounded-full">
                        {pinsByFolder[folder.id]?.length || 0}
                      </Badge>
                      {folder.id !== 'unorganized' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-[hsl(var(--text-muted))] hover:text-[hsl(var(--primary))] h-6 w-6 rounded hover:bg-[#e5e5e5]"
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4 text-[#666666]" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-[120px] bg-white border border-[#e6e6e6] z-[70]"
                          >
                            <DropdownMenuItem onClick={() => handleRenameFolder(folder.id)} className="text-[#171717] hover:bg-[#E5E5E5] cursor-pointer">
                              <Edit className="mr-2 h-4 w-4" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteFolder(folder.id)} className="text-red-600 hover:bg-[#ffecec] cursor-pointer">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                ))}
                
                {/* Empty state - show when only Unorganized Pins exists */}
                {folders.length === 1 && (
                  <div 
                    className="flex flex-col items-center justify-center mt-4"
                    style={{
                      width: '100%',
                      height: '186px',
                      borderRadius: '8px',
                      borderWidth: '1px',
                      borderColor: '#E5E5E5',
                      padding: '8px',
                      gap: '8px',
                      opacity: 1,
                      fontFamily: 'Geist'
                    }}
                  >
                    <h4 
                      style={{
                        width: '236px',
                        fontFamily: 'Geist, sans-serif',
                        fontWeight: 500,
                        fontSize: '16px',
                        lineHeight: '150%',
                        letterSpacing: '0%',
                        opacity: 1,
                        color: '#000000',
                        textAlign: 'center',
                        margin: 0
                      }}
                    >
                      No Project/Folder
                    </h4>
                    <p 
                      style={{
                        width: '236px',
                        fontFamily: 'Geist, sans-serif',
                        fontWeight: 400,
                        fontSize: '14px',
                        lineHeight: '150%',
                        letterSpacing: '0.5%',
                        opacity: 1,
                        color: '#666666',
                        textAlign: 'center',
                        margin: 0
                      }}
                    >
                      Create your first folder and organise your pins according to projects.
                    </p>
                    <Button 
                      onClick={handleCreateFolder}
                      className="bg-[#2c2c2c] text-white hover:bg-[#1f1f1f]"
                      style={{
                        width: '126.25px',
                        height: '36px',
                        minHeight: '36px',
                        borderRadius: '8px',
                        gap: '8px',
                        paddingTop: '7.5px',
                        paddingRight: '4px',
                        paddingBottom: '7.5px',
                        paddingLeft: '4px',
                        opacity: 1,
                        fontFamily: 'Geist, sans-serif',
                        fontWeight: 400,
                        fontSize: '14px'
                      }}
                    >
                      + New Folder
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Section (Selected Folder Pins) */}
          <div className="flex-1 flex flex-col bg-white overflow-hidden" style={{ borderRadius: "10px", padding: "8px" }}>
            <div className="flex" style={{ gap: '10px', opacity: 1 }}>
              <div className="flex flex-col" style={{ width: '261px', height: '541px', gap: '5px', opacity: 1 }}>
                <div className="flex items-center justify-between" style={{ width: '100%', minHeight: '32px', paddingBottom: '12px', gap: '16px', opacity: 1 }}>
                  <h3 className="text-xs font-semibold text-[#171717] truncate flex-shrink-0">
                    {folders.find(f => f.id === selectedFolderIds[0])?.name || "Unorganised pins"}
                  </h3>
                  
                  {selectedFolderPins.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        checked={selectedPinIds.length === selectedFolderPins.length}
                        onCheckedChange={handleSelectAll}
                        style={{
                          width: '14px',
                          height: '14px',
                          minWidth: '14px',
                          minHeight: '14px',
                          borderRadius: '4px',
                          borderWidth: '1px',
                          opacity: 1,
                          background: '#FFFFFF',
                          border: '1px solid #D4D4D4',
                          boxShadow: '0px 1px 2px 0px #0000000D'
                        }}
                        className="flex-shrink-0"
                      />
                      <span 
                        style={{ 
                          width: '46px', 
                          height: '20px', 
                          opacity: 1,
                          fontFamily: 'Inter',
                          fontWeight: 400,
                          fontSize: '10px',
                          lineHeight: '130%',
                          letterSpacing: '1.5%',
                          color: '#0A0A0A',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        Select all
                      </span>
                    </div>
                  )}
                </div>
                
                <div 
                  ref={scrollContainerRef}
                  className="flex-1 overflow-y-auto" 
                  style={{ 
                    width: '261px', 
                    scrollbarWidth: 'none', 
                    msOverflowStyle: 'none',
                    WebkitOverflowScrolling: 'touch'
                  }}
                >
                  <style jsx>{`
                    div::-webkit-scrollbar {
                      display: none;
                    }
                  `}</style>
                  <div className="space-y-2 flex flex-col items-center" style={{ width: '100%', paddingBottom: '100px' }}>
                  {selectedFolderPins.length > 0 ? (
                    selectedFolderPins
                      .filter(pin => 
                        !searchQuery || 
                        pin.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        pin.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
                      )
                    .map(pin => {
                    const chatBoard = chatBoards.find(board => board.id === pin.chatId);
                    const isSelected = selectedPinIds.includes(pin.id);
                    return (
                      <div key={pin.id} className="flex items-start gap-2" style={{ maxWidth: '100%', width: 'min(263px, 100%)' }}>
                        <Checkbox 
                          checked={isSelected}
                          onCheckedChange={() => handleTogglePinSelection(pin.id)}
                          style={{
                            width: '14px',
                            height: '14px',
                            minWidth: '14px',
                            minHeight: '14px',
                            borderRadius: '4px',
                            borderWidth: '1px',
                            opacity: 1,
                            background: '#FFFFFF',
                            border: '1px solid #D4D4D4',
                            boxShadow: '0px 1px 2px 0px #0000000D',
                            marginTop: '1px'
                          }}
                          className="flex-shrink-0"
                        />
                        <div style={{ width: '235px', flexShrink: 0 }}>
                          <PinItem
                            pin={pin}
                            onUpdatePin={handlePinUpdate}
                            onRemoveTag={handleRemoveTag}
                            onDeletePin={handleDeletePin}
                            chatName={chatBoard?.name}
                            compact={true}
                            inOrganizeDialog={true}
                            isSelected={isSelected}
                            folders={folders}
                            onMovePin={(pinId, folderId) => {
                              // Move pin to the specified folder
                              const updatedPin = { ...pin, folderId: folderId || undefined };
                              handlePinUpdate(updatedPin);
                            }}
                            onCreateFolder={onCreateFolder ? async (name: string) => {
                              const result = await onCreateFolder(name);
                              return result;
                            } : undefined}
                            onDuplicatePin={(pinToDuplicate) => {
                              // Duplicate the pin
                              const duplicatedPin = {
                                ...pinToDuplicate,
                                id: `${pinToDuplicate.id}-copy-${Date.now()}`,
                                time: new Date(),
                              };
                              handlePinUpdate(duplicatedPin);
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center text-[#9a9a9a]">
                    <p className="text-sm">No pins in this folder</p>
                  </div>
                )}
                  </div>
                </div>
              </div>
              
              {/* Custom Scrollbar - Hidden */}
              <div 
                className="relative flex-shrink-0" 
                style={{ 
                  width: '6px', 
                  height: '541px',
                  opacity: 0,
                  display: 'none'
                }}
              >
                <div 
                  ref={scrollThumbRef}
                  style={{
                    width: '6px',
                    height: '48px',
                    borderRadius: '4px',
                    background: '#E5E5E5',
                    opacity: 0,
                    position: 'absolute',
                    top: `${scrollThumbTop}px`,
                    transition: 'top 0.1s ease-out',
                    display: 'none'
                  }}
                />
              </div>
            </div>
          </div>
          </>
          )}
        </div>

        <DialogFooter className="flex justify-end items-center bg-white z-20 flex-shrink-0" style={{ width: '100%', padding: '10px', gap: '8px', opacity: 1 }}>
          {isMoveMode ? (
            <>
              {/* Go Back and Move Pins buttons in Move Mode */}
              <Button 
                onClick={handleCancelMove}
                style={{
                  width: '108px',
                  height: '36px',
                  minHeight: '36px',
                  borderRadius: '8px',
                  paddingTop: '7.5px',
                  paddingRight: '4px',
                  paddingBottom: '7.5px',
                  paddingLeft: '4px',
                  gap: '8px',
                  opacity: 1,
                  backgroundColor: '#E5E5E5',
                  color: '#171717',
                  flexShrink: 0,
                  cursor: 'pointer'
                }}
                className="font-medium text-sm hover:bg-[#D4D4D4]"
              >
                Go Back
              </Button>
              <Button 
                onClick={() => {
                  if (selectedMoveFolder) {
                    handleConfirmMove(selectedMoveFolder);
                  }
                }}
                disabled={!selectedMoveFolder}
                style={{
                  width: '108px',
                  height: '36px',
                  minHeight: '36px',
                  borderRadius: '8px',
                  paddingTop: '7.5px',
                  paddingRight: '4px',
                  paddingBottom: '7.5px',
                  paddingLeft: '4px',
                  gap: '8px',
                  opacity: 1,
                  backgroundColor: !selectedMoveFolder ? 'rgba(23, 23, 23, 0.3)' : '#171717',
                  flexShrink: 0,
                  cursor: !selectedMoveFolder ? 'not-allowed' : 'pointer'
                }}
                className={`text-white font-medium text-sm ${selectedMoveFolder ? 'hover:bg-[#000000]' : ''}`}
              >
                Move Pins
              </Button>
            </>
          ) : (
            <>
              {/* Delete and Move buttons in normal mode */}
              <Button 
                onClick={handleDeletePins}
                disabled={selectedPinIds.length === 0}
                style={{
                  width: '108px',
                  height: '36px',
                  minHeight: '36px',
                  borderRadius: '8px',
                  paddingTop: '7.5px',
                  paddingRight: '4px',
                  paddingBottom: '7.5px',
                  paddingLeft: '4px',
                  gap: '8px',
                  opacity: 1,
                  backgroundColor: selectedPinIds.length === 0 ? 'rgba(220, 38, 38, 0.3)' : '#DC2626',
                  flexShrink: 0,
                  cursor: selectedPinIds.length === 0 ? 'not-allowed' : 'pointer'
                }}
                className={`text-white font-medium text-sm ${selectedPinIds.length > 0 ? 'hover:bg-[#B91C1C]' : ''}`}
              >
                Delete Pins
              </Button>
              <Button 
                onClick={handleMoveClick}
                disabled={selectedPinIds.length === 0}
                style={{
                  width: '108px',
                  height: '36px',
                  minHeight: '36px',
                  borderRadius: '8px',
                  paddingTop: '7.5px',
                  paddingRight: '4px',
                  paddingBottom: '7.5px',
                  paddingLeft: '4px',
                  gap: '8px',
                  opacity: 1,
                  backgroundColor: selectedPinIds.length === 0 ? 'rgba(23, 23, 23, 0.3)' : '#171717',
                  flexShrink: 0,
                  cursor: selectedPinIds.length === 0 ? 'not-allowed' : 'pointer'
                }}
                className={`text-white font-medium text-sm ${selectedPinIds.length > 0 ? 'hover:bg-[#000000]' : ''}`}
              >
                Move Pins
              </Button>
            </>
          )}
        </DialogFooter>

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 9999 }}>
            <div className="absolute inset-0 bg-black/20" onClick={() => setShowDeleteConfirm(false)} style={{ zIndex: 9998 }} />
            <div className="relative w-[420px] bg-white rounded-md p-6 shadow-md" style={{ zIndex: 10000 }} onClick={(e) => e.stopPropagation()}>
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-[#171717]">Delete Pins</h3>
                <p className="text-sm text-[#666666] mt-2">
                  Are you sure you want to delete {selectedPinIds.length} pin{selectedPinIds.length > 1 ? 's' : ''}? This action cannot be undone.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="text-[#171717] border-[#E5E5E5]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmDeletePins}
                  className="bg-[#DC2626] text-white hover:bg-[#B91C1C]"
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Folder Creation Inline Modal (centered inside Organize dialog) */}
        {isCreatingFolder && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 9999 }}>
          <div className="absolute inset-0 bg-black/20" onClick={() => setIsCreatingFolder(false)} style={{ zIndex: 9998 }} />
          <div
            className="relative bg-white shadow-md"
            style={{
              zIndex: 10000,
              width: '300px',
              height: '134px',
              borderRadius: '6px',
              border: '1px solid #E5E5E5',
              padding: '8px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2">
              <h3 className="text-sm font-medium text-[#171717]">Create New Folder</h3>
            </div>
            <div className="py-1">
              <Input
                ref={createInputRef}
                placeholder="Folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newFolderName.trim()) {
                    handleConfirmCreateFolder();
                  }
                  if (e.key === 'Escape') {
                    setIsCreatingFolder(false);
                  }
                }}
                className="text-[#171717]"
                style={{
                  width: '268px',
                  height: '36px',
                  minHeight: '36px',
                  borderRadius: '8px',
                  border: '1px solid #E5E5E5',
                  paddingTop: '7.5px',
                  paddingBottom: '7.5px',
                  paddingLeft: '3px',
                  paddingRight: '3px'
                }}
                autoFocus
              />
            </div>
            <div className="flex justify-end" style={{ gap: '8px', paddingTop: '8px' }}>
              <Button
                variant="outline"
                onClick={() => setIsCreatingFolder(false)}
                className="bg-white border border-[#E5E5E5] text-[#171717] hover:bg-[#F5F5F5]"
                style={{
                  width: '70px',
                  height: '36px',
                  minHeight: '36px',
                  borderRadius: '8px',
                  paddingTop: '5.5px',
                  paddingBottom: '5.5px',
                  paddingLeft: '3px',
                  paddingRight: '3px'
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmCreateFolder}
                className="bg-[#1e1e1e] text-white hover:bg-[#2c2c2c]"
                style={{
                  width: '102px',
                  height: '36px',
                  minHeight: '36px',
                  borderRadius: '8px',
                  paddingTop: '7.5px',
                  paddingBottom: '7.5px',
                  paddingLeft: '4px',
                  paddingRight: '4px'
                }}
                disabled={!newFolderName.trim()}
              >
                Create
              </Button>
            </div>
          </div>
        </div>
        )}

        {/* Folder Edit/Rename Inline Modal (centered inside Organize dialog) */}
        {isEditingFolder && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 9999 }}>
          <div className="absolute inset-0 bg-black/20" onClick={() => setIsEditingFolder(false)} style={{ zIndex: 9998 }} />
          <div className="relative w-[420px] bg-white rounded-md p-6 shadow-md" style={{ zIndex: 10000 }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-2">
              <h3 className="text-lg font-semibold text-[#171717]">Rename Folder</h3>
            </div>
            <div className="py-2">
              <Input
                ref={editInputRef}
                placeholder="Folder name"
                value={editFolderName}
                onChange={(e) => setEditFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleConfirmRenameFolder();
                  }
                }}
                className="text-[#171717]"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="ghost" onClick={() => setIsEditingFolder(false)} className="rounded-lg text-[#1e1e1e] hover:bg-[#f0f0f0] hover:text-[#1e1e1e]">
                Cancel
              </Button>
              <Button onClick={handleConfirmRenameFolder} className="rounded-lg bg-[#2c2c2c] text-white hover:bg-[#1f1f1f]">
                Save
              </Button>
            </div>
          </div>
        </div>
        )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
