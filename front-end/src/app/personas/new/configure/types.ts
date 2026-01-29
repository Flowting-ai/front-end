/**
 * Types and interfaces for Persona Configuration
 */

export interface UploadedFile {
  id: string;
  type: 'pdf' | 'image';
  name: string;
  url: string;
  file: File;
  isUploading?: boolean;
  uploadProgress?: number;
}

export interface PersonaModel {
  value: string;
  label: string;
  company: string;
}

export interface RefinementStep {
  step: number;
  title: string;
  subtitle?: string;
}

export const REFINEMENT_STEPS = {
  TONE: 1,
  DOS: 2,
  DONTS: 3,
} as const;

export type RefinementStepType = typeof REFINEMENT_STEPS[keyof typeof REFINEMENT_STEPS];

