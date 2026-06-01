'use client'

/**
 * BrainContentRenderer — thin wrapper around the shared LineRenderer.
 * LineRenderer is the single implementation used across all chat surfaces:
 * regular chat, persona chat, reasoning blocks, and Brain.
 */

export { LineRenderer as BrainContentRenderer } from '@/lib/line-renderer'
