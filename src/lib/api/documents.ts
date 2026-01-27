"use client";

import { DOCUMENTS_ENDPOINT, DOCUMENT_SEARCH_ENDPOINT } from "@/lib/config";
import { apiFetch } from "./client";

export interface UploadDocumentResponse {
  documentId?: string | number | null;
  document_id?: string | number | null;
  fileLink?: string | null;
  file_link?: string | null;
  message?: string;
  detail?: string;
}

interface UploadDocumentParams {
  file: File;
  chatId: string;
  sourceUrl?: string;
  csrfToken?: string | null;
}

export async function uploadDocument({
  file,
  chatId,
  sourceUrl,
  csrfToken,
}: UploadDocumentParams): Promise<{
  documentId: string | null;
  fileLink: string | null;
  message?: string;
}> {
  const fileText = await file.text();
  const arrayBuffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);
  let fileContent: string | undefined;
  try {
    // Convert binary to base64 in chunks to avoid stack blowups
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < uint8.length; i += chunkSize) {
      binary += String.fromCharCode(...uint8.subarray(i, i + chunkSize));
    }
    fileContent = btoa(binary);
  } catch (error) {
    console.warn("Unable to base64 encode file, sending text only", error);
  }

  const response = await apiFetch(
    DOCUMENTS_ENDPOINT,
    {
      method: "POST",
      body: JSON.stringify({
        chatId,
        documentName: file.name,
        sourceUrl: sourceUrl ?? "",
        text: fileText,
        fileContent,
      }),
    },
    csrfToken
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to upload document");
  }

  const data = (await response.json()) as UploadDocumentResponse;
  return {
    documentId:
      (data.documentId ?? data.document_id)?.toString() ??
      null,
    fileLink: data.fileLink ?? data.file_link ?? null,
    message: data.message ?? data.detail,
  };
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

export async function searchDocuments({
  query,
  chatId,
  topK,
  csrfToken,
}: {
  query: string;
  chatId?: string;
  topK?: number;
  csrfToken?: string | null;
}): Promise<DocumentSearchResult[]> {
  const params = new URLSearchParams();
  params.set("q", query);
  if (chatId) params.set("chatId", chatId);
  if (topK) params.set("limit", String(topK));

  const queryString = params.toString();
  const url = queryString
    ? `${DOCUMENT_SEARCH_ENDPOINT}?${queryString}`
    : DOCUMENT_SEARCH_ENDPOINT;

  const response = await apiFetch(
    url,
    { method: "GET" },
    csrfToken
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to search documents");
  }

  const data = await response.json();
  const resultsArray = Array.isArray(data?.results)
    ? data.results
    : Array.isArray(data)
    ? data
    : [];

  return resultsArray.map((item: Record<string, unknown>) => {
    const rawDocumentId =
      (item.documentId ?? item.document_id) as string | number | undefined;
    const rawSnippet =
      (item.snippet ?? item.text) as string | undefined;
    const rawSource =
      (item.sourceUrl ?? item.source_url) as string | undefined;

    return {
      documentId: rawDocumentId !== undefined ? String(rawDocumentId) : null,
      documentName:
        (item.documentName ?? item.document_name)?.toString?.() ?? null,
      chatId: (item.chatId ?? item.chat_id)?.toString?.() ?? null,
      chunkId:
        (item.chunkId ?? item.chunk_id)?.toString?.() ?? null,
      score: typeof item.score === "number" ? item.score : null,
      snippet: typeof rawSnippet === "string" ? rawSnippet : null,
      sourceUrl: typeof rawSource === "string" ? rawSource : null,
    };
  });
}
