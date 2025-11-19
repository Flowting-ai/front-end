'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FileUploadProps {
  onFileSelect: (file: File | null) => void;
}

export function FileUpload({ onFileSelect }: FileUploadProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'image/jpeg': [],
      'image/png': [],
      'image/svg+xml': [],
      'application/zip': [],
      'application/pdf': [],
      'text/plain': [],
      'application/msword': [],
      'text/markdown': [],
    },
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
        isDragActive ? 'border-primary bg-primary/10' : 'border-input hover:border-primary'
      }`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <UploadCloud className="w-10 h-10" />
        <p>Click to upload or drag and drop</p>
        <p className="text-xs">PDF, TXT, DOC, MD below 10MB each</p>
        <div className="relative flex items-center justify-center w-full my-2">
            <div className="flex-grow border-t"></div>
            <span className="flex-shrink mx-4 text-xs">OR</span>
            <div className="flex-grow border-t"></div>
        </div>
        <Button variant="outline" type="button" onClick={(e) => e.stopPropagation()}>Browse files</Button>
      </div>
    </div>
  );
}
