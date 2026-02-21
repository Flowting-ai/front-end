"use client";

import React, { useState, useMemo, useEffect } from "react";
import { X, Search, Tag, Folder, ChevronDown } from "lucide-react";
import { workflowAPI } from "./workflow-api";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Pin {
  id: string;
  name: string;
  title?: string;
  text?: string;
  content?: string;
  tags?: string[];
  folderId?: string;
  folderName?: string;
  chatId?: string;
  created_at?: string;
  pinnedDate?: string;
}

interface SelectPinsDialogProps {
  allPins: Pin[];
  selectedPinIds?: string[];
  selectedFolder?: { id: string; name: string; pinIds: string[] };
  onClose: () => void;
  onAddPins: (pinIds: string[]) => void;
  onAddFolder: (folder: { id: string; name: string; pinIds: string[] }) => void;
}

function formatDate(dateString?: string): string {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleString("en-US", { month: "short" });
    return `${day}${getOrdinalSuffix(day)} ${month}`;
  } catch {
    return "";
  }
}

function getOrdinalSuffix(num: number): string {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}

export function SelectPinsDialog({
  allPins: propPins,
  selectedPinIds = [],
  selectedFolder,
  onClose,
  onAddPins,
  onAddFolder,
}: SelectPinsDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [localSelectedPinIds, setLocalSelectedPinIds] = useState<string[]>(selectedPinIds);
  const [localSelectedFolder, setLocalSelectedFolder] = useState<{ id: string; name: string; pinIds: string[] } | undefined>(selectedFolder);
  const [pins, setPins] = useState<Pin[]>(propPins);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const [folderSearch, setFolderSearch] = useState("");
  const [mode, setMode] = useState<'pins' | 'folder'>(selectedFolder ? 'folder' : 'pins');
  const [folderPinSelection, setFolderPinSelection] = useState<string[]>([]);
  const MAX_PINS = 10;

  useEffect(() => {
    // Always try to fetch fresh data when dialog opens
    const fetchPinData = async () => {
      setIsLoading(true);
      
      // Use provided pins if available
      if (propPins.length > 0) {
        console.log('Using provided pins:', propPins);
        setPins(propPins);
        setIsLoading(false);
        return;
      }

      // Check sessionStorage cache
      const cached = sessionStorage.getItem("allPins");
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as Pin[];
          console.log('Using cached pins:', parsed);
          if (parsed.length > 0) {
            setPins(parsed);
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.error('Failed to parse cached pins:', e);
        }
      }

      // Fetch from API
      try {
        console.log('Fetching pins from API...');
        const data = await workflowAPI.fetchPins();
        console.log('Fetched pins:', data);
        setPins(data);
        if (data.length > 0) {
          sessionStorage.setItem("allPins", JSON.stringify(data));
        }
      } catch (error) {
        console.error("Failed to fetch pins:", error);
        setPins([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPinData();
  }, [propPins]);

  // Get all unique tags from pins
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    pins.forEach((pin) => {
      if (pin.tags) {
        pin.tags.forEach((tag) => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [pins]);

  // Get all unique folders from pins
  const allFolders = useMemo(() => {
    const folderMap = new Map<string, string>();
    pins.forEach((pin) => {
      if (pin.folderId && pin.folderName) {
        folderMap.set(pin.folderId, pin.folderName);
      }
    });
    const folders = Array.from(folderMap.entries()).map(([id, name]) => ({
      id,
      name,
    }));
    return folders.sort((a, b) => a.name.localeCompare(b.name));
  }, [pins]);

  // Filter tags based on search
  const filteredTags = useMemo(() => {
    if (!tagSearch) return allTags.slice(0, 5);
    const query = tagSearch.toLowerCase();
    return allTags
      .filter((tag) => tag.toLowerCase().includes(query))
      .slice(0, 5);
  }, [allTags, tagSearch]);

  // Filter folders based on search
  const filteredFolders = useMemo(() => {
    if (!folderSearch) return allFolders.slice(0, 5);
    const query = folderSearch.toLowerCase();
    return allFolders
      .filter((folder) => folder.name.toLowerCase().includes(query))
      .slice(0, 5);
  }, [allFolders, folderSearch]);

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleFolderToggle = (folderId: string) => {
    setSelectedFolders((prev) =>
      prev.includes(folderId)
        ? prev.filter((f) => f !== folderId)
        : [...prev, folderId]
    );
  };

  const filteredPins = useMemo(() => {
    let result = pins;

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((pin) => {
        const nameMatch = pin.name?.toLowerCase().includes(query);
        const textMatch = pin.text?.toLowerCase().includes(query);
        const contentMatch = pin.content?.toLowerCase().includes(query);
        return nameMatch || textMatch || contentMatch;
      });
    }

    // Filter by tags
    if (selectedTags.length > 0) {
      result = result.filter((pin) =>
        selectedTags.every((tag) => pin.tags?.includes(tag))
      );
    }

    // Filter by folders
    if (selectedFolders.length > 0) {
      result = result.filter(
        (pin) => pin.folderId && selectedFolders.includes(pin.folderId)
      );
    }

    return result;
  }, [pins, searchQuery, selectedTags, selectedFolders]);

  const handleSelectPin = (pinId: string) => {
    if (mode === 'folder') {
      // In folder mode with >10 pins, handle checkbox selection
      if (folderPinSelection.includes(pinId)) {
        setFolderPinSelection(prev => prev.filter(id => id !== pinId));
      } else {
        if (folderPinSelection.length < MAX_PINS) {
          setFolderPinSelection(prev => [...prev, pinId]);
        }
      }
    } else {
      // In pins mode, handle checkbox selection
      if (localSelectedPinIds.includes(pinId)) {
        setLocalSelectedPinIds(prev => prev.filter(id => id !== pinId));
      } else {
        if (localSelectedPinIds.length < MAX_PINS) {
          setLocalSelectedPinIds(prev => [...prev, pinId]);
        }
      }
    }
  };

  const handleSelectFolder = (folderId: string, folderName: string) => {
    const folderPins = pins.filter(pin => pin.folderId === folderId);
    
    if (folderPins.length === 0) {
      return; // No pins in folder
    }
    
    if (folderPins.length <= MAX_PINS) {
      // Auto-attach folder with all pins
      const folderData = {
        id: folderId,
        name: folderName,
        pinIds: folderPins.map(p => p.id)
      };
      setLocalSelectedFolder(folderData);
      setMode('folder');
      setFolderPinSelection([]);
    } else {
      // Show pin selection for this folder
      setLocalSelectedFolder({
        id: folderId,
        name: folderName,
        pinIds: [] // Will be filled by user selection
      });
      setMode('folder');
      setFolderPinSelection([]);
      // Filter to show only this folder's pins
      setSelectedFolders([folderId]);
    }
  };

  const handleClearFolder = () => {
    setLocalSelectedFolder(undefined);
    setMode('pins');
    setFolderPinSelection([]);
    setSelectedFolders([]);
  };

  const handleAdd = () => {
    if (mode === 'folder' && localSelectedFolder) {
      if (localSelectedFolder.pinIds.length > 0) {
        // Folder was auto-attached
        onAddFolder(localSelectedFolder);
      } else {
        // User selected pins from large folder
        if (folderPinSelection.length > 0) {
          onAddFolder({
            ...localSelectedFolder,
            pinIds: folderPinSelection
          });
        }
      }
    } else {
      // Pins mode
      if (localSelectedPinIds.length > 0) {
        onAddPins(localSelectedPinIds);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-white rounded-[10px] border border-[#E5E5E5] shadow-lg flex flex-col gap-3 p-2"
        style={{
          width: "420px",
          maxHeight: "600px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-2">
          <h2 className="font-clash font-normal text-[24px] text-[#0A0A0A]">
            {mode === 'folder' && localSelectedFolder ? `Select from ${localSelectedFolder.name}` : 'Select Pins or Folder'}
          </h2>
          <button
            onClick={onClose}
            className="cursor-pointer text-[#757575] hover:text-black transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Folder Selection Section */}
        {mode === 'pins' && !localSelectedFolder && (
          <div className="px-2">
            <label className="text-xs font-medium text-[#0A0A0A] mb-1 block">
              Attach Folder (Optional)
            </label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-8 border-[#E5E5E5] text-[#0A0A0A] text-xs hover:bg-[#F5F5F5] justify-start"
                >
                  <Folder className="h-3 w-3 mr-2" />
                  Choose a folder...
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[380px]" align="start">
                <div className="p-2">
                  <input
                    type="text"
                    placeholder="Search folders..."
                    value={folderSearch}
                    onChange={(e) => setFolderSearch(e.target.value)}
                    className="w-full h-7 px-2 rounded border border-[#E5E5E5] text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <ScrollArea className="max-h-48">
                  {filteredFolders.length === 0 ? (
                    <div className="p-2 text-xs text-[#757575] text-center">
                      No folders found
                    </div>
                  ) : (
                    filteredFolders.map((folder) => {
                      const folderPinCount = pins.filter(p => p.folderId === folder.id).length;
                      return (
                        <div
                          key={folder.id}
                          className="flex items-center justify-between px-2 py-1.5 hover:bg-[#F5F5F5] cursor-pointer"
                          onClick={() => handleSelectFolder(folder.id, folder.name)}
                        >
                          <div className="flex items-center gap-2">
                            <Folder className="h-3 w-3 text-[#757575]" />
                            <span className="text-xs text-[#0A0A0A]">{folder.name}</span>
                          </div>
                          <Badge variant="secondary" className="text-[10px] h-4 px-1">
                            {folderPinCount} {folderPinCount === 1 ? 'pin' : 'pins'}
                          </Badge>
                        </div>
                      );
                    })
                  )}
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Selected Folder Display */}
        {localSelectedFolder && (
          <div className="px-2">
            <div className="bg-[#E5F2FF] px-3 py-2 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Folder className="h-4 w-4 text-[#3C6CFF]" />
                <div>
                  <p className="text-xs font-medium text-[#0A0A0A]">{localSelectedFolder.name}</p>
                  {localSelectedFolder.pinIds.length > 0 ? (
                    <p className="text-[10px] text-[#757575]">
                      {localSelectedFolder.pinIds.length} pins attached
                    </p>
                  ) : (
                    <p className="text-[10px] text-[#757575]">
                      Select up to {MAX_PINS} pins below
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handleClearFolder}
                className="cursor-pointer text-[#757575] hover:text-red-600 transition-colors"
                aria-label="Remove folder"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Search Bar */}
        {mode === 'pins' && (
          <div className="relative px-2">
            <Search className="absolute left-4 top-2.5 h-4 w-4 text-[#9F9F9F]" />
            <input
              type="text"
              placeholder="Search for your pins..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-9 pr-3 py-1.5 rounded-lg border border-[#E5E5E5] font-geist font-normal text-sm text-[#0A0A0A] placeholder-[#737373] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>
        )}

        {/* Filter Section */}
        {mode === 'pins' && (
          <div className="flex items-center gap-2 px-2">
            {/* Tag Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 border-[#E5E5E5] text-[#0A0A0A] text-xs hover:bg-[#F5F5F5]"
                >
                  <Tag className="h-3 w-3 mr-1" />
                  Tags
                  {selectedTags.length > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-1 h-4 min-w-4 px-1 bg-black text-white text-xs"
                    >
                      {selectedTags.length}
                    </Badge>
                  )}
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="start">
                <div className="p-2">
                  <input
                    type="text"
                    placeholder="Search tags..."
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    className="w-full h-7 px-2 rounded border border-[#E5E5E5] text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <ScrollArea className="max-h-48">
                  {filteredTags.length === 0 ? (
                    <div className="p-2 text-xs text-[#757575] text-center">
                      No tags found
                    </div>
                  ) : (
                    filteredTags.map((tag) => (
                      <div
                        key={tag}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-[#F5F5F5] cursor-pointer"
                        onClick={() => handleTagToggle(tag)}
                      >
                        <Checkbox
                          checked={selectedTags.includes(tag)}
                          onCheckedChange={() => handleTagToggle(tag)}
                        />
                        <span className="text-xs text-[#0A0A0A]">{tag}</span>
                      </div>
                    ))
                  )}
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Selection Counter */}
            <div className="ml-auto text-xs text-[#757575]">
              {localSelectedPinIds.length}/{MAX_PINS} selected
            </div>
          </div>
        )}

        {/* Selected Filters */}
        {mode === 'pins' && selectedTags.length > 0 && (
          <div className="flex flex-wrap gap-1 px-2">
            {selectedTags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="bg-[#F5F5F5] text-[#0A0A0A] text-xs px-2 py-0.5 cursor-pointer hover:bg-[#E5E5E5]"
                onClick={() => handleTagToggle(tag)}
              >
                {tag}
                <X className="h-2 w-2 ml-1" />
              </Badge>
            ))}
          </div>
        )}

        {/* Pins List */}
        <div className="flex-1 overflow-y-auto px-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-sm text-[#757575]">Loading pins...</div>
            </div>
          ) : filteredPins.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[#757575] text-sm">
              No pins found
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {filteredPins.map((pin) => {
                const isChecked = mode === 'folder' 
                  ? folderPinSelection.includes(pin.id)
                  : localSelectedPinIds.includes(pin.id);
                const isDisabled = mode === 'folder'
                  ? !isChecked && folderPinSelection.length >= MAX_PINS
                  : !isChecked && localSelectedPinIds.length >= MAX_PINS;
                
                return (
                  <div
                    key={pin.id}
                    className={`flex flex-col gap-1 px-2 py-1.5 rounded-lg hover:bg-[#F5F5F5] transition-colors duration-300 group cursor-pointer ${
                      isDisabled ? 'opacity-50' : ''
                    }`}
                    onClick={() => !isDisabled && handleSelectPin(pin.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => !isDisabled && handleSelectPin(pin.id)}
                            disabled={isDisabled}
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0"
                          />
                          <label className="hidden text-sm font-medium text-[#0A0A0A] truncate cursor-pointer">
                            {pin.title || pin.name}
                          </label>
                        </div>
                      </div>
                      {pin.pinnedDate && (
                        <span className="text-xs text-[#757575] ml-2 whitespace-nowrap shrink-0 hidden group-hover:inline">
                          {formatDate(pin.pinnedDate)}
                        </span>
                      )}
                    </div>
                    {pin.tags && pin.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 ml-6 mt-0.5">
                        {pin.tags.slice(0, 3).map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="bg-[#F5F5F5] text-[#757575] text-[10px] px-1.5 py-0 h-4"
                          >
                            {tag}
                          </Badge>
                        ))}
                        {pin.tags.length > 3 && (
                          <Badge
                            variant="secondary"
                            className="bg-[#F5F5F5] text-[#757575] text-[10px] px-1.5 py-0 h-4"
                          >
                            +{pin.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer - Cancel and Add Buttons */}
        <div className="flex items-center justify-end gap-2 px-2 py-1 border-t border-[#E5E5E5]">
          <button
            onClick={onClose}
            className="cursor-pointer h-8 rounded-lg px-4 bg-white border border-[#D4D4D4] text-sm font-medium text-[#0A0A0A] hover:bg-[#F5F5F5] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={
              mode === 'folder' 
                ? (localSelectedFolder?.pinIds.length === 0 && folderPinSelection.length === 0)
                : localSelectedPinIds.length === 0
            }
            className="cursor-pointer h-8 rounded-lg px-4 bg-[#2C2C2C] text-white text-sm font-medium hover:bg-[#1F1F1F] transition-colors disabled:bg-[#D4D4D4] disabled:text-[#757575] disabled:cursor-not-allowed"
          >
            {mode === 'folder' ? 'Attach Folder' : 'Attach Pins'}
          </button>
        </div>
      </div>
    </div>
  );
}
