import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
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
    console.error('Uncaught component error in StorePrint:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6" dir="rtl">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-lg w-full text-center shadow-2xl">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-400">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-white mb-2">
              {this.props.fallbackTitle || 'אירעה שגיאה בטעינת הרכיב'}
            </h3>
            <p className="text-sm text-slate-400 mb-6">
              המערכת זיהתה שגיאה זמנית וטעינת המסך נכשלה. כל הנתונים השמורים בטוחים.
            </p>
            {this.state.error?.message && (
              <div className="bg-slate-950 p-3 rounded-xl text-xs text-red-400 font-mono mb-6 overflow-x-auto text-left" dir="ltr">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={this.handleReset}
              className="bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold px-6 py-3 rounded-2xl shadow-lg flex items-center justify-center gap-2 mx-auto transition-all active:scale-95 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>רענון וטעינה מחדש</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
