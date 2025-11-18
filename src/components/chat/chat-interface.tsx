
"use client";

import { useState, useRef, useEffect, useContext } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, Send, Mic, Library } from "lucide-react";
import { ChatMessage, type Message } from "./chat-message";
import { InitialPrompts } from "./initial-prompts";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Pin as PinType } from "../layout/right-sidebar";
import { useToast } from "@/hooks/use-toast";
import { AppLayoutContext } from "../layout/app-layout";
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


interface ChatInterfaceProps {
    onPinMessage?: (pin: PinType) => void;
    onUnpinMessage?: (messageId: string) => void;
    messages?: Message[];
    setMessages?: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
}

export function ChatInterface({ onPinMessage, onUnpinMessage, messages = [], setMessages = () => {} }: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
  const [isAtTop, setIsAtTop] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const userAvatar = PlaceHolderImages.find(p => p.id === 'user-avatar');
  const aiAvatar = PlaceHolderImages.find(p => p.id === 'ai-avatar');
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [isResponding, setIsResponding] = useState(false);
  const layoutContext = useContext(AppLayoutContext);

  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 200; // max height 
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [input]);

  useEffect(() => {
    const viewport = scrollViewportRef.current;
    if (viewport && isScrolledToBottom) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages, isScrolledToBottom]);


  const handleSend = (content: string, messageIdToUpdate?: string) => {
    if (content.trim() === "" || isResponding) return;
    setIsResponding(true);

    if (messageIdToUpdate) {
       // This is an edit and resubmit
       const userMessageIndex = (messages || []).findIndex(m => m.id === messageIdToUpdate);
       if (userMessageIndex === -1) {
        setIsResponding(false);
        return;
       }

       const updatedMessages = (messages || []).slice(0, userMessageIndex + 1);
       updatedMessages[userMessageIndex] = { ...updatedMessages[userMessageIndex], content };

       const loadingMessage: Message = {
         id: (Date.now() + 1).toString(),
         sender: 'ai',
         isLoading: true,
         content: '',
         avatarUrl: aiAvatar?.imageUrl,
         avatarHint: aiAvatar?.imageHint
       };
       setMessages([...updatedMessages, loadingMessage]);
       fetchAiResponse(content, loadingMessage.id);

    } else {
        // This is a new message
        const userMessage: Message = {
          id: Date.now().toString(),
          sender: "user",
          content: content,
          avatarUrl: userAvatar?.imageUrl,
          avatarHint: userAvatar?.imageHint
        };

        const loadingMessage: Message = {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          isLoading: true,
          content: '',
          avatarUrl: aiAvatar?.imageUrl,
          avatarHint: aiAvatar?.imageHint
        };

        setMessages((prev) => [...(prev || []), userMessage, loadingMessage]);
        setInput("");
        setIsScrolledToBottom(true);
        fetchAiResponse(content, loadingMessage.id);
    }
  };
 const fetchAiResponse = async (userMessage: string, loadingMessageId: string) => {
  try {
    const response = await fetch("http://127.0.0.1:8000/chat/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: userMessage,
      }),
    });

    console.log("response.ok:", response.ok);

    if (!response.ok) {
      // If you want to inspect error details, read the body ONCE as text or json
      const errorText = await response.text();
      console.error("Backend error body:", errorText);
      throw new Error("API request failed");
    }

    // ✅ Read body exactly once
    const data = await response.json();
    console.log("response data:", data);

    const aiResponse: Message = {
      id: loadingMessageId,
      sender: "ai",
      content: data.message|| "API didn't respond",
      avatarUrl: aiAvatar?.imageUrl,
      avatarHint: aiAvatar?.imageHint,
    };

    setMessages((prev) =>
      (prev || []).map((msg) => (msg.id === loadingMessageId ? aiResponse : msg))
    );
    setLastMessageId(loadingMessageId);
  } catch (error) {
    console.error("Error fetching AI response:", error);

    const errorResponse: Message = {
      id: loadingMessageId,
      sender: "ai",
      content: "API didn't respond",
      avatarUrl: aiAvatar?.imageUrl,
      avatarHint: aiAvatar?.imageHint,
    };

    setMessages((prev) =>
      (prev || []).map((msg) => (msg.id === loadingMessageId ? errorResponse : msg))
    );

    toast({
      title: "Connection Error",
      description: "Failed to connect to AI service",
      variant: "destructive",
    });
  } finally {
    setIsResponding(false);
  }
};


  const handlePromptClick = (prompt: string) => {
    setInput(prompt);
    textareaRef.current?.focus();
  };
  
  const handleScroll = () => {
    const viewport = scrollViewportRef.current;
    if (viewport) {
      const isAtBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 1;
      setIsScrolledToBottom(isAtBottom);
      const isAtTop = viewport.scrollTop === 0;
      setIsAtTop(isAtTop);
    }
  };

  const scrollToBottom = () => {
    scrollViewportRef.current?.scrollTo({ top: scrollViewportRef.current.scrollHeight, behavior: 'smooth' });
    setIsScrolledToBottom(true);
  };
  
  const scrollToTop = () => {
    scrollViewportRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const handlePin = (message: Message) => {
    if (!layoutContext || !layoutContext.activeChatId) return;
  
    const isPinned = layoutContext.pins.some(p => p.id === message.id);
  
    if (isPinned) {
      if (onUnpinMessage) {
        onUnpinMessage(message.id);
        toast({ title: "Unpinned from board!" });
      }
    } else {
      if (onPinMessage) {
        const newPin: PinType = {
          id: message.id,
          text: message.content,
          tags: [],
          notes: "",
          chatId: layoutContext.activeChatId.toString(),
          time: new Date(),
        };
        onPinMessage(newPin);
        toast({ title: "Pinned to board!" });
      }
    }
  };


  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({ title: "Copied to clipboard!" });
  };

  const handleEdit = (messageId: string, newContent: string) => {
    setMessages(prev => (prev || []).map(msg => 
      msg.id === messageId ? { ...msg, content: newContent } : msg
    ));
  };

  const handleDeleteRequest = (message: Message) => {
    setMessageToDelete(message);
  };

  const confirmDelete = () => {
    if (!messageToDelete) return;

    // Check if the message was pinned
    const isPinned = layoutContext?.pins.some(p => p.id === messageToDelete.id);
    if (isPinned && onUnpinMessage) {
      onUnpinMessage(messageToDelete.id);
    }

    setMessages(prev => (prev || []).filter(m => m.id !== messageToDelete.id));
    setMessageToDelete(null);
    toast({ title: "Message deleted." });
  };
  
  const isMessagePinned = (messageId: string) => {
    return layoutContext?.pins.some(p => p.id === messageId) || false;
  }
  
  return (
    <div className="flex flex-col flex-1 bg-background overflow-hidden">
        <ScrollArea className="flex-1" viewportRef={scrollViewportRef} onScroll={handleScroll}>
            <div className="max-w-4xl mx-auto w-full space-y-6 p-4">
            {(messages || []).length === 0 ? (
                <InitialPrompts onPromptClick={handlePromptClick} />
            ) : (
                messages.map((msg) => (
                  <ChatMessage 
                    key={msg.id} 
                    message={msg}
                    isPinned={isMessagePinned(msg.id)}
                    onPin={handlePin}
                    onCopy={handleCopy}
                    onEdit={handleEdit}
                    onDelete={handleDeleteRequest}
                    onResubmit={handleSend}
                    isNewMessage={msg.id === lastMessageId}
                  />
                ))
            )}
            </div>
        </ScrollArea>
        {(messages || []).length > 0 && (
             <div className="absolute bottom-24 right-4 flex-col gap-2 hidden md:flex z-10">
                {!isAtTop && (
                    <Button 
                        onClick={scrollToTop}
                        variant="outline" 
                        size="icon"
                        className="rounded-full"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="m18 15-6-6-6 6"/></svg>
                    </Button>
                )}
                {!isScrolledToBottom && (
                    <Button 
                        onClick={scrollToBottom}
                        variant="outline"
                        size="icon"
                        className="rounded-full"
                    >
                         <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="m6 9 6 6 6-6"/></svg>
                    </Button>
                )}
            </div>
        )}
        <footer className="shrink-0 p-4 bg-background">
          <div className="relative max-w-4xl mx-auto w-full">
            <div className="relative flex flex-col p-2 rounded-[25px] border border-input bg-card shadow-sm focus-within:ring-2 focus-within:ring-ring">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !isResponding) {
                    e.preventDefault();
                    handleSend(input);
                  }
                }}
                placeholder="Lets Play....."
                className="pr-12 text-base resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-2 min-h-[48px]"
                rows={1}
                disabled={isResponding}
              />
              <div className="flex items-center justify-between mt-1 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                      <Button variant="ghost" className="rounded-[25px] h-8 px-3">
                          <Library className="mr-2 h-4 w-4" />
                          Library
                      </Button>
                      <Select>
                          <SelectTrigger className="rounded-[25px] bg-transparent w-auto gap-2 h-8 px-3 border-0">
                              <SelectValue placeholder="Choose Persona" />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="researcher">Researcher</SelectItem>
                              <SelectItem value="writer">Creative Writer</SelectItem>
                              <SelectItem value="technical">Technical Expert</SelectItem>
                          </SelectContent>
                      </Select>
                      <Select>
                          <SelectTrigger className="rounded-[25px] bg-transparent w-auto gap-2 h-8 px-3 border-0">
                              <SelectValue placeholder="Add Context" />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="file">From File</SelectItem>
                              <SelectItem value="url">From URL</SelectItem>
                          </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                          <Paperclip className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                          <Mic className="h-4 w-4" />
                      </Button>
                  </div>
                  <Button size={isMobile ? 'icon' : 'lg'} onClick={() => handleSend(input)} disabled={!input.trim() || isResponding} className="bg-primary text-primary-foreground h-9 rounded-[25px] px-4 flex items-center gap-2">
                      {!isMobile && "Send Message"}
                      <Send className="h-4 w-4" />
                  </Button>
              </div>
            </div>
          </div>
        </footer>

        <AlertDialog open={!!messageToDelete} onOpenChange={(open) => !open && setMessageToDelete(null)}>
        <AlertDialogContent className="rounded-[25px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this message.
            </AlertDialogDescription>
            {messageToDelete && isMessagePinned(messageToDelete.id) && (
              <div className="font-semibold text-destructive mt-2 text-sm">This message is currently pinned.</div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-[25px]" onClick={() => setMessageToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="rounded-[25px]" onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
