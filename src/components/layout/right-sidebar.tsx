
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Pin, Search, X, Files, ChevronDown, ChevronsRight, ChevronsLeft } from "lucide-react";
import { Badge } from "../ui/badge";
import { Textarea } from "../ui/textarea";
import { cn } from "@/lib/utils";

const initialPins = [
  {
    text: "The Q4 analysis shows a 25% increase user engagement",
    tags: ["Finance Research"],
    chat: "Product Analysis Q4",
    time: "2m",
  },
  {
    text: "The Q4 analysis shows a 25% increase user engagement",
    tags: ["Finance Research"],
    chat: "Product Analysis Q4",
    time: "2m",
  },
    {
    text: "The Q4 analysis shows a 25% increase user engagement",
    tags: ["Finance Research"],
    chat: "Product Analysis Q4",
    time: "2m",
  },
    {
    text: "The Q4 analysis shows a 25% increase user engagement",
    tags: ["Finance Research"],
    chat: "Product Analysis Q4",
    time: "2m",
  },
];

export function RightSidebar() {
  const [pins, setPins] = useState<string[]>(initialPins.map(p => p.text));
  const [activeTab, setActiveTab] = useState("Pins");
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside className={cn(
        "border-l bg-card hidden lg:flex flex-col transition-all duration-300 ease-in-out relative",
        isCollapsed ? "w-16" : "w-96"
        )}>
         <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(!isCollapsed)} className="absolute -left-4 top-1/2 -translate-y-1/2 bg-background border hover:bg-accent z-10 h-8 w-8">
            {isCollapsed ? <ChevronsLeft className="h-4 w-4"/> : <ChevronsRight className="h-4 w-4"/>}
        </Button>

       <div className={cn("p-4 flex justify-end gap-2 border-b", isCollapsed && "hidden")}>
            <Button variant="outline">Compare models</Button>
            <Button variant="outline">Create Persona</Button>
        </div>
      <div className={cn("p-4 border-b", isCollapsed && "hidden")}>
        <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Pinboard</h2>
            <Button variant="ghost" size="icon">
                <X className="w-5 h-5" />
            </Button>
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search pins..." className="pl-9 bg-background" />
        </div>
        <div className="mt-4 flex gap-2">
            <Button variant={activeTab === 'Pins' ? 'default' : 'outline'} className="w-full" onClick={() => setActiveTab('Pins')}>
                <Pin className="mr-2 h-4 w-4" />
                Pins
            </Button>
            <Button variant={activeTab === 'Files' ? 'default' : 'outline'} className="w-full" onClick={() => setActiveTab('Files')}>
                <Files className="mr-2 h-4 w-4" />
                Files
            </Button>
        </div>
        <div className="mt-4">
            <Button variant="outline" className="w-full justify-between">
                <span>Filter by Chats</span>
                <ChevronDown className="h-4 w-4" />
            </Button>
        </div>
      </div>
      <ScrollArea className={cn("flex-1", isCollapsed && "hidden")}>
        <div className="p-4 space-y-3">
          {initialPins.map((pin, index) => (
            <Card key={index} className="bg-background">
              <CardContent className="p-3 space-y-2">
                <p className="text-sm">{pin.text}</p>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Add tags</span>
                    {pin.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="font-normal">
                            {tag}
                            <Button variant="ghost" size="icon" className="h-4 w-4 ml-1">
                                <X className="h-3 w-3" />
                            </Button>
                        </Badge>
                    ))}
                </div>
                <div>
                    <Textarea placeholder="Add private notes..." className="text-xs bg-card mt-1"/>
                </div>
                <div className="flex justify-between items-center pt-2">
                    <Badge variant="outline" className="font-normal border-dashed">{pin.chat}</Badge>
                    <span className="text-xs text-muted-foreground">{pin.time}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
      <div className={cn("p-4 border-t mt-auto", isCollapsed && "hidden")}>
          <Button className="w-full">
              Export Pins
          </Button>
      </div>
    </aside>
  );
}
