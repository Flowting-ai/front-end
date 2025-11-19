
'use client';

import { useState } from "react";
import Link from 'next/link';
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus } from "lucide-react";
import { PersonaCard } from "@/components/personas/persona-card";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import type { Persona } from "@/components/personas/persona-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { useToast } from "@/hooks/use-toast";

const initialPersonas: Persona[] = [
    {
      id: '1',
      name: 'Elena',
      title: 'UX Advisor',
      description: 'Senior product manager with 10 years of UX research experience, focusing on user-centric design and data-driven improvements.',
      avatarUrl: PlaceHolderImages.find(p => p.id === 'asha-avatar')?.imageUrl ?? '',
      avatarHint: PlaceHolderImages.find(p => p.id === 'asha-avatar')?.imageHint ?? '',
      tags: ['Empathetic', 'Temp: 2.1'],
      expertise: ['UX Research', 'Product Design', 'User Testing', 'Data Analysis', 'Figma'],
      personality: ['Patient', 'Analytical', 'Creative'],
      isPinned: true,
    },
    {
      id: '2',
      name: 'Marcus',
      title: 'Developer Mentor',
      description: 'Full-stack developer specializing in modern web technologies and building scalable, maintainable applications.',
      avatarUrl: PlaceHolderImages.find(p => p.id === 'codementor-avatar')?.imageUrl ?? '',
      avatarHint: PlaceHolderImages.find(p => p.id === 'codementor-avatar')?.imageHint ?? '',
      tags: ['Technical', 'Temp: 2.1'],
      expertise: ['JavaScript', 'React', 'Node.js', 'Go'],
      personality: ['Decisive', 'Patient', 'Analytical'],
      isPinned: false,
    },
    {
      id: '3',
      name: 'Chloe',
      title: 'Creative Coach',
      description: 'Award-winning creative director with expertise in branding, storytelling, and creating impactful marketing campaigns.',
      avatarUrl: PlaceHolderImages.find(p => p.id === 'luna-avatar')?.imageUrl ?? '',
      avatarHint: PlaceHolderImages.find(p => p.id === 'luna-avatar')?.imageHint ?? '',
      tags: ['Witty', 'Temp: 2.1'],
      expertise: ['Branding', 'Storytelling', 'Design', 'Copywriting'],
      personality: ['Creative', 'Humorous', 'Decisive'],
      isPinned: false,
    },
     {
      id: '4',
      name: 'Aria',
      title: 'Data Scientist',
      description: 'Data scientist with a knack for finding hidden patterns and building predictive models for business intelligence.',
      avatarUrl: PlaceHolderImages.find(p => p.id === 'asha-avatar')?.imageUrl ?? '',
      avatarHint: PlaceHolderImages.find(p => p.id === 'asha-avatar')?.imageHint ?? '',
      tags: ['Analytical', 'Temp: 0.5'],
      expertise: ['Python', 'Machine Learning', 'SQL', 'Tableau'],
      personality: ['Detail-oriented', 'Inquisitive', 'Systematic'],
      isPinned: false,
    },
    {
      id: '5',
      name: 'Devin',
      title: 'DevOps Engineer',
      description: 'Full-stack developer specializing in modern web technologies, CI/CD pipelines, and cloud infrastructure.',
      avatarUrl: PlaceHolderImages.find(p => p.id === 'codementor-avatar')?.imageUrl ?? '',
      avatarHint: PlaceHolderImages.find(p => p.id === 'codementor-avatar')?.imageHint ?? '',
      tags: ['Technical', 'Temp: 1.5'],
      expertise: ['JavaScript', 'React', 'Node.js', 'Python', 'DevOps', 'AWS'],
      personality: ['Decisive', 'Patient', 'Analytical'],
      isPinned: false,
    },
    {
      id: '6',
      name: 'Isla',
      title: 'Marketing Strategist',
      description: 'Award-winning creative director with expertise in branding and storytelling, skilled in digital marketing and SEO.',
      avatarUrl: PlaceHolderImages.find(p => p.id === 'luna-avatar')?.imageUrl ?? '',
      avatarHint: PlaceHolderImages.find(p => p.id === 'luna-avatar')?.imageHint ?? '',
      tags: ['Witty', 'Temp: 2.1'],
      expertise: ['Branding', 'Storytelling', 'Design', 'SEO'],
      personality: ['Creative', 'Humorous', 'Decisive'],
      isPinned: false,
    },
];

function StackedAvatars() {
    const avatarData = [
        PlaceHolderImages.find(p => p.id === 'codementor-avatar'),
        PlaceHolderImages.find(p => p.id === 'asha-avatar'),
        PlaceHolderImages.find(p => p.id === 'luna-avatar'),
    ];

    return (
        <div className="flex -space-x-3 overflow-hidden">
            {avatarData.map((avatar, index) => (
                avatar && <Avatar key={index} className="h-10 w-10 border-2 border-background">
                    <AvatarImage src={avatar.imageUrl} alt="User Avatar" data-ai-hint={avatar.imageHint} />
                    <AvatarFallback>{avatar.id.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
            ))}
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium text-muted-foreground">
                +1
            </div>
        </div>
    );
}


function PersonasPageContent() {
    const [personas, setPersonas] = useState<Persona[]>(initialPersonas);
    const [personaToDelete, setPersonaToDelete] = useState<Persona | null>(null);
    const { toast } = useToast();

    const stats = [
        { value: personas.length, label: "Total Personas" },
        { value: "24", label: "Conversations" },
        { value: "156", label: "Messages Sent" },
    ];

    const handleDeleteRequest = (persona: Persona) => {
        setPersonaToDelete(persona);
    };

    const confirmDelete = () => {
        if (!personaToDelete) return;
        setPersonas(personas.filter(p => p.id !== personaToDelete.id));
        setPersonaToDelete(null);
        toast({ title: "Persona deleted", description: `${personaToDelete.name} has been removed.`});
    };

    const handlePinToggle = (personaId: string) => {
        const personaToToggle = personas.find(p => p.id === personaId);
        if (!personaToToggle) return;

        setPersonas(prevPersonas => {
            const updatedPersonas = prevPersonas.map(p => 
                p.id === personaId ? { ...p, isPinned: !p.isPinned } : p
            );
            
            return updatedPersonas.sort((a, b) => {
                if (a.isPinned && !b.isPinned) return -1;
                if (!a.isPinned && b.isPinned) return 1;
                return 0;
            });
        });
        toast({ title: personaToToggle.isPinned ? "Persona unpinned!" : "Persona pinned to top!" });
    };
    
    return (
        <div className="flex-1 p-4 md:p-8 lg:p-12 overflow-y-auto">
            <div className="persona-container max-w-7xl mx-auto space-y-12">
                <header className="header-area flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
                    <div className="flex-1 space-y-4 text-center lg:text-left">
                        <StackedAvatars />
                        <h1 className="text-4xl font-bold tracking-tight">Your AI Persona Library</h1>
                        <p className="text-lg text-muted-foreground">Create, customize, and manage AI personas tailored to your needs.</p>
                    </div>
                    <div className="flex w-full md:w-auto items-stretch gap-4">
                        <Button asChild variant="outline" className="add-model-button h-36 w-36 flex-col gap-2 rounded-2xl border-dashed border-2">
                           <Link href="/personas/create">
                            <div className="h-16 w-16 rounded-full border-2 border-dashed flex items-center justify-center mb-1">
                                <UserPlus className="h-8 w-8" />
                            </div>
                            <span className="font-semibold">+ Create Persona</span>
                           </Link>
                        </Button>
                        <Card className="summary-stats flex-1 rounded-2xl">
                            <CardContent className="flex h-full items-center justify-around p-4 gap-4">
                                {stats.map(stat => (
                                    <div key={stat.label} className="text-center px-4">
                                        <p className="text-5xl font-bold">{stat.value}</p>
                                        <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>
                </header>

                <main className="personas-grid-section">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold">Your Personas</h2>
                        <Select>
                            <SelectTrigger className="w-[180px] rounded-full">
                                <SelectValue placeholder="Sort by: Featured" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="featured">Sort by: Featured</SelectItem>
                                <SelectItem value="newest">Sort by: Newest</SelectItem>
                                <SelectItem value="oldest">Sort by: Oldest</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {personas.map((persona) => (
                            <PersonaCard 
                                key={persona.id} 
                                persona={persona} 
                                onDelete={() => handleDeleteRequest(persona)}
                                onPinToggle={() => handlePinToggle(persona.id)}
                            />
                        ))}
                    </div>
                </main>
            </div>
            <AlertDialog open={!!personaToDelete} onOpenChange={(open) => !open && setPersonaToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the persona.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setPersonaToDelete(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}


export default function PersonasPage() {
    return (
        <AppLayout>
            <PersonasPageContent />
        </AppLayout>
    )
}
