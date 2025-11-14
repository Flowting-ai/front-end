
'use client';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, MessageSquare } from "lucide-react";

export interface Persona {
    name: string;
    title: string;
    description: string;
    avatarUrl: string;
    avatarHint: string;
    tags: string[];
    expertise: string[];
    personality: string[];
}

interface PersonaCardProps {
    persona: Persona;
}

export function PersonaCard({ persona }: PersonaCardProps) {
    return (
        <Card className="persona-card flex flex-col rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300">
            <CardContent className="p-6 flex flex-col gap-4 flex-1">
                <header className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                            <AvatarImage src={persona.avatarUrl} alt={persona.name} data-ai-hint={persona.avatarHint} />
                            <AvatarFallback>{persona.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <h3 className="font-bold text-lg">{persona.name}</h3>
                            <p className="text-sm text-muted-foreground">{persona.title}</p>
                        </div>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem>Edit</DropdownMenuItem>
                            <DropdownMenuItem>Duplicate</DropdownMenuItem>
                            <DropdownMenuItem className="text-red-500">Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </header>

                <p className="text-sm text-muted-foreground">{persona.description}</p>

                <div className="flex flex-wrap gap-2">
                    {persona.tags.map(tag => (
                         <Badge key={tag} variant="secondary" className="font-normal">{tag}</Badge>
                    ))}
                </div>

                <div>
                    <h4 className="font-semibold text-sm mb-2">Expertise</h4>
                    <div className="flex flex-wrap gap-2">
                         {persona.expertise.map(skill => (
                            <Badge key={skill} variant="outline">{skill}</Badge>
                        ))}
                    </div>
                </div>

                 <div>
                    <h4 className="font-semibold text-sm mb-2">Personality</h4>
                    <div className="flex flex-wrap gap-2">
                         {persona.personality.map(trait => (
                            <Badge key={trait} variant="outline" className="rounded-full">{trait}</Badge>
                        ))}
                    </div>
                </div>
                
                <div className="mt-auto pt-4">
                    <Button className="w-full">
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Start Chat
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
