"use client"

import React from "react"

interface BlockErrorBoundaryProps {
  children: React.ReactNode
  /** What the block is, for the fallback text ("chart", "diagram"…). */
  label?: string
  /** Rendered instead of the inline notice when given (null renders nothing). */
  fallback?: React.ReactNode
  /** When this changes after an error, the block renders its children again. */
  resetKey?: unknown
}

interface BlockErrorBoundaryState {
  hasError: boolean
}

/**
 * Isolates one rendered block (widget, chart, diagram, code) so a render error
 * in it shows a small inline notice instead of tripping the page-level
 * ErrorBoundary and blanking the whole conversation.
 */
export class BlockErrorBoundary extends React.Component<BlockErrorBoundaryProps, BlockErrorBoundaryState> {
  state: BlockErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): BlockErrorBoundaryState {
    return { hasError: true }
  }

  componentDidUpdate(prev: BlockErrorBoundaryProps) {
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) this.setState({ hasError: false })
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[BlockErrorBoundary] Block render error", error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) return this.props.fallback
      return (
        <p
          role="note"
          style={{ margin: "12px 0", fontFamily: "var(--font-body)", fontSize: 13, lineHeight: "20px", color: "var(--neutral-600)" }}
        >
          Couldn&apos;t display this {this.props.label ?? "block"}.
        </p>
      )
    }
    return this.props.children
  }
}
