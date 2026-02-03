"use client";

import React, { Component, ReactNode } from 'react';
import { logger } from '@/lib/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global Error Boundary Component
 * Catches React errors and prevents app crashes
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error details (sanitized in production)
    logger.error('Error boundary caught an error:', {
      error: error.message,
      componentStack: errorInfo.componentStack,
      stack: error.stack,
    });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Report to error tracking service (e.g., Sentry)
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      // Example: Sentry.captureException(error, { extra: errorInfo });
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '400px',
            padding: '20px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: '48px',
              marginBottom: '16px',
            }}
          >
            ⚠️
          </div>
          <h2
            style={{
              fontSize: '24px',
              fontWeight: '600',
              marginBottom: '8px',
              color: '#111',
            }}
          >
            Something went wrong
          </h2>
          <p
            style={{
              fontSize: '14px',
              color: '#666',
              marginBottom: '24px',
              maxWidth: '500px',
            }}
          >
            An unexpected error occurred. Please try again or contact support if the problem persists.
          </p>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details
              style={{
                marginBottom: '24px',
                padding: '12px',
                background: '#f5f5f5',
                borderRadius: '8px',
                textAlign: 'left',
                maxWidth: '600px',
                width: '100%',
              }}
            >
              <summary style={{ cursor: 'pointer', fontWeight: '500' }}>
                Error Details (Development Only)
              </summary>
              <pre
                style={{
                  marginTop: '12px',
                  fontSize: '12px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {this.state.error.message}
                {'\n\n'}
                {this.state.error.stack}
              </pre>
            </details>
          )}
          <button
            onClick={this.handleReset}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#fff',
              backgroundColor: '#0070f3',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Streaming Error Boundary
 * Specialized for handling streaming response errors
 */
export class StreamingErrorBoundary extends ErrorBoundary {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    super.componentDidCatch(error, errorInfo);
    
    // Additional logging for streaming errors
    logger.error('Streaming error boundary caught an error', {
      error: error.message,
      type: 'streaming',
    });
  }
}
