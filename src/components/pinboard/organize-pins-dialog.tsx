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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Folder, Unlink, MoreVertical, Trash2, Edit, Move, FolderPlus, Search, ChevronDown } from "lucide-react";
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
  chatBoards?: Array<{ id: string; name: string }>;
}

const initialFolders: FolderType[] = [
  { id: "unorganized", name: "Unorganized Pins" },
  { id: "research", name: "Research" },
  { id: "work", name: "Work Projects" },
  { id: "personal", name: "Personal" },
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
  chatBoards = [],
}: OrganizePinsDialogProps) {
  const [folders, setFolders] = useState<FolderType[]>(foldersProp?.length ? foldersProp : initialFolders);
  const [selectedPinIds, setSelectedPinIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>("");
  const [isEditingFolder, setIsEditingFolder] = useState<boolean>(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState<string>("");
  const createInputRef = useRef<HTMLInputElement | null>(null);
  const editInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>(["unorganized"]);
  
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

  const handlePinUpdate = (updatedPin: PinType) => {
    if (initialPins.length > 0) {
      onPinsUpdate(initialPins.map(p => p.id === updatedPin.id ? updatedPin : p));
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

  const handleConfirmRenameFolder = () => {

      // Focus the create / edit inputs when the inline modals open
      useEffect(() => {
        if (isCreatingFolder) {
          // wait a tick for rendering
          setTimeout(() => createInputRef.current?.focus(), 0);
        }
      }, [isCreatingFolder]);

      useEffect(() => {
        if (isEditingFolder) {
          setTimeout(() => editInputRef.current?.focus(), 0);
        }
      }, [isEditingFolder]);
    if (editingFolderId) {
      const updatedFolders = folders.map(f => 
        f.id === editingFolderId 
          ? { ...f, name: editFolderName.trim() || f.name }
          : f
      );
      setFolders(updatedFolders);
    }
    setIsEditingFolder(false);
    setEditingFolderId(null);
    setEditFolderName("");
  };

  const handleDeleteFolder = (folderId: string) => {
    // Move all pins from this folder to Unorganized
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
    // Remove the folder
    setFolders(folders.filter(f => f.id !== folderId));
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
    if (initialPins.length > 0) {
      onPinsUpdate(initialPins.filter(p => !selectedPinIds.includes(p.id)));
    } else {
      // For dummy pins, create new array and replace contents to trigger re-render
      const remainingPins = dummyPins.filter(p => !selectedPinIds.includes(p.id));
      dummyPins.length = 0;
      dummyPins.push(...remainingPins);
    }
    setSelectedPinIds([]);
  };

  const handleMovePins = (targetFolderId: string) => {
    if (initialPins.length > 0) {
      const updatedPins = initialPins.map(pin => 
        selectedPinIds.includes(pin.id) 
          ? { ...pin, folderId: targetFolderId === 'unorganized' ? undefined : targetFolderId }
          : pin
      );
      onPinsUpdate(updatedPins);
    } else {
      // For dummy pins, create new array with updated pins (for testing)
      const updatedDummyPins = dummyPins.map(pin => 
        selectedPinIds.includes(pin.id)
          ? { ...pin, folderId: targetFolderId === 'unorganized' ? undefined : targetFolderId }
          : pin
      );
      // Replace dummyPins array contents to trigger re-render
      dummyPins.length = 0;
      dummyPins.push(...updatedDummyPins);
    }
    setSelectedPinIds([]);
    // Stay on current folder to show the pins were moved
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="organize-dialog flex flex-col bg-transparent p-0 text-[#171717] gap-0">
        <div className="organize-dialog-inner relative flex flex-col">
        <DialogHeader className="border-b bg-white py-6 px-6 text-[#171717] space-y-4">
          <DialogTitle className="text-left text-[#171717] font-semibold text-lg">Organize Pins</DialogTitle>
          
          {/* Search Input */}
          <div className="relative w-full max-w-[420px] mt-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#9a9a9a]" />
            <input
              type="text"
              placeholder="Search pins..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
                gap: "8px"
              }}
            />
            {searchQuery && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-[#666666]">
                {selectedFolderPins.filter(pin => 
                  pin.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  pin.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
                ).length} results
              </div>
            )}
          </div>
        </DialogHeader>
        
        <div className="flex-1 flex overflow-hidden py-4 min-h-0" style={{ gap: "6px" }}>
          {/* Left Section (Folders) */}
          <div className="flex flex-col bg-[#F5F5F5] flex-shrink-0" style={{ width: "min(380px, 46%)", minWidth: "220px", height: "541px", maxHeight: "100%", borderRadius: "10px", padding: "12px 12px 12px 20px", gap: "12px" }}>
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
            
            <ScrollArea className="flex-1 scrollbar-grey">
              <div className="space-y-1">
                {folders.map(folder => (
                  <div
                    key={folder.id}
                    className={`w-full flex items-center justify-between p-3 sm:p-2 rounded-lg text-sm cursor-pointer transition-colors duration-150 ${
                      selectedFolderIds.includes(folder.id) ? 'bg-white border border-[#e6e6e6] shadow-sm' : 'bg-white hover:bg-[#fbfbfb] border border-transparent'
                    }`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if ((e as React.KeyboardEvent).ctrlKey || (e as React.KeyboardEvent).metaKey || (e as React.KeyboardEvent).shiftKey) { setSelectedFolderIds(prev => prev.includes(folder.id) ? prev.filter(id => id !== folder.id) : [...prev, folder.id]); } else { setSelectedFolderIds([folder.id]); } } }}
                  >
                    <div 
                      className="flex items-center gap-2 flex-1 min-w-0"
                      onClick={(e) => {
                        const ev = e as React.MouseEvent;
                        if (ev.ctrlKey || ev.metaKey || ev.shiftKey) {
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
                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded hover:bg-[#e5e5e5]">
                              <MoreVertical className="h-4 w-4 text-[#666666]" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[120px] bg-white border border-[#e6e6e6]">
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
              </div>
            </ScrollArea>
            
            {folders.length === 1 && (
              <div className="pt-4">
                <Button 
                  onClick={handleCreateFolder}
                  className="w-full bg-[#2c2c2c] text-white hover:bg-[#1f1f1f] rounded-lg"
                >
                  New folder
                </Button>
              </div>
            )}
          </div>

          {/* Right Section (Selected Folder Pins) */}
          <div className="flex-1 flex flex-col bg-white" style={{ borderRadius: "10px", padding: "8px 20px 8px 8px" }}>
            <div className="pb-3 flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-[#171717] truncate flex-shrink-0" style={{ maxWidth: selectedPinIds.length > 0 ? "120px" : "100%" }}>
                {folders.find(f => f.id === selectedFolderIds[0])?.name || "Unorganised pins"}
              </h3>
              {selectedPinIds.length > 0 && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="rounded-lg border-[#d4d4d4] text-[#171717] hover:bg-[#f5f5f5] h-7 px-2 text-xs">
                        <Move className="h-3 w-3 mr-1"/>
                        Move
                        <ChevronDown className="h-3 w-3 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[200px] border border-[#e6e6e6] bg-white p-2 z-[10001]">
                      <div className="mb-2">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a8a8a]" />
                          <Input
                            placeholder="Search folders..."
                            className="h-8 pl-8 text-xs rounded-md border-[#e2e2e2]"
                            onChange={(e) => {
                              const searchValue = e.target.value.toLowerCase();
                              const items = document.querySelectorAll('[data-folder-item]');
                              items.forEach((item) => {
                                const folderName = item.getAttribute('data-folder-name')?.toLowerCase() || '';
                                const element = item as HTMLElement;
                                element.style.display = folderName.includes(searchValue) ? 'flex' : 'none';
                              });
                            }}
                          />
                        </div>
                      </div>
                      <ScrollArea className="max-h-[200px] scrollbar-grey">
                        <div className="space-y-0.5">
                          {folders
                            .filter(f => !selectedFolderIds.includes(f.id))
                            .map(f => (
                              <DropdownMenuItem 
                                key={f.id} 
                                onClick={() => handleMovePins(f.id)} 
                                className="text-[#171717] hover:bg-[#E5E5E5] text-sm cursor-pointer rounded-md"
                                data-folder-item
                                data-folder-name={f.name}
                              >
                                {f.id === 'unorganized' ? <Unlink className="h-3.5 w-3.5 mr-2 text-[#666666]" /> : <Folder className="h-3.5 w-3.5 mr-2 text-[#666666]" />}
                                <span className="truncate">{f.name}</span>
                              </DropdownMenuItem>
                            ))}
                        </div>
                      </ScrollArea>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleBulkDelete}
                    className="rounded-lg text-red-600 hover:bg-[#fee2e2] hover:text-black h-7 px-2 text-xs"
                  >
                    <Trash2 className="h-3 w-3 mr-1"/>
                    Delete
                  </Button>
                </div>
              )}
            </div>
            
            {selectedFolderPins.length > 0 && selectedPinIds.length > 0 && (
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={selectedPinIds.length === selectedFolderPins.length}
                  onCheckedChange={handleSelectAll}
                  className="rounded-[4px] border-[#1e1e1e] h-4 w-4"
                />
                <span className="text-sm text-[#666666]">Select All</span>
              </div>
            )}
            
            <ScrollArea className="flex-1 scrollbar-grey">
              <div className="space-y-2 pb-24 pr-4">
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
                      <div key={pin.id} className="flex items-center gap-2">
                        <Checkbox 
                          checked={isSelected}
                          onCheckedChange={() => handleTogglePinSelection(pin.id)}
                          className="rounded-[4px] border-[#1e1e1e] h-4 w-4"
                        />
                        <div className="flex-1">
                          <PinItem
                            pin={pin}
                            onUpdatePin={handlePinUpdate}
                            onRemoveTag={handleRemoveTag}
                            onDeletePin={handleDeletePin}
                            chatName={chatBoard?.name}
                            compact={true}
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
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="justify-end gap-4 bg-white pt-4 pb-4 px-6 z-20 mt-auto">
          <Button onClick={onClose} className="rounded-lg bg-[#2c2c2c] text-white hover:bg-[#1f1f1f] pl-4 pr-4 py-2 min-w-[92px] z-30">
            Done
          </Button>
        </DialogFooter>

        {/* Folder Creation Inline Modal (centered inside Organize dialog) */}
        {isCreatingFolder && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 9999 }}>
          <div className="absolute inset-0 bg-black/20" onClick={() => setIsCreatingFolder(false)} style={{ zIndex: 9998 }} />
          <div className="relative w-[420px] bg-white rounded-md p-6 shadow-md" style={{ zIndex: 10000 }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-2">
              <h3 className="text-lg font-semibold text-[#171717]">Create New Folder</h3>
            </div>
            <div className="py-2">
              <Input
                ref={createInputRef}
                placeholder="Folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleConfirmCreateFolder();
                  }
                }}
                className="text-[#171717]"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="ghost" onClick={() => setIsCreatingFolder(false)} className="rounded-lg text-[#1e1e1e] hover:bg-[#f0f0f0] hover:text-[#1e1e1e]">
                Cancel
              </Button>
              <Button onClick={handleConfirmCreateFolder} className="rounded-lg bg-[#2c2c2c] text-white hover:bg-[#1f1f1f]">
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
  );
}
