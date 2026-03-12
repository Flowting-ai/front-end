"use client";

// Image generation API is not available in the current backend — stubbed.

export interface GenerateImageParams {
  prompt: string;
  chatId?: string;
  width?: number;
  height?: number;
}

export interface GenerateImageResponse {
  imageUrl: string;
  jobId?: string | null;
}

export async function generateImage(
  _params: GenerateImageParams
): Promise<GenerateImageResponse> {
  throw new Error("Image generation is not supported in the current backend.");
}
