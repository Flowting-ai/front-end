'use server';
/**
 * @fileOverview A simple chat flow that responds to user prompts.
 *
 * - chat - A function that takes a user prompt and returns an AI-generated response.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const ChatInputSchema = z.string();
const ChatOutputSchema = z.string();

export async function chat(prompt: z.infer<typeof ChatInputSchema>): Promise<z.infer<typeof ChatOutputSchema>> {
  return chatFlow(prompt);
}

const chatFlow = ai.defineFlow(
  {
    name: 'chatFlow',
    inputSchema: ChatInputSchema,
    outputSchema: ChatOutputSchema,
  },
  async prompt => {
    const llmResponse = await ai.generate({
      prompt: prompt,
    });

    return llmResponse.text;
  }
);
