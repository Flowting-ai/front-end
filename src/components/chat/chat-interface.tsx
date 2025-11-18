"use client";

import { useState, useRef, useEffect, useContext } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, Send, Mic, Library } from "lucide-react";
import { ChatMessage, type Message } from "./chat-message";
import { InitialPrompts } from "./initial-prompts";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Pin as PinType } from "../layout/right-sidebar";
import type { AIModel } from "@/types/ai-model";
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
import { useAuth } from "@/context/auth-context";
import { CHAT_COMPLETION_ENDPOINT } from "@/lib/config";
import { getModelIcon } from "@/lib/model-icons";

interface ChatInterfaceProps {
  onPinMessage?: (pin: PinType) => Promise<void> | void;
  onUnpinMessage?: (messageId: string) => Promise<void> | void;
  messages?: Message[];
  setMessages?: (
    messages: Message[] | ((prev: Message[]) => Message[]),
    chatIdOverride?: string
  ) => void;
  selectedModel?: AIModel | null; // 👈 
}

type MessageAvatar = Pick<Message, "avatarUrl" | "avatarHint">;

export function ChatInterface({
  onPinMessage,
  onUnpinMessage,
  messages = [],
  setMessages = () => {},
  selectedModel = null,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
  const [isAtTop, setIsAtTop] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const userAvatar = PlaceHolderImages.find((p) => p.id === "user-avatar");
  const defaultAiAvatar = PlaceHolderImages.find((p) => p.id === "ai-avatar");
  const resolveModelAvatar = (modelOverride?: AIModel | null): MessageAvatar => {
    if (modelOverride) {
      const hintParts = [modelOverride.companyName, modelOverride.modelName].filter(Boolean);
      return {
        avatarUrl: getModelIcon(modelOverride.companyName),
        avatarHint: hintParts.join(" ").trim(),
      };
    }
    return {
      avatarUrl: defaultAiAvatar?.imageUrl,
      avatarHint: defaultAiAvatar?.imageHint,
    };
  };
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [isResponding, setIsResponding] = useState(false);
  const layoutContext = useContext(AppLayoutContext);
  const { user, csrfToken } = useAuth();

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

  const fetchAiResponse = async (
    userMessage: string,
    loadingMessageId: string,
    chatId: string,
    userMessageId: string | undefined,
    modelForRequest: AIModel | null,
    avatarForRequest: MessageAvatar
  ) => {
    try {
      if (!modelForRequest) {
        console.warn("No model selected  backend may need to use a default.");
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (csrfToken) {
        headers["X-CSRFToken"] = csrfToken;
      }

      const response = await fetch(CHAT_COMPLETION_ENDPOINT, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          prompt: userMessage,
          chatId,
          model: modelForRequest
            ? {
                companyName: modelForRequest.companyName,
                modelName: modelForRequest.modelName,
                version: modelForRequest.version,
              }
            : null,
          user: user
            ? {
                id: user.id ?? null,
                email: user.email ?? null,
                name: user.name ?? null,
              }
            : null,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Backend error body:", errorText);
        let parsedMessage = "API request failed";
        try {
          const parsed = JSON.parse(errorText);
          parsedMessage =
            parsed?.detail ??
            parsed?.message ??
            parsed?.error ??
            errorText ??
            parsedMessage;
        } catch {
          parsedMessage = errorText || parsedMessage;
        }
        throw new Error(parsedMessage);
      }

      const data = await response.json();

      const aiResponse: Message = {
        id: loadingMessageId,
        sender: "ai",
        content: data.message || "API didn't respond",
        avatarUrl: avatarForRequest.avatarUrl,
        avatarHint: avatarForRequest.avatarHint,
        chatMessageId: data.messageId ?? undefined,
        metadata: data.metadata ? {
          modelName: data.metadata.modelName,
          providerName: data.metadata.providerName,
          inputTokens: data.metadata.inputTokens,
          outputTokens: data.metadata.outputTokens,
          createdAt: data.metadata.createdAt,
        } : undefined,
      };

      setMessages(
        (prev = []) =>
          prev.map((msg) => {
            if (msg.id === loadingMessageId) {
              return {
                ...aiResponse,
                chatMessageId: data.messageId ?? aiResponse.chatMessageId,
              };
            }
            if (userMessageId && msg.id === userMessageId) {
              return {
                ...msg,
                chatMessageId: data.messageId ?? msg.chatMessageId,
              };
            }
            return msg;
          }),
        chatId
      );
      setLastMessageId(loadingMessageId);
    } catch (error) {
      console.error("Error fetching AI response:", error);

      const errorMessage =
        error instanceof Error && error.message
          ? error.message
          : "Failed to connect to AI service";

      const errorResponse: Message = {
        id: loadingMessageId,
        sender: "ai",
        content: errorMessage,
        avatarUrl: avatarForRequest.avatarUrl,
        avatarHint: avatarForRequest.avatarHint,
      };

      setMessages(
        (prev = []) =>
          prev.map((msg) => (msg.id === loadingMessageId ? errorResponse : msg)),
        chatId
      );

      toast({
        title: "Unable to reach model",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsResponding(false);
    }
  };

  const handleSend = async (content: string, messageIdToUpdate?: string) => {
    const trimmedContent = content.trim();
    if (!selectedModel) {
      toast({
        title: "Select a model",
        description: "Choose a model before sending a message.",
        variant: "destructive",
      });
      return;
    }
    if (trimmedContent === "" || isResponding) return;
    setIsResponding(true);

    const activeModel = selectedModel;
    const requestAvatar = resolveModelAvatar(activeModel);

    let chatId = layoutContext?.activeChatId ?? null;
    let initialAiResponse: string | null = null;
    let initialAiMessageId: string | null = null;

    if (!chatId && layoutContext?.ensureChatOnServer) {
      try {
        const ensured = await layoutContext.ensureChatOnServer({
          firstMessage: trimmedContent,
          selectedModel: activeModel,
        });
        chatId = ensured?.chatId ?? null;
        initialAiResponse = ensured?.initialResponse ?? null;
        initialAiMessageId = ensured?.initialMessageId ?? null;
      } catch (error) {
        console.error("Failed to create chat", error);
        toast({
          title: "Unable to start chat",
          description: "Please try again in a moment.",
          variant: "destructive",
        });
        setIsResponding(false);
        return;
      }
    }

    if (!chatId) {
      toast({
        title: "Chat unavailable",
        description: "We couldn't determine which chat to use.",
        variant: "destructive",
      });
      setIsResponding(false);
      return;
    }

    if (messageIdToUpdate) {
      // This is an edit and resubmit
      const userMessageIndex = (messages || []).findIndex(
        (m) => m.id === messageIdToUpdate
      );
      if (userMessageIndex === -1) {
        setIsResponding(false);
        return;
      }

      const updatedMessages = (messages || []).slice(0, userMessageIndex + 1);
      updatedMessages[userMessageIndex] = {
        ...updatedMessages[userMessageIndex],
        content: trimmedContent,
      };

      const loadingMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        isLoading: true,
        content: "",
        avatarUrl: requestAvatar.avatarUrl,
        avatarHint: requestAvatar.avatarHint,
      };

      setMessages([...updatedMessages, loadingMessage], chatId);
      fetchAiResponse(
        trimmedContent,
        loadingMessage.id,
        chatId,
        messageIdToUpdate,
        activeModel,
        requestAvatar
      );
    } else {
      // This is a new message
      const turnId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const userMessageId = `${turnId}-user`;
      const assistantMessageId = `${turnId}-assistant`;

      const userMessage: Message = {
        id: userMessageId,
        sender: "user",
        content: trimmedContent,
        avatarUrl: userAvatar?.imageUrl,
        avatarHint: userAvatar?.imageHint,
      };

      const loadingMessage: Message = {
        id: assistantMessageId,
        sender: "ai",
        isLoading: true,
        content: "",
        avatarUrl: requestAvatar.avatarUrl,
        avatarHint: requestAvatar.avatarHint,
      };

      setMessages(
        (prev = []) => [...prev, userMessage, loadingMessage],
        chatId
      );
      setInput("");
      setIsScrolledToBottom(true);
      if (initialAiResponse !== null) {
        const aiResponse: Message = {
          id: loadingMessage.id,
          sender: "ai",
          content: initialAiResponse,
          avatarUrl: requestAvatar.avatarUrl,
          avatarHint: requestAvatar.avatarHint,
          chatMessageId: initialAiMessageId ?? undefined,
        };
        setMessages(
          (prev = []) =>
            prev.map((msg) => {
              if (msg.id === loadingMessage.id) {
                return aiResponse;
              }
              if (msg.id === userMessage.id && initialAiMessageId) {
                return { ...msg, chatMessageId: initialAiMessageId };
              }
              return msg;
            }),
          chatId
        );
        setLastMessageId(loadingMessage.id);
        setIsResponding(false);
        return;
      }
      fetchAiResponse(
        trimmedContent,
        loadingMessage.id,
        chatId,
        userMessage.id,
        activeModel,
        requestAvatar
      );
    }
  };

  const handlePromptClick = (prompt: string) => {
    setInput(prompt);
    textareaRef.current?.focus();
  };

  const handleScroll = () => {
    const viewport = scrollViewportRef.current;
    if (viewport) {
      const isAtBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 1;
      setIsScrolledToBottom(isAtBottom);
      const isAtTopFlag = viewport.scrollTop === 0;
      setIsAtTop(isAtTopFlag);
    }
  };

  const scrollToBottom = () => {
    if (!scrollViewportRef.current) return;
    scrollViewportRef.current.scrollTo({
      top: scrollViewportRef.current.scrollHeight,
      behavior: "smooth",
    });
    setIsScrolledToBottom(true);
  };

  const scrollToTop = () => {
    if (!scrollViewportRef.current) return;
    scrollViewportRef.current.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePin = async (message: Message) => {
    if (!layoutContext || !layoutContext.activeChatId) return;

    const identifier = message.chatMessageId ?? message.id;
    if (!identifier) {
      toast({
        title: "Unable to pin",
        description: "Please wait for the response to finish generating.",
        variant: "destructive",
      });
      return;
    }

    const isPinned =
      layoutContext.pins.some(
        (p) => p.messageId === identifier || p.id === identifier
      ) || false;

    try {
      if (isPinned) {
        if (onUnpinMessage) {
          await onUnpinMessage(identifier);
          toast({ title: "Unpinned from board!" });
        }
      } else {
        if (onPinMessage) {
          const newPin: PinType = {
            id: identifier,
            messageId: identifier,
            text: message.content,
            tags: [],
            notes: "",
            chatId: layoutContext.activeChatId,
            time: new Date(),
          };
          await onPinMessage(newPin);
          toast({ title: "Pinned to board!" });
        }
      }
    } catch (error) {
      console.error("Failed to toggle pin", error);
      toast({
        title: "Pin action failed",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({ title: "Copied to clipboard!" });
  };

  const handleEdit = (messageId: string, newContent: string) => {
    setMessages((prev) =>
      (prev || []).map((msg) =>
        msg.id === messageId ? { ...msg, content: newContent } : msg
      )
    );
  };

  const handleDeleteRequest = (message: Message) => {
    setMessageToDelete(message);
  };

  const confirmDelete = () => {
    if (!messageToDelete) return;

    const identifier = messageToDelete.chatMessageId ?? messageToDelete.id;
    const isPinned =
      layoutContext?.pins.some(
        (p) => p.messageId === identifier || p.id === identifier
      ) || false;
    if (isPinned && onUnpinMessage && identifier) {
      onUnpinMessage(identifier);
    }

    setMessages((prev) => (prev || []).filter((m) => m.id !== messageToDelete.id));
    setMessageToDelete(null);
    toast({ title: "Message deleted." });
  };

  const isMessagePinned = (message: Message) => {
    const identifier = message.chatMessageId ?? message.id;
    return (
      layoutContext?.pins.some(
        (p) => p.messageId === identifier || p.id === identifier
      ) || false
    );
  };

  const isSendDisabled = !selectedModel || !input.trim() || isResponding;

  return (
    <div className="flex flex-col flex-1 bg-background overflow-hidden">
      <ScrollArea
        className="flex-1"
        viewportRef={scrollViewportRef}
        onScroll={handleScroll}
      >
        <div className="mx-auto w-full max-w-[min(1400px,100%)] space-y-6 px-4 py-4 sm:px-6 lg:px-10">
          {(messages || []).length === 0 ? (
            <InitialPrompts onPromptClick={handlePromptClick} />
          ) : (
            messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                isPinned={isMessagePinned(msg)}
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="m18 15-6-6-6 6" />
              </svg>
            </Button>
          )}
          {!isScrolledToBottom && (
            <Button
              onClick={scrollToBottom}
              variant="outline"
              size="icon"
              className="rounded-full"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </Button>
          )}
        </div>
      )}

      <footer className="shrink-0 border-t bg-white/80 backdrop-blur-sm p-4">
        <div className="relative mx-auto w-full max-w-[min(1400px,100%)]">
          <div className="relative flex flex-col p-3 rounded-[28px] border border-input/60 bg-white shadow-[0_20px_45px_rgba(15,23,42,0.08)] focus-within:ring-2 focus-within:ring-ring">
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
              placeholder={
                selectedModel ? "Lets Play....." : "Select a model to start chatting"
              }
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                >
                  <Mic className="h-4 w-4" />
                </Button>
              </div>
              <Button
                size={isMobile ? "icon" : "lg"}
                onClick={() => handleSend(input)}
                disabled={isSendDisabled}
                className="bg-primary text-primary-foreground h-9 rounded-[25px] px-4 flex items-center gap-2"
                title={!selectedModel ? "Select a model to send a message" : undefined}
              >
                {!isMobile && "Send Message"}
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </footer>

      <AlertDialog
        open={!!messageToDelete}
        onOpenChange={(open) => !open && setMessageToDelete(null)}
      >
        <AlertDialogContent className="rounded-[25px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this
              message.
            </AlertDialogDescription>
            {messageToDelete && isMessagePinned(messageToDelete) && (
              <div className="font-semibold text-destructive mt-2 text-sm">
                This message is currently pinned.
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-[25px]"
              onClick={() => setMessageToDelete(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-[25px]"
              onClick={confirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
