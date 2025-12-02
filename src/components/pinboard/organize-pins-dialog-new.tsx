"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Folder, Unlink, MoreVertical, Trash2, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

  const pinsByFolder = useMemo(() => {
    const grouped: Record<string, PinType[]> = {};
    folders.forEach(folder => {
      grouped[folder.id] = [];
    });
    
    initialPins.forEach(pin => {
      const folderId = pin.folderId || "unorganized";
      if (grouped[folderId]) {
        grouped[folderId].push(pin);
      } else {
        grouped["unorganized"].push(pin);
      }
    });

    return grouped;
  }, [initialPins, folders]);

  const unorganizedPins = pinsByFolder["unorganized"] || [];

  const handlePinUpdate = (updatedPin: PinType) => {
    onPinsUpdate(initialPins.map(p => p.id === updatedPin.id ? updatedPin : p));
  };

  const handleRemoveTag = (pinId: string, tagIndex: number) => {
    const pin = initialPins.find(p => p.id === pinId);
    if (pin) {
      const newTags = pin.tags.filter((_, i) => i !== tagIndex);
      handlePinUpdate({ ...pin, tags: newTags });
    }
  };

  const handleDeletePin = (pinId: string) => {
    onPinsUpdate(initialPins.filter(p => p.id !== pinId));
  };

  const handleCreateFolder = async () => {
    if (onCreateFolder) {
      const newFolder = await onCreateFolder("New Folder");
      setFolders([...folders, newFolder]);
    }
  };

  const handleRenameFolder = (folderId: string) => {
    console.log("Rename folder:", folderId);
  };

  const handleDeleteFolder = (folderId: string) => {
    setFolders(folders.filter(f => f.id !== folderId));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        style={{ width: "619px", height: "692px", borderRadius: "10px", border: "1px solid #e6e6e6", paddingLeft: "18px", paddingRight: "18px" }}
        className="flex flex-col bg-white p-0 text-[#171717] gap-0"
      >
        <DialogHeader className="border-b bg-white py-4 text-[#171717]">
          <DialogTitle className="text-left text-[#171717] font-semibold text-base">Organize Pins</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 flex gap-4 overflow-hidden py-4">
          {/* Left Section (Folders) - 332px × 541px */}
          <div className="flex flex-col bg-white" style={{ width: "332px" }}>
            <div className="pb-3">
              <h3 className="text-sm font-semibold text-[#171717]">Folders</h3>
            </div>
            
            <ScrollArea className="flex-1">
              <div className="space-y-1">
                {folders.map(folder => (
                  <div
                    key={folder.id}
                    className="w-full flex items-center justify-between p-2 rounded-lg text-sm hover:bg-[#f5f5f5]"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      {folder.id === 'unorganized' ? <Unlink className="h-4 w-4 text-[#666666]" /> : <Folder className="h-4 w-4 text-[#666666]" />}
                      <span className="text-[#171717]">{folder.name}</span>
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
                            <DropdownMenuItem onClick={() => handleRenameFolder(folder.id)} className="text-[#171717] hover:bg-[#f5f5f5]">
                              <Edit className="mr-2 h-4 w-4" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteFolder(folder.id)} className="text-red-600 hover:bg-[#ffecec]">
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
            
            <div className="pt-4">
              <Button 
                onClick={handleCreateFolder}
                className="w-full bg-[#2c2c2c] text-white hover:bg-[#1f1f1f] rounded-lg"
              >
                New folder
              </Button>
            </div>
          </div>

          {/* Right Section (Unorganized Pins) */}
          <div className="flex-1 flex flex-col bg-white">
            <div className="pb-3">
              <h3 className="text-sm font-semibold text-[#171717]">Unorganised pins</h3>
            </div>
            
            <ScrollArea className="flex-1">
              <div className="space-y-2.5">
                {unorganizedPins.length > 0 ? (
                  unorganizedPins.map(pin => {
                    const chatBoard = chatBoards.find(board => board.id === pin.chatId);
                    return (
                      <PinItem
                        key={pin.id}
                        pin={pin}
                        onUpdatePin={handlePinUpdate}
                        onRemoveTag={handleRemoveTag}
                        onDeletePin={handleDeletePin}
                        chatName={chatBoard?.name}
                      />
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center text-[#9a9a9a]">
                    <p className="text-sm">No unorganized pins</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="justify-end gap-2 border-t bg-white pt-4">
          <Button variant="ghost" onClick={onClose} className="rounded-lg text-[#1e1e1e] hover:bg-[#f0f0f0]">
            Label
          </Button>
          <Button onClick={onClose} className="rounded-lg bg-[#2c2c2c] text-white hover:bg-[#1f1f1f]">
            Label
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
