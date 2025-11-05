
"use client";

import { useState, useRef, useEffect, useContext } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, Send, Bot, User, Mic, Library } from "lucide-react";
import { ChatMessage, type Message } from "./chat-message";
import { InitialPrompts } from "./initial-prompts";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Pin as PinType } from "../layout/right-sidebar";
import { useToast } from "@/hooks/use-toast";
import { AppLayoutContext } from "../layout/app-layout";


interface ChatInterfaceProps {
    onPinMessage?: (pin: PinType) => void;
    onUnpinMessage?: (messageId: string) => void;
    messages?: Message[];
    setMessages?: (messages: Message[]) => void;
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


<<<<<<< HEAD
  




    
    const handleSend = async () => {
  const trimmed = input.trim();
  if (!trimmed) return;

  const userMessage: Message = {
    id: Date.now().toString(),
    sender: "user",
    content: trimmed,
    avatar: (
      <Avatar className="h-8 w-8">
        {userAvatar && (
          <AvatarImage
            src={userAvatar.imageUrl}
            alt="User"
            data-ai-hint={userAvatar.imageHint}
          />
        )}
        <AvatarFallback>
          <User className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
    ),
  };

  setMessages((prev) => [...prev, userMessage]);
  setInput("");
  setIsScrolledToBottom(true);

  try {
    const res = await fetch("http://127.0.0.1:8000/response/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt: trimmed }),
    });

    if (!res.ok) {
      throw new Error(`Request failed with status ${res.status}`);
    }

    const data = await res.json();

    const loadingMessage: Message = {
      id: (Date.now() + 1).toString(),
      sender: "ai",
      content: data.response,
      avatar: (
        <Avatar className="h-8 w-8">
          {aiAvatar && (
            <AvatarImage
              src={aiAvatar.imageUrl}
              alt="AI"
              data-ai-hint={aiAvatar.imageHint}
            />
          )}
          <AvatarFallback>
            <Bot className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      ),
    };

  
  } catch (err: any) {
    console.error(err);

    const errorMessage: Message = {
      id: (Date.now() + 1).toString(),
      sender: "ai",
      content:
        "Sorry, I encountered an error processing your request. Please try again.",
      avatar: (
        <Avatar className="h-8 w-8">
          {aiAvatar && (
            <AvatarImage
              src={aiAvatar.imageUrl}
              alt="AI"
              data-ai-hint={aiAvatar.imageHint}
            />
          )}
          <AvatarFallback>
            <Bot className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      ),
    };

    setMessages((prev) => [...prev, errorMessage]);
    toast({
      title: "Error",
      description: err.message || "Failed to get response",
      variant: "destructive",
    });
  }
};
=======
  const handleSend = (content: string, messageIdToUpdate?: string) => {
    if (content.trim() === "" || isResponding) return;
    setIsResponding(true);

    if (messageIdToUpdate) {
       // This is an edit and resubmit
       const userMessageIndex = messages.findIndex(m => m.id === messageIdToUpdate);
       if (userMessageIndex === -1) {
        setIsResponding(false);
        return;
       }

       const updatedMessages = messages.slice(0, userMessageIndex + 1);
       updatedMessages[userMessageIndex] = { ...updatedMessages[userMessageIndex], content };

       const loadingMessage: Message = {
         id: (Date.now() + 1).toString(),
         sender: 'ai',
         isLoading: true,
         content: '',
         avatar: (
           <Avatar className="h-8 w-8">
             {aiAvatar && <AvatarImage src={aiAvatar.imageUrl} alt="AI" data-ai-hint={aiAvatar.imageHint} />}
             <AvatarFallback><Bot className="h-4 w-4" /></AvatarFallback>
           </Avatar>
         ),
       };
       setMessages([...updatedMessages, loadingMessage]);
       simulateAiResponse(loadingMessage.id);

    } else {
        // This is a new message
        const userMessage: Message = {
          id: Date.now().toString(),
          sender: "user",
          content: content,
          avatar: (
            <Avatar className="h-8 w-8">
              {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt="User" data-ai-hint={userAvatar.imageHint} />}
              <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
            </Avatar>
          ),
        };

        const loadingMessage: Message = {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          isLoading: true,
          content: '',
          avatar: (
            <Avatar className="h-8 w-8">
              {aiAvatar && <AvatarImage src={aiAvatar.imageUrl} alt="AI" data-ai-hint={aiAvatar.imageHint} />}
              <AvatarFallback><Bot className="h-4 w-4" /></AvatarFallback>
            </Avatar>
          ),
        };

        setMessages([...messages, userMessage, loadingMessage]);
        setInput("");
        setIsScrolledToBottom(true);
        simulateAiResponse(loadingMessage.id);
    }
  };
  
  const simulateAiResponse = (loadingMessageId: string) => {
     // Simulate AI response after a delay
    setTimeout(() => {
      const aiResponse: Message = {
        id: loadingMessageId,
        sender: "ai",
        content: "This is a placeholder response from the AI. The actual response would be generated by the selected model. This is a longer response to test the scrolling behavior and make sure everything works as expected. Let's add even more text to see how it handles multiple lines and overflow.",
        avatar: (
          <Avatar className="h-8 w-8">
            {aiAvatar && <AvatarImage src={aiAvatar.imageUrl} alt="AI" data-ai-hint={aiAvatar.imageHint} />}
            <AvatarFallback><Bot className="h-4 w-4" /></AvatarFallback>
          </Avatar>
        ),
      };

      setMessages((prev) =>
        prev.map((msg) => (msg.id === loadingMessageId ? aiResponse : msg))
      );
      setIsResponding(false);
    }, 1000);
  }
>>>>>>> 973f270 (main change:)

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
    if (!onPinMessage || !onUnpinMessage) return;

    const activeChat = layoutContext?.chatBoards.find(c => c.id === layoutContext.activeChatId);
    const chatName = activeChat ? activeChat.name : "Current Chat";
    
    const isPinned = messages.find(m => m.id === message.id)?.isPinned;

    if (isPinned) {
      onUnpinMessage(message.id);
      toast({ title: "Unpinned from board!" });
    } else {
      const newPin: PinType = {
        id: message.id,
        text: message.content,
        tags: [],
        notes: "",
        chat: chatName,
        time: new Date(),
      };
      onPinMessage(newPin);
      toast({ title: "Pinned to board!" });
    }

    setMessages(messages.map(m => m.id === message.id ? { ...m, isPinned: !m.isPinned } : m));
  };


  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({ title: "Copied to clipboard!" });
  };

  const handleEdit = (messageId: string, newContent: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, content: newContent } : msg
    ));
    // Here you would also make an API call to update the message on the backend
  };

  const handleDelete = (messageId: string) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
  };
  
  return (
    <div className="flex flex-col flex-1 bg-card overflow-hidden">
        <ScrollArea className="flex-1" viewportRef={scrollViewportRef} onScroll={handleScroll}>
            <div className="max-w-4xl mx-auto w-full space-y-6 p-4">
            {messages.length === 0 ? (
                <InitialPrompts onPromptClick={handlePromptClick} />
            ) : (
                messages.map((msg) => (
                  <ChatMessage 
                    key={msg.id} 
                    message={msg}
                    onPin={handlePin}
                    onCopy={handleCopy}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onResubmit={handleSend}
                  />
                ))
            )}
            </div>
        </ScrollArea>
        {messages.length > 0 && (
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
      <footer className="shrink-0 p-4 bg-card">
        <div className="relative max-w-4xl mx-auto w-full">
          <div className="relative flex flex-col p-2 rounded-[25px] border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
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
                    <Button variant="outline" className="rounded-[25px] bg-background h-8 px-3">
                        <Library className="mr-2 h-4 w-4" />
                        Library
                    </Button>
                    <Select>
                        <SelectTrigger className="rounded-[25px] bg-background w-auto gap-2 h-8 px-3">
                            <SelectValue placeholder="Choose Persona" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="researcher">Researcher</SelectItem>
                            <SelectItem value="writer">Creative Writer</SelectItem>
                            <SelectItem value="technical">Technical Expert</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select>
                        <SelectTrigger className="rounded-[25px] bg-background w-auto gap-2 h-8 px-3">
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
    </div>
  );
}

      

    