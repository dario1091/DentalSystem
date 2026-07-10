import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-gray-50">
          <div className="mx-4 w-full max-w-md rounded-xl border border-red-200 bg-white p-8 text-center shadow-lg">
            <div className="mb-4 text-5xl">⚠️</div>
            <h1 className="mb-2 text-xl font-bold text-gray-800">
              Algo salió mal
            </h1>
            <p className="mb-4 text-sm text-gray-500">
              Ha ocurrido un error inesperado. Puede intentar recuperar la aplicación o reiniciarla.
            </p>
            {this.state.error && (
              <details className="mb-4 rounded bg-gray-100 p-3 text-left">
                <summary className="cursor-pointer text-xs font-medium text-gray-600">
                  Detalles técnicos
                </summary>
                <pre className="mt-2 overflow-auto text-xs text-red-600">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <div className="flex justify-center gap-3">
              <button
                onClick={this.handleReset}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Intentar de nuevo
              </button>
              <button
                onClick={this.handleReload}
                className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
              >
                Reiniciar app
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
