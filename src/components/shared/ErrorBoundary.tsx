'use client';

import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="min-h-screen bg-[var(--background-dark)] flex items-center justify-center px-4">
            <div className="max-w-md w-full">
              <div className="gradient-border p-8 bg-[var(--background-light)]">
                <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
                <p className="text-[var(--text-secondary)] mb-6">
                  {this.state.error?.message || 'An unexpected error occurred'}
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="gradient-border glow px-6 py-3 bg-[var(--background-light)] text-sm font-medium hover:bg-[var(--background-dark)] transition-colors w-full"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
