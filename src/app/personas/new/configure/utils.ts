/**
 * Utility functions for Persona Configuration
 */

import type { UploadedFile } from './types';
import type { AIModel } from '@/types/ai-model';
import type { PersonaModel } from './types';

/**
 * Creates a preview AIModel from a PersonaModel
 * Uses default values for required fields that aren't available in preview context
 */
export function createPreviewModel(model: PersonaModel): AIModel {
  return {
    companyName: model.company,
    modelName: model.label,
    version: "", // Empty string as default since we don't have version info
    modelType: "paid", // Default assumption, can be updated when model data is fetched
    inputLimit: 1000000, // Default value
    outputLimit: 1000000, // Default value
  };
}

/**
 * Determines file type from MIME type
 */
export function getFileType(mimeType: string): 'pdf' | 'image' {
  return mimeType.startsWith('image/') ? 'image' : 'pdf';
}

/**
 * Generates a unique file ID
 */
export function generateFileId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Checks if a file with the same name already exists
 */
export function isDuplicateFile(
  fileName: string,
  existingFiles: UploadedFile[],
  currentBatch: UploadedFile[]
): boolean {
  return (
    existingFiles.some((f) => f.name === fileName) ||
    currentBatch.some((f) => f.name === fileName)
  );
}

/**
 * Creates a file object from a File instance
 */
export function createFileObject(file: File): UploadedFile {
  return {
    id: generateFileId(),
    type: getFileType(file.type),
    name: file.name,
    url: URL.createObjectURL(file),
    file,
    isUploading: true,
    uploadProgress: 0,
  };
}

/**
 * Formats duplicate file error message
 */
export function formatDuplicateFileMessage(duplicateFiles: string[]): {
  title: string;
  description: string;
} {
  const isSingle = duplicateFiles.length === 1;
  return {
    title: isSingle ? "File already uploaded" : "Files already uploaded",
    description: isSingle
      ? `A file named "${duplicateFiles[0]}" already exists. Please upload a different file or remove the existing one first.`
      : `The following files already exist: ${duplicateFiles.join(', ')}. Please upload different files or remove the existing ones first.`,
  };
}

/**
 * Converts a data URL to a File object
 */
export function dataUrlToFile(dataUrl: string, filename: string = 'avatar.png'): File | null {
  try {
    const arr = dataUrl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) return null;

    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);

    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }

    return new File([u8arr], filename, { type: mime });
  } catch {
    return null;
  }
}

