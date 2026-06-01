'use client'

/**
 * BrainContentRenderer — thin wrapper around ContentRenderer.
 * ContentRenderer splits content into segments (markdown / table / chart)
 * and delegates to the appropriate component. This ensures HTML <table>
 * blocks from the AI render as styled tables instead of raw text.
 */

export { ContentRenderer as BrainContentRenderer } from '@/lib/content-renderer'
