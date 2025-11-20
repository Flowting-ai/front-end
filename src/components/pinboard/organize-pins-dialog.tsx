
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
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, FolderPlus, Pin as PinIcon, Folder, Unlink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PinType } from "../layout/right-sidebar";

interface Folder {
  id: string;
  name: string;
}

interface OrganizePinsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  pins: PinType[];
}

const initialFolders: Folder[] = [
  { id: "unorganized", name: "Unorganized Pins" },
  { id: "research", name: "Research" },
];

export function OrganizePinsDialog({ isOpen, onClose, pins }: OrganizePinsDialogProps) {
  const [folders, setFolders] = useState<Folder[]>(initialFolders);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("unorganized");
  const [searchTerm, setSearchTerm] = useState("");

  const pinsByFolder = useMemo(() => {
    const grouped: Record<string, PinType[]> = {};
    folders.forEach(folder => {
        grouped[folder.id] = [];
    });
    
    pins.forEach(pin => {
      const folderId = pin.folderId || "unorganized";
      if (!grouped[folderId]) {
        grouped[folderId] = [];
      }
      grouped[folderId].push(pin);
    });

    return grouped;

  }, [pins, folders]);


  const filteredFolders = folders.filter(folder =>
    folder.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedFolder = folders.find(f => f.id === selectedFolderId);
  const pinsInSelectedFolder = selectedFolderId ? pinsByFolder[selectedFolderId] : [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] p-0 flex flex-col" style={{ borderRadius: '1rem' }}>
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="text-left">Organize Pins</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 overflow-hidden">
          {/* Left Section (Folders) */}
          <div className="col-span-1 bg-[#F5F5F5] dark:bg-muted/30 flex flex-col border-r overflow-y-auto">
            <div className="p-4 space-y-3 border-b">
                <h3 className="text-sm font-semibold text-muted-foreground">Folders</h3>
                <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search Folder" 
                            className="pl-8 h-9 rounded-md bg-white"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button variant="ghost" size="icon" className="h-9 w-9" style={{ color: '#2C2C2C' }}>
                        <FolderPlus className="h-5 w-5" />
                    </Button>
                </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {filteredFolders.map(folder => (
                  <button
                    key={folder.id}
                    onClick={() => setSelectedFolderId(folder.id)}
                    className={cn(
                      "w-full flex items-center justify-between text-left p-2 rounded-md text-sm transition-colors",
                      selectedFolderId === folder.id
                        ? "bg-primary/10 text-primary font-semibold"
                        : "hover:bg-black/5 dark:hover:bg-white/5"
                    )}
                  >
                    <div className="flex items-center gap-2">
                        {folder.id === 'unorganized' ? <Unlink className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
                        <span className="truncate">{folder.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground font-medium">
                      {pinsByFolder[folder.id]?.length || 0}
                    </span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Right Section (Pins) */}
          <div className="col-span-2 flex flex-col bg-white dark:bg-background">
              <div className="p-4 border-b">
                  <h3 className="font-semibold">{selectedFolder?.name || 'Pins'}</h3>
              </div>
            <ScrollArea className="flex-1">
              <div className="p-4">
                {pinsInSelectedFolder && pinsInSelectedFolder.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4">
                        {pinsInSelectedFolder.map(pin => (
                            <div key={pin.id} className="p-3 border rounded-lg text-sm text-muted-foreground">{pin.text}</div>
                        ))}
                    </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-20">
                    <PinIcon className="w-10 h-10 mb-4" />
                    <p className="font-semibold text-lg text-foreground">No pins yet</p>
                    <p className="max-w-xs">
                      Pin useful answers or references from your chats to keep them handy for later.
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="p-4 border-t justify-end">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onClose} style={{ backgroundColor: '#2C2C2C', color: 'white' }}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
