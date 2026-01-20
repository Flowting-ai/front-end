
'use client';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, MessageSquare, Pin } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Persona {
    id: string;
    name: string;
    title: string;
    description: string;
    avatarUrl: string;
    avatarHint: string;
    tags: string[];
    expertise: string[];
    personality: string[];
    isPinned: boolean;
}

interface PersonaCardProps {
    persona: Persona;
    onDelete: () => void;
    onPinToggle: () => void;
}

export function PersonaCard({ persona, onDelete, onPinToggle }: PersonaCardProps) {
    const displayedExpertise = persona.expertise.slice(0, 3);
    const remainingExpertiseCount = persona.expertise.length - 3;
    
    return (
        <Card className="persona-card flex flex-col rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300">
            <CardContent className="p-4 flex flex-col gap-4 flex-1">
                <header className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                            <AvatarImage src={persona.avatarUrl} alt={persona.name} data-ai-hint={persona.avatarHint} />
                            <AvatarFallback>{persona.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <h3 className="font-bold text-md">{persona.name}</h3>
                            <p className="text-xs text-muted-foreground">{persona.title}</p>
                        </div>
                    </div>
                    <div className="flex items-center">
                        {persona.isPinned && <Pin className="h-4 w-4 text-muted-foreground mr-1" />}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={onPinToggle}>
                                    {persona.isPinned ? "Unpin from top" : "Pin to top"}
                                </DropdownMenuItem>
                                <DropdownMenuItem>Edit</DropdownMenuItem>
                                <DropdownMenuItem>Duplicate</DropdownMenuItem>
                                <DropdownMenuItem onClick={onDelete} className="text-red-500">Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </header>

                <p className="text-sm text-muted-foreground flex-1 min-h-[60px]">{persona.description}</p>

                <div className="flex flex-wrap gap-1.5 min-h-[26px]">
                    {persona.tags.map(tag => (
                         <Badge key={tag} variant="secondary" className="font-normal">{tag}</Badge>
                    ))}
                </div>

                <div>
                    <h4 className="font-semibold text-sm mb-2">Expertise</h4>
                    <div className="flex flex-wrap gap-1.5 min-h-[26px]">
                         {displayedExpertise.map(skill => (
                            <Badge key={skill} variant="outline">{skill}</Badge>
                        ))}
                        {remainingExpertiseCount > 0 && (
                            <Badge variant="outline">+{remainingExpertiseCount}</Badge>
                        )}
                    </div>
                </div>

                 <div>
                    <h4 className="font-semibold text-sm mb-2">Personality</h4>
                    <div className="flex flex-wrap gap-1.5 min-h-[26px]">
                         {persona.personality.map(trait => (
                            <Badge key={trait} variant="outline" className="rounded-full">{trait}</Badge>
                        ))}
                    </div>
                </div>
                
                <div className="mt-auto pt-4">
                    <Button className="w-full rounded-full">
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Start Chat
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
