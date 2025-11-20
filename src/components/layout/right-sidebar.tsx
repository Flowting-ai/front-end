
"use client";

import { useState, useMemo, useContext, type ReactNode } from 'react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronsLeft, Pin, File as FileIcon, Search, Download, Folder, Plus, MoreHorizontal, Trash2, Pencil, Check, X, FolderPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppLayoutContext, type ChatBoard } from './app-layout';
import { useToast } from "@/hooks/use-toast";
import { PinItem } from '../pinboard/pin-item';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from '../ui/badge';

export interface PinType {
    id: string;
    title: string;
    text: string;
    tags: string[];
    notes: string;
    chatId: string;
    time: Date;
    messageId?: string;
    folderId?: string | null;
    isArchived: boolean;
}

export interface Folder {
    id: string;
    name:string;
    createdAt: Date;
}

const mockFolders: Folder[] = [
    { id: 'unorganized', name: 'Unorganized Pins', createdAt: new Date() },
    { id: 'research', name: 'Research', createdAt: new Date() },
];

const initialPins: PinType[] = [
    { id: '1', title: 'Initial Research Findings', text: 'The market for AI-driven collaboration tools is expanding rapidly. Key competitors are focusing on integration capabilities.', tags: ['market-research', 'AI'], notes: 'Follow up on competitor APIs.', chatId: '1', time: new Date(Date.now() - 86400000), folderId: 'research', isArchived: false },
    { id: '2', title: 'UI/UX Feedback', text: 'Users report that the onboarding process could be more intuitive. Suggest adding a guided tour.', tags: ['ux', 'feedback'], notes: '', chatId: '1', time: new Date(Date.now() - 172800000), folderId: null, isArchived: false },
    { id: '3', title: 'API Design Concepts', text: 'Initial thoughts on the REST API structure for version 2. Focus on clear versioning and webhook support.', tags: ['api', 'dev'], notes: 'Draft OpenAPI spec.', chatId: '2', time: new Date(Date.now() - 259200000), folderId: 'research', isArchived: false },
    { id: '4', title: 'Marketing Copy Ideas', text: 'Headline: "FlowtingAI: Where your conversations become workflows." Sub-headline: "Automate, analyze, and create with the power of AI."', tags: ['marketing'], notes: '', chatId: '1', time: new Date(), folderId: null, isArchived: false },
];


function OrganizePinsDialog({ open, onOpenChange, folders, setFolders, pins, setPins }: { 
    open: boolean, 
    onOpenChange: (open: boolean) => void,
    folders: Folder[],
    setFolders: React.Dispatch<React.SetStateAction<Folder[]>>,
    pins: PinType[],
    setPins: React.Dispatch<React.SetStateAction<PinType[]>>
}) {
    const [selectedFolderId, setSelectedFolderId] = useState<string>('unorganized');
    const [folderSearch, setFolderSearch] = useState('');
    const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
    const [renamingText, setRenamingText] = useState('');
    const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null);
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    const filteredFolders = folders.filter(f => f.name.toLowerCase().includes(folderSearch.toLowerCase()));
    
    const pinsInSelectedFolder = pins.filter(p => (p.folderId || 'unorganized') === selectedFolderId);

    const getPinCount = (folderId: string) => {
        return pins.filter(p => (p.folderId || 'unorganized') === folderId).length;
    };

    const handleSaveRename = () => {
        if (!renamingFolderId) return;
        setFolders(folders.map(f => f.id === renamingFolderId ? { ...f, name: renamingText } : f));
        setRenamingFolderId(null);
    };

    const handleSaveNewFolder = () => {
        if (!newFolderName.trim()) return;
        const newFolder: Folder = {
            id: Date.now().toString(),
            name: newFolderName.trim(),
            createdAt: new Date(),
        };
        setFolders([...folders, newFolder]);
        setIsCreatingFolder(false);
        setNewFolderName('');
    };
    
    const confirmDeleteFolder = () => {
        if (!deletingFolder || deletingFolder.id === 'unorganized') return;
        setFolders(folders.filter(f => f.id !== deletingFolder.id));
        setPins(pins.map(p => p.folderId === deletingFolder.id ? { ...p, folderId: 'unorganized' } : p));
        setDeletingFolder(null);
    };


    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[70vh] flex flex-col p-0 gap-0">
                <DialogHeader className="p-4 border-b">
                    <DialogTitle>Organize Pins</DialogTitle>
                </DialogHeader>
                <div className="flex-1 grid grid-cols-3 overflow-hidden">
                    <div className="col-span-1 border-r bg-muted/30 flex flex-col">
                        <div className="p-3 border-b">
                             <Input placeholder="Search folders..." value={folderSearch} onChange={e => setFolderSearch(e.target.value)} className="bg-background"/>
                        </div>
                        <ScrollArea className="flex-1">
                            <div className="p-2 space-y-1">
                            {filteredFolders.map(folder => (
                                <div key={folder.id}
                                    className={cn("flex items-center justify-between p-2 rounded-md cursor-pointer", selectedFolderId === folder.id ? 'bg-primary/10 text-primary' : 'hover:bg-accent')}
                                    onClick={() => setSelectedFolderId(folder.id)}
                                >
                                    {renamingFolderId === folder.id ? (
                                        <div className="flex-1 flex gap-1">
                                            <Input value={renamingText} onChange={e => setRenamingText(e.target.value)} className="h-7"/>
                                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveRename}><Check className="h-4 w-4"/></Button>
                                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setRenamingFolderId(null)}><X className="h-4 w-4"/></Button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex-1 flex items-center gap-2 overflow-hidden">
                                                <Folder className="h-4 w-4 shrink-0"/>
                                                <span className="truncate font-medium text-sm">{folder.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-muted-foreground">{getPinCount(folder.id)}</span>
                                                 {folder.id !== 'unorganized' && (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-6 w-6"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger>
                                                        <DropdownMenuContent>
                                                            <DropdownMenuItem onSelect={() => { setRenamingFolderId(folder.id); setRenamingText(folder.name); }}><Pencil className="mr-2 h-4 w-4"/>Rename</DropdownMenuItem>
                                                            <DropdownMenuItem onSelect={() => setDeletingFolder(folder)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4"/>Delete</DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                 )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                             {isCreatingFolder ? (
                                <div className="p-2 flex gap-1">
                                     <Input placeholder="New folder name..." value={newFolderName} onChange={e => setNewFolderName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSaveNewFolder()} className="h-8"/>
                                     <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSaveNewFolder}><Check className="h-4 w-4"/></Button>
                                     <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsCreatingFolder(false)}><X className="h-4 w-4"/></Button>
                                </div>
                             ) : (
                                <Button variant="ghost" className="w-full justify-start mt-2" onClick={() => setIsCreatingFolder(true)}><FolderPlus className="mr-2 h-4 w-4"/>Create New Folder</Button>
                             )}
                            </div>
                        </ScrollArea>
                    </div>
                    <div className="col-span-2">
                        <ScrollArea className="h-full">
                            <div className="p-4 space-y-3">
                                {pinsInSelectedFolder.length > 0 ? pinsInSelectedFolder.map(pin => (
                                    <PinItem key={pin.id} pin={pin} onUpdatePin={() => {}} onRemoveTag={() => {}} />
                                )) : (
                                     <div className="text-center text-muted-foreground py-16">
                                        <div className="inline-block p-3 bg-muted rounded-full border mb-4">
                                           <Pin className="h-6 w-6" />
                                        </div>
                                        <p className="font-semibold">No pins in this folder</p>
                                        <p className="text-sm">Pins you create will appear here.</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
                <DialogFooter className="p-4 border-t">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={() => onOpenChange(false)}>Done</Button>
                </DialogFooter>
                 <AlertDialog open={!!deletingFolder} onOpenChange={(open) => !open && setDeletingFolder(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure you want to delete "{deletingFolder?.name}"?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. All pins inside this folder will be moved to "Unorganized Pins".
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setDeletingFolder(null)}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmDeleteFolder}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </DialogContent>
        </Dialog>
    )
}

interface RightSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  pins: PinType[];
  setPins: React.Dispatch<React.SetStateAction<PinType[]>>;
  chatBoards: ChatBoard[];
}

export function RightSidebar({
  isCollapsed,
  onToggle,
  pins: allPins,
  setPins: setAllPins,
  chatBoards
}: RightSidebarProps) {
    const { toast } = useToast();
    const layoutContext = useContext(AppLayoutContext);
    const [isOrganizeDialogOpen, setIsOrganizeDialogOpen] = useState(false);
    const [folders, setFolders] = useState<Folder[]>(mockFolders);
    const [pins, setPins] = useState<PinType[]>(initialPins);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('newest');
    const [tagSearchTerm, setTagSearchTerm] = useState('');

    const filteredPins = useMemo(() => {
        let processedPins = [...pins];

        if (searchTerm) {
            processedPins = processedPins.filter(pin => 
                pin.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
                pin.notes.toLowerCase().includes(searchTerm.toLowerCase()) ||
                pin.title.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (tagSearchTerm && filterType === 'filter-by-tag') {
            processedPins = processedPins.filter(pin => 
                pin.tags.some(tag => tag.toLowerCase().includes(tagSearchTerm.toLowerCase()))
            );
        }

        switch (filterType) {
            case 'newest':
                processedPins.sort((a, b) => b.time.getTime() - a.time.getTime());
                break;
            case 'oldest':
                processedPins.sort((a, b) => a.time.getTime() - b.time.getTime());
                break;
            case 'a-z':
                processedPins.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'z-a':
                processedPins.sort((a, b) => b.title.localeCompare(a.title));
                break;
            case 'current-chat':
                if (layoutContext?.activeChatId) {
                    processedPins = processedPins.filter(pin => pin.chatId === layoutContext.activeChatId);
                }
                break;
        }

        return processedPins;
    }, [pins, searchTerm, filterType, tagSearchTerm, layoutContext?.activeChatId]);

    const onUpdatePin = (updatedPin: PinType) => {
        setPins(pins.map(p => p.id === updatedPin.id ? updatedPin : p));
    };

    const onRemoveTag = (pinId: string, tagIndex: number) => {
        const updatedPins = pins.map(p => {
            if (p.id === pinId) {
                const newTags = [...p.tags];
                newTags.splice(tagIndex, 1);
                return { ...p, tags: newTags };
            }
            return p;
        });
        setPins(updatedPins);
    };

    return (
        <aside
        className={cn(
            "hidden lg:flex flex-col border-l bg-card/90 backdrop-blur-sm transition-all duration-300 ease-in-out relative shadow-[-12px_0_30px_rgba(15,23,42,0.03)]",
            isCollapsed ? "w-[58px]" : "w-80"
        )}
        >
            <Button
                variant="ghost"
                size="icon"
                onClick={onToggle}
                className={cn(
                    "absolute top-1/2 -translate-y-1/2 -left-4 bg-card border hover:bg-accent z-10 h-8 w-8 rounded-full",
                    isCollapsed && "hidden"
                )}
            >
                <ChevronsLeft
                className={cn("h-4 w-4 transition-transform", !isCollapsed && "rotate-180")}
                />
            </Button>
            
            {isCollapsed ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Pin className="h-5 w-5" />
                    Pins
                </div>
            ) : (
                <div className="flex flex-col h-full">
                    <div className="p-4 space-y-4 border-b">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold flex items-center gap-2"><Pin className="h-4 w-4" />Pinboard</h3>
                             <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggle}><X className="h-4 w-4" /></Button>
                        </div>
                        <Button variant="secondary" className="w-full text-muted-foreground" onClick={() => setIsOrganizeDialogOpen(true)}>
                            <Folder className="mr-2 h-4 w-4" />
                            Organize Pins
                        </Button>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Search pins..." 
                                className="pl-9 rounded-[30px] h-9" 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                         <div className="flex flex-col gap-2">
                            <Select value={filterType} onValueChange={setFilterType}>
                                <SelectTrigger className="w-full rounded-[30px] text-xs">
                                    <SelectValue placeholder="Sort & Filter" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="newest">Sort by: Newest</SelectItem>
                                    <SelectItem value="oldest">Sort by: Oldest</SelectItem>
                                    <SelectItem value="a-z">Sort by: A-Z</SelectItem>
                                    <SelectItem value="z-a">Sort by: Z-A</SelectItem>
                                    <SelectItem value="current-chat">Filter: Current Chat</SelectItem>
                                    <SelectItem value="filter-by-tag">Filter: by Tag</SelectItem>
                                </SelectContent>
                            </Select>
                            {filterType === 'filter-by-tag' && (
                                <Input
                                    placeholder="Type a tag..."
                                    className="rounded-[30px] h-9 text-xs"
                                    value={tagSearchTerm}
                                    onChange={(e) => setTagSearchTerm(e.target.value)}
                                />
                            )}
                        </div>
                    </div>

                    <ScrollArea className="flex-1">
                        <div className="p-4 space-y-3">
                            {filteredPins.length > 0 ? (
                                filteredPins.map(pin => {
                                    const chat = chatBoards.find(c => c.id === pin.chatId);
                                    return (
                                        <PinItem 
                                            key={pin.id} 
                                            pin={pin}
                                            onUpdatePin={onUpdatePin}
                                            onRemoveTag={onRemoveTag}
                                            chatName={chat?.name}
                                        />
                                    );
                                })
                            ) : (
                                <div className="text-center text-muted-foreground py-16">
                                    <div className="inline-block p-3 bg-muted rounded-full border mb-4">
                                       <Pin className="h-6 w-6" />
                                    </div>
                                    <p className="font-semibold">No pins found</p>
                                    <p className="text-sm">Try adjusting your search or filters.</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            )}
             <OrganizePinsDialog open={isOrganizeDialogOpen} onOpenChange={setIsOrganizeDialogOpen} folders={folders} setFolders={setFolders} pins={pins} setPins={setPins} />
        </aside>
    );
}
