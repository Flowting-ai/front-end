"use client";

// Documents API is not available in the current backend — all functions are stubbed.

export interface UploadDocumentResponse {
  documentId?: string | number | null;
  document_id?: string | number | null;
  fileLink?: string | null;
  file_link?: string | null;
  message?: string;
  detail?: string;
}

export interface DocumentSearchResult {
  documentId: string | null;
  documentName?: string | null;
  chatId?: string | null;
  chunkId?: string | null;
  score?: number | null;
  snippet?: string | null;
  sourceUrl?: string | null;
}

export async function uploadDocument(_params: {
  file: File;
  chatId: string;
  sourceUrl?: string;
}): Promise<{ documentId: string | null; fileLink: string | null; message?: string }> {
  throw new Error("Document upload is not supported in the current backend.");
}

export async function searchDocuments(_params: {
  query: string;
  chatId?: string;
  topK?: number;
}): Promise<DocumentSearchResult[]> {
  return [];
}
