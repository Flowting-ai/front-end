
"use client";

import { useState, useMemo, useContext } from 'react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronsLeft, Pin, File as FileIcon, Search, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppLayoutContext } from './app-layout';
import { useToast } from "@/hooks/use-toast";
import { PinItem } from '../pinboard/pin-item';
import { Badge } from '../ui/badge';

export interface PinType {
    id: string;
    text: string;
    tags: string[];
    notes: string;
    chatId: string;
    time: Date;
    messageId?: string;
}

interface RightSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  pins: PinType[];
  setPins: React.Dispatch<React.SetStateAction<PinType[]>>;
  chatBoards: any[];
}

type SortOrder = "newest" | "oldest" | "a-z" | "z-a";

export function RightSidebar({
  isCollapsed,
  onToggle,
  pins,
  setPins,
  chatBoards
}: RightSidebarProps) {
    const [activeTab, setActiveTab] = useState("pins");
    const { toast } = useToast();
    const layoutContext = useContext(AppLayoutContext);

    const [searchTerm, setSearchTerm] = useState("");
    const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
    const [filterChat, setFilterChat] = useState("current");
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    
    const allTags = useMemo(() => {
        const tagSet = new Set<string>();
        pins.forEach(pin => {
            pin.tags.forEach(tag => tagSet.add(tag));
        });
        return Array.from(tagSet).sort();
    }, [pins]);

    const toggleTagFilter = (tag: string) => {
        setSelectedTags(prev => 
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        );
    };

    const filteredAndSortedPins = useMemo(() => {
        let processedPins = [...pins];

        // 1. Search filter
        if (searchTerm) {
            processedPins = processedPins.filter(pin => 
                pin.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
                pin.notes.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // 2. Chat filter
        if (filterChat === 'current' && layoutContext?.activeChatId) {
            processedPins = processedPins.filter(pin => pin.chatId === layoutContext.activeChatId);
        }

        // 3. Tag filter
        if (selectedTags.length > 0) {
            processedPins = processedPins.filter(pin => 
                selectedTags.every(tag => pin.tags.includes(tag))
            );
        }

        // 4. Sorting
        processedPins.sort((a, b) => {
            switch (sortOrder) {
                case "newest":
                    return new Date(b.time).getTime() - new Date(a.time).getTime();
                case "oldest":
                    return new Date(a.time).getTime() - new Date(b.time).getTime();
                case "a-z":
                    return a.text.localeCompare(b.text);
                case "z-a":
                    return b.text.localeCompare(a.text);
                default:
                    return 0;
            }
        });

        return processedPins;

    }, [pins, searchTerm, sortOrder, filterChat, selectedTags, layoutContext?.activeChatId]);


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
                className="absolute top-1/2 -translate-y-1/2 -left-4 bg-card border hover:bg-accent z-10 h-8 w-8 rounded-full"
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
                        <div className="flex items-center gap-2 font-semibold">
                            <Pin className="h-5 w-5" />
                            <span>Pinboard</span>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Search pins..." 
                                className="pl-9 rounded-full h-9" 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button 
                                variant={activeTab === 'pins' ? 'secondary' : 'ghost'} 
                                className="flex-1 rounded-full"
                                onClick={() => setActiveTab('pins')}>
                                <Pin className="mr-2 h-4 w-4" /> Pins
                            </Button>
                            <Button 
                                variant={activeTab === 'files' ? 'secondary' : 'ghost'} 
                                className="flex-1 rounded-full"
                                onClick={() => setActiveTab('files')}>
                                <FileIcon className="mr-2 h-4 w-4" /> Files
                            </Button>
                        </div>
                        <div className="flex gap-2">
                            <Select value={sortOrder} onValueChange={(value: SortOrder) => setSortOrder(value)}>
                                <SelectTrigger className="w-full rounded-full text-xs">
                                    <SelectValue placeholder="Sort by" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="newest">Sort by: Newest</SelectItem>
                                    <SelectItem value="oldest">Sort by: Oldest</SelectItem>
                                    <SelectItem value="a-z">Sort by: A-Z</SelectItem>
                                    <SelectItem value="z-a">Sort by: Z-A</SelectItem>
                                </SelectContent>
                            </Select>
                             <Select value={filterChat} onValueChange={setFilterChat}>
                                <SelectTrigger className="w-full rounded-full text-xs">
                                    <SelectValue placeholder="Filter by" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="current">Current Chat</SelectItem>
                                    <SelectItem value="all">All Chats</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {allTags.length > 0 && (
                        <div className="p-4 border-b">
                             <h4 className="text-xs font-semibold text-muted-foreground mb-2">Filter by tags</h4>
                             <div className="flex flex-wrap gap-1.5">
                                {allTags.map(tag => (
                                    <Badge 
                                        key={tag}
                                        variant={selectedTags.includes(tag) ? 'default' : 'secondary'}
                                        onClick={() => toggleTagFilter(tag)}
                                        className="cursor-pointer"
                                    >
                                        {tag}
                                    </Badge>
                                ))}
                             </div>
                        </div>
                    )}

                    <ScrollArea className="flex-1">
                        <div className="p-4 space-y-3">
                            {filteredAndSortedPins.length > 0 ? (
                                filteredAndSortedPins.map(pin => {
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
                    
                    <div className="p-4 border-t">
                        <Button variant="outline" className="w-full rounded-full">
                            <Download className="mr-2 h-4 w-4" />
                            Export Pins
                        </Button>
                    </div>
                </div>
            )}
        </aside>
    );
}

