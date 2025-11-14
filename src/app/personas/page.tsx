
'use client';

import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, MoreHorizontal } from "lucide-react";
import { PersonaCard } from "@/components/personas/persona-card";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import type { Persona } from "@/components/personas/persona-card";

const personas: Persona[] = [
    {
      name: 'Asha',
      title: 'UX Advisor',
      description: 'Senior product manager with 10 years of UX research experience',
      avatarUrl: PlaceHolderImages.find(p => p.id === 'asha-avatar')?.imageUrl ?? '',
      avatarHint: PlaceHolderImages.find(p => p.id === 'asha-avatar')?.imageHint ?? '',
      tags: ['Empathetic', 'Temp: 2.1'],
      expertise: ['UX Research', 'Product Design', 'User Testing'],
      personality: ['Patient', 'Analytical', 'Creative'],
    },
    {
      name: 'CodeMentor',
      title: 'Developer Mentor',
      description: 'Full-stack developer specializing in modern web technologies',
      avatarUrl: PlaceHolderImages.find(p => p.id === 'codementor-avatar')?.imageUrl ?? '',
      avatarHint: PlaceHolderImages.find(p => p.id === 'codementor-avatar')?.imageHint ?? '',
      tags: ['Technical', 'Temp: 2.1'],
      expertise: ['JavaScript', 'React', 'Node.js'],
      personality: ['Decisive', 'Patient', 'Analytical'],
    },
    {
      name: 'Luna',
      title: 'Creative Coach',
      description: 'Award-winning creative director with expertise in branding and storytelling',
      avatarUrl: PlaceHolderImages.find(p => p.id === 'luna-avatar')?.imageUrl ?? '',
      avatarHint: PlaceHolderImages.find(p => p.id === 'luna-avatar')?.imageHint ?? '',
      tags: ['Witty', 'Temp: 2.1'],
      expertise: ['Branding', 'Storytelling', 'Design'],
      personality: ['Creative', 'Humorous', 'Decisive'],
    },
     {
      name: 'Asha',
      title: 'UX Advisor',
      description: 'Senior product manager with 10 years of UX research experience',
      avatarUrl: PlaceHolderImages.find(p => p.id === 'asha-avatar')?.imageUrl ?? '',
      avatarHint: PlaceHolderImages.find(p => p.id === 'asha-avatar')?.imageHint ?? '',
      tags: ['Empathetic', 'Temp: 2.1'],
      expertise: ['UX Research', 'Product Design', 'User Testing'],
      personality: ['Patient', 'Analytical', 'Creative'],
    },
    {
      name: 'CodeMentor',
      title: 'Developer Mentor',
      description: 'Full-stack developer specializing in modern web technologies',
      avatarUrl: PlaceHolderImages.find(p => p.id === 'codementor-avatar')?.imageUrl ?? '',
      avatarHint: PlaceHolderImages.find(p => p.id === 'codementor-avatar')?.imageHint ?? '',
      tags: ['Technical', 'Temp: 2.1'],
      expertise: ['JavaScript', 'React', 'Node.js'],
      personality: ['Decisive', 'Patient', 'Analytical'],
    },
    {
      name: 'Luna',
      title: 'Creative Coach',
      description: 'Award-winning creative director with expertise in branding and storytelling',
      avatarUrl: PlaceHolderImages.find(p => p.id === 'luna-avatar')?.imageUrl ?? '',
      avatarHint: PlaceHolderImages.find(p => p.id === 'luna-avatar')?.imageHint ?? '',
      tags: ['Witty', 'Temp: 2.1'],
      expertise: ['Branding', 'Storytelling', 'Design'],
      personality: ['Creative', 'Humorous', 'Decisive'],
    },
];

function PersonasPageContent() {
    const stats = [
        { value: "5", label: "Total Personas" },
        { value: "24", label: "Conversations" },
        { value: "156", label: "Messages Sent" },
    ];
    
    return (
        <div className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
            <div className="persona-container max-w-7xl mx-auto space-y-8">
                <header className="header-area flex flex-col md:flex-row items-center gap-8">
                    <div className="flex-1">
                        <h1 className="text-3xl font-bold tracking-tight">Your AI Persona Library</h1>
                        <p className="mt-2 text-muted-foreground">Create, customize, and manage AI personas tailored to your needs.</p>
                    </div>
                    <div className="flex w-full md:w-auto items-stretch gap-4">
                        <Button variant="outline" className="add-model-button h-32 w-32 flex-col gap-2">
                            <UserPlus className="h-8 w-8" />
                            <span>+ Add Model</span>
                        </Button>
                        <Card className="summary-stats flex-1">
                            <CardContent className="flex h-full items-center justify-around p-4">
                                {stats.map(stat => (
                                    <div key={stat.label} className="text-center">
                                        <p className="text-4xl font-bold">{stat.value}</p>
                                        <p className="text-sm text-muted-foreground">{stat.label}</p>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>
                </header>

                <main className="personas-grid-section">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold">Your Personas</h2>
                        <Select>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Sort by: Featured" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="featured">Sort by: Featured</SelectItem>
                                <SelectItem value="newest">Sort by: Newest</SelectItem>
                                <SelectItem value="oldest">Sort by: Oldest</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {personas.map((persona, index) => (
                            <PersonaCard key={index} persona={persona} />
                        ))}
                    </div>
                </main>
            </div>
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
