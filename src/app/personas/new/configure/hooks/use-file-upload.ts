/**
 * Custom hook for handling file uploads
 */

import { useState, useCallback } from 'react';
import type { UploadedFile } from '../types';
import { toast } from '@/lib/toast-helper';
import {
  isDuplicateFile,
  createFileObject,
  formatDuplicateFileMessage,
} from '../utils';
import { MAX_FILE_SIZE_MB, MAX_FILES } from '../constants';

interface UseFileUploadReturn {
  uploadedFiles: UploadedFile[];
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleFileDrop: (files: FileList) => void;
  removeFile: (fileId: string) => void;
  clearFiles: () => void;
  initWithExisting: (files: { id: string; name: string }[]) => void;
}

export function useFileUpload(): UseFileUploadReturn {
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

  const processFiles = useCallback(
    (files: FileList) => {
      if (files.length === 0) return;

      const maxSizeBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
      const availableSlots = MAX_FILES - uploadedFiles.length;

      if (availableSlots <= 0) {
        toast.error('File limit reached', {
          description: `You can upload a maximum of ${MAX_FILES} files.`,
        });
        return;
      }

      const filesToAdd: UploadedFile[] = [];
      const duplicateFiles: string[] = [];
      const oversizedFiles: string[] = [];
      let skippedDueToLimit = 0;

      Array.from(files).forEach((file) => {
        if (filesToAdd.length >= availableSlots) {
          skippedDueToLimit++;
          return;
        }

        if (file.size > maxSizeBytes) {
          oversizedFiles.push(file.name);
          return;
        }

        if (isDuplicateFile(file.name, uploadedFiles, filesToAdd)) {
          duplicateFiles.push(file.name);
          return;
        }

        filesToAdd.push(createFileObject(file));
      });

      if (oversizedFiles.length > 0) {
        toast.error(
          oversizedFiles.length === 1 ? 'File too large' : 'Files too large',
          {
            description:
              oversizedFiles.length === 1
                ? `"${oversizedFiles[0]}" exceeds the ${MAX_FILE_SIZE_MB}MB limit.`
                : `${oversizedFiles.length} files exceed the ${MAX_FILE_SIZE_MB}MB limit.`,
          }
        );
      }

      if (duplicateFiles.length > 0) {
        const { title, description } = formatDuplicateFileMessage(duplicateFiles);
        toast.error(title, { description });
      }

      if (skippedDueToLimit > 0) {
        toast.error('File limit reached', {
          description: `Only ${availableSlots} more file${availableSlots === 1 ? '' : 's'} can be added (max ${MAX_FILES}).`,
        });
      }

      if (filesToAdd.length > 0) {
        setUploadedFiles((prev) => [...prev, ...filesToAdd]);
        filesToAdd.forEach(simulateUpload);
      }
    },
    [uploadedFiles, simulateUpload]
  );

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files) return;
      processFiles(files);
      event.target.value = '';
    },
    [processFiles]
  );

  const handleFileDrop = useCallback(
    (files: FileList) => {
      processFiles(files);
    },
    [processFiles]
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

  const initWithExisting = useCallback((files: { id: string; name: string }[]) => {
    const existing: UploadedFile[] = files.map((f) => ({
      id: f.id,
      type: 'pdf',
      name: f.name,
      url: '',
      file: new File([], f.name),
      isUploading: false,
      uploadProgress: 100,
      isExisting: true,
    }));
    setUploadedFiles(existing);
  }, []);

  return {
    uploadedFiles,
    handleFileUpload,
    handleFileDrop,
    removeFile,
    clearFiles,
    initWithExisting,
  };
}

