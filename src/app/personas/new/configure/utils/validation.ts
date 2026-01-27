/**
 * Validation utilities for persona configuration
 * Production-ready validation with proper error messages
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates persona name
 */
export function validatePersonaName(name: string): ValidationResult {
  const errors: string[] = [];

  if (!name || name.trim().length === 0) {
    errors.push('Persona name is required');
  } else if (name.trim().length < 2) {
    errors.push('Persona name must be at least 2 characters');
  } else if (name.length > 100) {
    errors.push('Persona name must be less than 100 characters');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates system instruction
 */
export function validateSystemInstruction(instruction: string): ValidationResult {
  const errors: string[] = [];

  if (!instruction || instruction.trim().length === 0) {
    errors.push('System instruction is required');
  } else if (instruction.length > 10000) {
    errors.push('System instruction must be less than 10,000 characters');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates temperature value
 */
export function validateTemperature(temperature: number): ValidationResult {
  const errors: string[] = [];

  if (temperature < 0 || temperature > 1) {
    errors.push('Temperature must be between 0 and 1');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates selected model
 */
export function validateModel(selectedModel: string): ValidationResult {
  const errors: string[] = [];

  if (!selectedModel || selectedModel.trim().length === 0) {
    errors.push('Please select a model');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates entire persona configuration
 */
export interface PersonaConfig {
  personaName: string;
  selectedModel: string;
  systemInstruction: string;
  temperature: number;
}

export function validatePersonaConfig(config: PersonaConfig): ValidationResult {
  const errors: string[] = [];

  const nameValidation = validatePersonaName(config.personaName);
  const modelValidation = validateModel(config.selectedModel);
  const instructionValidation = validateSystemInstruction(config.systemInstruction);
  const temperatureValidation = validateTemperature(config.temperature);

  errors.push(
    ...nameValidation.errors,
    ...modelValidation.errors,
    ...instructionValidation.errors,
    ...temperatureValidation.errors
  );

  return {
    isValid: errors.length === 0,
    errors,
  };
}

