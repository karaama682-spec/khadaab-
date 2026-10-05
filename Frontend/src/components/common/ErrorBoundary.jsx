import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-900 text-slate-100">
          <div className="max-w-md w-full bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <AlertTriangle size={28} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Waxbaa qaldamay (Something went wrong)</h2>
              <p className="text-xs text-slate-400 mt-1">
                Fadlan dib u cusboonaysii bogga si aad u sii wadato.
              </p>
            </div>
            {this.state.error?.message && (
              <div className="text-[11px] font-mono text-rose-300 bg-rose-950/40 border border-rose-900/50 p-2.5 rounded-xl text-left overflow-auto max-h-24">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={this.handleReload}
              className="inline-flex items-center justify-center gap-2 w-full px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-lg shadow-brand-500/20"
            >
              <RotateCcw size={14} />
              Dib u cusboonaysii (Reload)
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
