
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createCustomPersona } from "@/ai/flows/create-custom-persona";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Wand2, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "../ui/card";

const personaSchema = z.object({
  role: z.string().min(2, "Role must be at least 2 characters."),
  tone: z.string().min(2, "Tone must be at least 2 characters."),
  expertise: z.string().min(2, "Expertise must be at least 2 characters."),
  description: z.string().min(10, "Description must be at least 10 characters."),
});

type PersonaFormValues = z.infer<typeof personaSchema>;
type RefinedPersona = Awaited<ReturnType<typeof createCustomPersona>>;

export function CreatePersonaDialog() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [refinedPersona, setRefinedPersona] = useState<RefinedPersona | null>(null);
  const { toast } = useToast();

  const form = useForm<PersonaFormValues>({
    resolver: zodResolver(personaSchema),
    defaultValues: {
      role: "",
      tone: "",
      expertise: "",
      description: "",
    },
  });

  const onSubmit = async (values: PersonaFormValues) => {
    setIsLoading(true);
    setRefinedPersona(null);
    try {
      const result = await createCustomPersona(values);
      setRefinedPersona(result);
      toast({
        title: "Persona Refined!",
        description: "The AI has enhanced your custom persona.",
      });
    } catch (error) {
      console.error("Error creating custom persona:", error);
      toast({
        title: "Error",
        description: "Could not create the custom persona. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePersona = () => {
    // Logic to save the refined persona will go here
    toast({
      title: "Persona Saved!",
      description: `${refinedPersona?.refinedRole} has been added to your personas.`,
    });
    setOpen(false);
    form.reset();
    setRefinedPersona(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-[25px]">
          <UserPlus className="mr-2 h-4 w-4" />
          Create Persona
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Custom Persona</DialogTitle>
          <DialogDescription>
            Define a new AI persona. The AI will refine your input for optimal performance.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Software Engineer" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tone</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Casual and witty" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expertise"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expertise</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., React & TypeScript" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="A brief description of the persona's background and communication style." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? <Loader2 className="animate-spin" /> : <><Wand2 className="mr-2 h-4 w-4" />Refine with AI</>}
              </Button>
            </form>
          </Form>
          <div className="space-y-4">
            <h3 className="text-lg font-medium">AI-Refined Persona</h3>
            {refinedPersona ? (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div>
                    <h4 className="font-semibold text-sm">Role</h4>
                    <p className="text-sm text-muted-foreground">{refinedPersona.refinedRole}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Tone</h4>
                    <p className="text-sm text-muted-foreground">{refinedPersona.refinedTone}</p>

                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Expertise</h4>
                    <p className="text-sm text-muted-foreground">{refinedPersona.refinedExpertise}</p>
                  </div>
                   <div>
                    <h4 className="font-semibold text-sm">Description</h4>
                    <p className="text-sm text-muted-foreground">{refinedPersona.refinedDescription}</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="flex items-center justify-center h-full border-2 border-dashed rounded-lg">
                <p className="text-sm text-muted-foreground">AI refinements will appear here.</p>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSavePersona} disabled={!refinedPersona}>Save Persona</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
