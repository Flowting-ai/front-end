"use client";

import { GENERATE_IMAGE_ENDPOINT } from "@/lib/config";
import { apiFetch } from "./client";

export interface GenerateImageParams {
  prompt: string;
  chatId?: string;
  width?: number;
  height?: number;
  csrfToken?: string | null;
}

export interface GenerateImageResponse {
  imageUrl: string;
  jobId?: string | null;
}

export async function generateImage({
  prompt,
  chatId,
  width,
  height,
  csrfToken,
}: GenerateImageParams): Promise<GenerateImageResponse> {
  const response = await apiFetch(
    GENERATE_IMAGE_ENDPOINT,
    {
      method: "POST",
      body: JSON.stringify({
        prompt,
        chatId,
        width,
        height,
      }),
    },
    csrfToken
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to generate image");
  }

  const data = await response.json();
  const imageUrl = data.imageUrl || data.image_url;
  if (!imageUrl || typeof imageUrl !== "string") {
    throw new Error("No imageUrl returned from server");
  }
  return {
    imageUrl,
    jobId:
      typeof data.jobId === "string"
        ? data.jobId
        : typeof data.job_id === "string"
        ? data.job_id
        : null,
  };
}
