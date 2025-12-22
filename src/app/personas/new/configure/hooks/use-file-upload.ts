/**
 * Custom hook for handling file uploads
 */

import { useState, useCallback } from 'react';
import type { UploadedFile } from '../types';
import { useToast } from '@/hooks/use-toast';
import {
  isDuplicateFile,
  createFileObject,
  formatDuplicateFileMessage,
} from '../utils';

interface UseFileUploadReturn {
  uploadedFiles: UploadedFile[];
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  removeFile: (fileId: string) => void;
  clearFiles: () => void;
}

export function useFileUpload(): UseFileUploadReturn {
  const { toast } = useToast();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const simulateUpload = useCallback((file: UploadedFile) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.id === file.id
            ? { ...f, uploadProgress: progress }
            : f
        )
      );

      if (progress >= 100) {
        clearInterval(interval);
        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? { ...f, isUploading: false, uploadProgress: 100 }
              : f
          )
        );
      }
    }, 200);
  }, []);

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      const filesToAdd: UploadedFile[] = [];
      const duplicateFiles: string[] = [];

      // Check for duplicates and prepare files to add
      Array.from(files).forEach((file) => {
        if (isDuplicateFile(file.name, uploadedFiles, filesToAdd)) {
          duplicateFiles.push(file.name);
          return;
        }

        filesToAdd.push(createFileObject(file));
      });

      // Show toast for duplicate files
      if (duplicateFiles.length > 0) {
        const { title, description } = formatDuplicateFileMessage(duplicateFiles);
        toast({
          title,
          description,
          variant: "destructive",
        });
      }

      // Add valid files and simulate upload
      if (filesToAdd.length > 0) {
        setUploadedFiles((prev) => [...prev, ...filesToAdd]);
        filesToAdd.forEach(simulateUpload);
      }

      // Reset input
      event.target.value = '';
    },
    [uploadedFiles, simulateUpload, toast]
  );

  const removeFile = useCallback((fileId: string) => {
    setUploadedFiles((prev) => {
      const file = prev.find((f) => f.id === fileId);
      if (file?.url) {
        URL.revokeObjectURL(file.url);
      }
      return prev.filter((f) => f.id !== fileId);
    });
  }, []);

  const clearFiles = useCallback(() => {
    uploadedFiles.forEach((file) => {
      if (file.url) {
        URL.revokeObjectURL(file.url);
      }
    });
    setUploadedFiles([]);
  }, [uploadedFiles]);

  return {
    uploadedFiles,
    handleFileUpload,
    removeFile,
    clearFiles,
  };
}

