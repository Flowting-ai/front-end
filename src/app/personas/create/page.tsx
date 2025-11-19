'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Lightbulb, Info, UploadCloud, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Stepper } from '@/components/personas/stepper';
import { FileUpload } from '@/components/personas/file-upload';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import Image from 'next/image';

const steps = ['Identity', 'Communication', 'Expertise', 'Behavior', 'Review'];
const avatarSuggestions = [
  '/avatars/01.png', '/avatars/02.png', '/avatars/03.png', '/avatars/04.png',
  '/avatars/05.png', '/avatars/06.png', '/avatars/07.png', '/avatars/08.png',
  '/avatars/09.png', '/avatars/10.png', '/avatars/11.png', '/avatars/12.png',
];


export default function CreatePersonaPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);


  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSelectAvatar = (avatarUrl: string) => {
    setSelectedAvatar(avatarUrl);
    setIsAvatarModalOpen(false);
  }

  return (
    <div className="flex-1 overflow-y-auto bg-muted/20">
      <div className="p-4 md:p-8 lg:p-12 max-w-5xl mx-auto space-y-8">
        <Link href="/personas" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <header className="text-center space-y-2">
           <div className="inline-block p-3 bg-white rounded-2xl border shadow-sm mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L4 6.5V17.5L12 22L20 17.5V6.5L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M12 13L4 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M12 13L20 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M12 22V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M20 6.5L12 2L4 6.5L12 11L20 6.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
            </div>
          <h1 className="text-3xl font-bold tracking-tight">Floating.ai Persona Builder</h1>
          <p className="text-muted-foreground">Create your custom AI persona in 5 simple steps.</p>
        </header>
        
        <Stepper steps={steps} currentStep={currentStep} />
        
        <Card className="rounded-xl shadow-sm">
          <CardContent className="p-6 md:p-8 space-y-8">
            <div className="bg-muted/50 p-4 rounded-lg flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">Tip:</span> Give your persona a memorable name and role. The backstory helps define its personality and expertise.
              </p>
            </div>

            {currentStep === 1 && (
              <div id="identity" className="space-y-6">
                <h2 className="text-xl font-semibold">Identity</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                  <div className="flex flex-col items-center md:items-start gap-2">
                    <Dialog open={isAvatarModalOpen} onOpenChange={setIsAvatarModalOpen}>
                      <DialogTrigger asChild>
                        <button className="relative group">
                          <Avatar className="h-24 w-24 border-2 border-dashed group-hover:border-primary">
                            {selectedAvatar ? (
                                <AvatarImage src={selectedAvatar} alt="Selected Persona Avatar" />
                            ) : null}
                            <AvatarFallback className="bg-muted/50">
                                <span className="text-3xl text-muted-foreground">+</span>
                            </AvatarFallback>
                          </Avatar>
                        </button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Choose an Avatar</DialogTitle>
                        </DialogHeader>
                        <div className="grid grid-cols-4 gap-4 py-4">
                           {avatarSuggestions.map(src => (
                              <button key={src} onClick={() => handleSelectAvatar(src)}>
                                <Avatar className="h-16 w-16 hover:ring-2 hover:ring-primary">
                                  <AvatarImage src={src} />
                                  <AvatarFallback />
                                </Avatar>
                              </button>
                           ))}
                        </div>
                         <div className="py-2 text-center text-sm text-muted-foreground">OR</div>
                         <Button variant="outline" asChild>
                            <label htmlFor="avatar-upload">
                                <UploadCloud className="w-4 h-4 mr-2"/>
                                Upload from your machine
                                <input type="file" id="avatar-upload" className="sr-only" accept="image/*" />
                            </label>
                         </Button>

                        <DialogFooter>
                            <Button variant="ghost" onClick={() => setIsAvatarModalOpen(false)}>Cancel</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <div className="text-center md:text-left">
                        <p className="font-medium text-sm">Add Image</p>
                        <p className="text-xs text-muted-foreground">This is how your AI will introduce itself</p>
                    </div>
                  </div>
                  <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="persona-name" className="flex items-center gap-1">
                          Persona Name <span className="text-red-500">*</span>
                          <Info className="w-3 h-3 text-muted-foreground" />
                      </Label>
                      <Input id="persona-name" placeholder="e.g. Elon Musk" />
                    </div>
                     <div className="space-y-2">
                      <Label htmlFor="persona-role" className="flex items-center gap-1">
                          Persona Role / Title
                          <Info className="w-3 h-3 text-muted-foreground" />
                      </Label>
                      <Select>
                          <SelectTrigger id="persona-role">
                            <SelectValue placeholder="Value" />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="ux-advisor">UX Advisor</SelectItem>
                              <SelectItem value="developer-mentor">Developer Mentor</SelectItem>
                              <SelectItem value="creative-coach">Creative Coach</SelectItem>
                          </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="backstory" className="flex items-center gap-1">
                        Backstory (Optional)
                        <Info className="w-3 h-3 text-muted-foreground" />
                    </Label>
                    <Textarea id="backstory" placeholder="e.g. Elon Musk is a senior product manager with 10 years of UX research experience..." rows={3} />
                </div>
                
                <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                        Context Files (Optional)
                    </Label>
                    <p className="text-sm text-muted-foreground">Add your documents here, and you can upload up to 5 files max.</p>
                    <FileUpload onFileSelect={setUploadedFile} />
                     {uploadedFile && (
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <File className="w-4 h-4" />
                        <span>{uploadedFile.name}</span>
                        <button onClick={() => setUploadedFile(null)} className="text-red-500 hover:underline">Remove</button>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">Only support .jpg, .png, and .svg and zip files.</p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="model-preference" className="flex items-center gap-1">
                        AI Model Preference
                        <Info className="w-3 h-3 text-muted-foreground" />
                    </Label>
                    <Select defaultValue="gpt4">
                        <SelectTrigger id="model-preference" className="w-full md:w-1/2">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="gpt4">GPT-4 – Most capable</SelectItem>
                            <SelectItem value="gemini-pro">Gemini Pro – Balanced</SelectItem>
                            <SelectItem value="claude-3-sonnet">Claude 3 Sonnet – Creative</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

              </div>
            )}

            {/* Placeholder for other steps */}
            {currentStep > 1 && (
                <div className="text-center text-muted-foreground py-16">
                    Step {currentStep}: {steps[currentStep - 1]} content goes here.
                </div>
            )}
          </CardContent>
        </Card>
        
        <div className="flex justify-between items-center">
            <Button variant="ghost" onClick={handlePrevious} disabled={currentStep === 1}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Previous
            </Button>
            <Button onClick={handleNext}>
                {currentStep === steps.length ? 'Review' : 'Next'}
            </Button>
        </div>
      </div>
    </div>
  );
}
