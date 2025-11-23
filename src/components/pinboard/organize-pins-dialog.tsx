
"use client";

import { useState, useMemo, useEffect } from "react";
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
import { Search, FolderPlus, Pin as PinIcon, Folder, Unlink, Move, MoreHorizontal } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { PinType } from "../layout/right-sidebar";
import { OrganizePinItem } from "./organize-pin-item";

interface Folder {
  id: string;
  name: string;
}

interface OrganizePinsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  pins: PinType[];
  onPinsUpdate?: (pins: PinType[]) => void;
  folders?: Folder[];
  onCreateFolder?: (name: string) => Promise<Folder> | Folder;
  onMovePins?: (pinIds: string[], folderId: string | null) => Promise<void> | void;
}

const initialFolders: Folder[] = [
  { id: "unorganized", name: "Unorganized Pins" },
  { id: "research", name: "Research" },
];

export function OrganizePinsDialog({
  isOpen,
  onClose,
  pins: initialPins,
  onPinsUpdate = () => {},
  folders: foldersProp,
  onCreateFolder,
  onMovePins,
}: OrganizePinsDialogProps) {
  const [folders, setFolders] = useState<Folder[]>(foldersProp?.length ? foldersProp : initialFolders);
  const [currentPins, setCurrentPins] = useState(initialPins);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("unorganized");
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedPinIds, setSelectedPinIds] = useState<string[]>([]);

  useEffect(() => {
    setCurrentPins(initialPins);
  }, [initialPins]);

  useEffect(() => {
    if (foldersProp && foldersProp.length > 0) {
      setFolders(foldersProp);
      const defaultFolder = foldersProp.find((f) => f.id === "unorganized" || f.name.toLowerCase() === "unorganized");
      if (defaultFolder) {
        setSelectedFolderId(defaultFolder.id);
      }
    }
  }, [foldersProp]);

  const pinsByFolder = useMemo(() => {
    const grouped: Record<string, PinType[]> = {};
    const defaultFolder = folders.find(
      (f) => f.isDefault || f.name.toLowerCase() === "unorganized" || f.id === "unorganized"
    );
    const defaultFolderId = defaultFolder?.id || "unorganized";
    folders.forEach(folder => {
        grouped[folder.id] = [];
    });
    if (!grouped[defaultFolderId]) {
      grouped[defaultFolderId] = [];
    }
    
    currentPins.forEach(pin => {
      const folderId = pin.folderId || defaultFolderId;
      if (!grouped[folderId]) {
        // This can happen if a pin's folderId doesn't exist in the folders list
        // For now, let's add it to unorganized
        grouped[defaultFolderId].push(pin);
      } else {
        grouped[folderId].push(pin);
      }
    });

    return grouped;

  }, [currentPins, folders]);

  const filteredFolders = folders.filter(folder =>
    folder.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedFolder = folders.find(f => f.id === selectedFolderId);
  const pinsInSelectedFolder = selectedFolderId ? pinsByFolder[selectedFolderId] : [];

  const handleCreateFolder = async () => {
    if (newFolderName.trim() === "") return;
    const fallbackFolder: Folder = {
      id: Date.now().toString(),
      name: newFolderName.trim(),
    };
    try {
      const created = onCreateFolder ? await onCreateFolder(newFolderName.trim()) : fallbackFolder;
      setFolders([...folders, created]);
      setSelectedFolderId(created.id);
    } catch (error) {
      console.error("Failed to create folder", error);
    } finally {
      setNewFolderName("");
      setIsCreatingFolder(false);
    }
  };

  const handlePinUpdate = (updatedPin: PinType) => {
    const newPins = currentPins.map(p => p.id === updatedPin.id ? updatedPin : p);
    setCurrentPins(newPins);
  };

  const handleMovePins = async (targetFolderId: string) => {
    const newPins = currentPins.map(pin => 
        selectedPinIds.includes(pin.id) 
            ? { ...pin, folderId: targetFolderId } 
            : pin
    );
    setCurrentPins(newPins);
    setSelectedPinIds([]);
    try {
      if (onMovePins) {
        const targetFolder = folders.find((f) => f.id === targetFolderId);
        const isDefault =
          targetFolderId === "unorganized" ||
          targetFolder?.isDefault ||
          targetFolder?.name.toLowerCase() === "unorganized";
        const folderValue = isDefault ? null : targetFolderId;
        await onMovePins(selectedPinIds, folderValue);
      }
    } catch (error) {
      console.error("Failed to move pins", error);
    }
  };

  const toggleSelectAll = () => {
    if (selectedPinIds.length === pinsInSelectedFolder.length) {
        setSelectedPinIds([]);
    } else {
        setSelectedPinIds(pinsInSelectedFolder.map(p => p.id));
    }
  };

  const handleSelectionChange = (pinId: string, selected: boolean) => {
    if (selected) {
        setSelectedPinIds(prev => [...prev, pinId]);
    } else {
        setSelectedPinIds(prev => prev.filter(id => id !== pinId));
    }
  }

  const handleSaveChanges = () => {
    onPinsUpdate(currentPins);
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        style={{ width: "760px", height: "685px", borderRadius: "1rem" }}
        className="flex flex-col bg-white p-0 text-[#171717]"
      >
        <DialogHeader className="border-b bg-white p-4 text-[#171717]">
          <DialogTitle className="text-left text-[#171717]">Organize Pins</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 grid grid-cols-1 md:grid-cols-[220px_1fr] overflow-hidden">
          {/* Left Section (Folders) */}
          <div className="flex flex-col overflow-y-auto border-r bg-[#f5f5f5]">
            <div className="space-y-3 border-b p-4">
                <h3 className="text-sm font-semibold text-[#171717]">Folders</h3>
                <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search Folder" 
                            className="pl-8 h-9 rounded-lg bg-white"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-lg bg-[#e0e0e0] text-[#1e1e1e] hover:bg-[#d6d6d6]"
                      onClick={() => setIsCreatingFolder(true)}
                    >
                        <FolderPlus className="h-5 w-5" />
                    </Button>
                </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {isCreatingFolder && (
                  <div className="rounded-lg border border-[#e6e6e6] bg-white p-3">
                    <Input
                      placeholder="New folder name"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      className="mb-2 h-9 rounded-md border border-[#dcdcdc] bg-[#f7f7f7]"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-md text-[#171717] hover:bg-[#f0f0f0]"
                        onClick={() => setIsCreatingFolder(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="rounded-md bg-[#2c2c2c] text-white hover:bg-[#1f1f1f]"
                        onClick={handleCreateFolder}
                      >
                        Create
                      </Button>
                    </div>
                  </div>
                )}
                {filteredFolders.map(folder => (
                  <button
                    key={folder.id}
                    onClick={() => setSelectedFolderId(folder.id)}
                    className={cn(
                      "w-full flex items-center justify-between text-left p-2 rounded-lg text-sm transition-colors",
                      selectedFolderId === folder.id
                        ? "bg-black/5 text-[#171717] font-semibold"
                        : "hover:bg-black/5 text-[#171717]"
                    )}
                  >
                    <div className="flex items-center gap-2">
                        {folder.id === 'unorganized' ? <Unlink className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
                        <span className="truncate">{folder.name}</span>
                    </div>
                    <span className="text-xs font-medium text-[#444444]">
                      {pinsByFolder[folder.id]?.length || 0}
                    </span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Right Section (Pins) */}
              <div className="flex flex-col bg-white">
                <div className="flex items-center justify-between border-b p-4">
                  <h3 className="font-semibold text-[#171717]">{selectedFolder?.name || 'Pins'}</h3>
                  {selectedPinIds.length > 0 && (
                    <Popover>
                        <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="rounded-lg border-[#d4d4d4] text-[#171717] hover:bg-[#f5f5f5]">
                                <Move className="h-4 w-4 mr-2"/>
                                Move To
                            </Button>
                        </PopoverTrigger>
                  <PopoverContent className="w-48 border border-[#e6e6e6] bg-white p-0">
                            {folders.map(f => (
                      <div key={f.id} onClick={() => handleMovePins(f.id)} className="cursor-pointer p-2 hover:bg-[#f5f5f5]">
                                    {f.name}
                                </div>
                            ))}
                        </PopoverContent>
                    </Popover>
                  )}
              </div>
            <ScrollArea className="flex-1">
              <div className="p-4">
                {pinsInSelectedFolder && pinsInSelectedFolder.length > 0 ? (
                    <div>
                 <div className="flex items-center pb-2">
                            <Checkbox 
                                checked={selectedPinIds.length === pinsInSelectedFolder.length && pinsInSelectedFolder.length > 0}
                                onCheckedChange={toggleSelectAll}
                                className="mr-3 rounded-[4px]"
                            />
                  <span className="text-sm text-[#171717]">Select All</span>
                        </div>
                        {pinsInSelectedFolder.map(pin => (
                            <OrganizePinItem 
                                key={pin.id} 
                                pin={pin} 
                                onUpdate={handlePinUpdate}
                                isSelected={selectedPinIds.includes(pin.id)}
                                onSelectionChange={(selected) => handleSelectionChange(pin.id, selected)}
                            />
                        ))}
                    </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center py-20 text-center text-[#444444]">
                    <PinIcon className="mb-4 h-10 w-10 text-[#171717]" />
                    <p className="text-lg font-semibold text-[#171717]">No pins yet</p>
                    <p className="max-w-xs">
                      Pin useful answers or references from your chats to keep them handy for later.
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="justify-end gap-2 border-t bg-white p-4">
          <Button variant="ghost" onClick={onClose} className="rounded-lg text-[#1e1e1e] hover:bg-[#f0f0f0]">
            Cancel
          </Button>
          <Button onClick={handleSaveChanges} className="rounded-lg bg-[#2c2c2c] text-white hover:bg-[#1f1f1f]">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
