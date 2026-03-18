import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
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
        <div className="min-h-screen bg-black flex items-center justify-center p-6 text-center">
          <div className="max-w-md space-y-6">
            <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto border border-red-500/20">
              <span className="text-4xl">⚠️</span>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter">System Error</h1>
              <p className="text-zinc-500 text-sm">
                Something went wrong. Please try refreshing the app or contact support if the issue persists.
              </p>
            </div>
            <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800 text-left overflow-hidden">
              <p className="text-[10px] font-mono text-red-400 break-all">
                {this.state.error?.message}
              </p>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-white text-black font-bold py-4 rounded-2xl hover:bg-zinc-200 transition-colors"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
