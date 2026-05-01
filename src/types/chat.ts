export interface Chat {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  starred: boolean;
  model?: string;
  message_count?: number;
  last_message_at?: string;
}

export interface Attachment {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  url?: string;
  thumbnail_url?: string;
}

export interface Citation {
  index: number;
  source_id: string;
  text: string;
}

export interface Source {
  id: string;
  url: string;
  title: string;
  favicon?: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  chat_id: string;
  model?: string;
  attachments?: Attachment[];
  thinking?: string;
  citations?: Citation[];
  sources?: Source[];
}

export interface ChatsListResponse {
  chats: Chat[];
  next_cursor?: string | null;
  has_more: boolean;
  total?: number;
}

export interface MessagesListResponse {
  messages: Message[];
  next_cursor?: string | null;
  has_more: boolean;
}
