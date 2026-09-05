'use client'

import React from 'react'

interface IconErrorBoundaryState {
  hasError: boolean
}

// Catches a render-time crash from an icon component that doesn't exist in
// whatever build of @strange-huge/icons actually got installed (it's a
// private git dependency with no version pin in package.json — staging/prod
// have previously resolved a different commit than local and hit missing
// exports), and swaps in a known-safe icon instead of taking down the whole
// sidebar.
class IconErrorBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, IconErrorBoundaryState> {
  state: IconErrorBoundaryState = { hasError: false }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}

export function IconWithFallback({ icon, fallback }: { icon: React.ReactNode; fallback: React.ReactNode }) {
  return <IconErrorBoundary fallback={fallback}>{icon}</IconErrorBoundary>
}
