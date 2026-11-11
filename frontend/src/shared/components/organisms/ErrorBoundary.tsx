import { Component, type ErrorInfo, type ReactNode } from 'react';
import { mensajeDeErrorInesperado, primerasLineas } from '../../utils/errores';

interface Props {
  children: ReactNode;
  // Si cambia (p. ej. la ruta), se descarta el error y se vuelve a intentar.
  resetKey?: string;
}

interface State {
  error: Error | null;
  componentStack: string | null;
  // Cambia en cada reintento: remonta los hijos con estado limpio.
  intento: number;
}

// Sin esto, un error de render desmonta toda la app y queda la pantalla en blanco.
// Muestra qué falló (message y primeras líneas del componentStack) para poder
// diagnosticar desde un celular, sin abrir la consola.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null, intento: 0 };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error: error instanceof Error ? error : new Error(mensajeDeErrorInesperado(error)) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Error de render:', error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  componentDidUpdate(previas: Props) {
    if (this.state.error && previas.resetKey !== this.props.resetKey) this.reintentar();
  }

  reintentar = () => {
    this.setState((s) => ({ error: null, componentStack: null, intento: s.intento + 1 }));
  };

  render() {
    const { error, componentStack, intento } = this.state;
    if (!error) return <div key={intento} style={{ display: 'contents' }}>{this.props.children}</div>;

    return (
      <main
        role="alert"
        className="glass panel"
        style={{ maxWidth: 560, margin: '24px auto', padding: 20, position: 'relative', zIndex: 1 }}
      >
        <h2 style={{ marginBottom: 8 }}>Ocurrió un error en esta pantalla</h2>
        <p style={{ marginBottom: 14 }}>
          Podés volver a intentar o recargar la página. Si se repite, avisá al equipo con el detalle de abajo.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <button type="button" className="btn btn-primary" onClick={this.reintentar}>
            Volver a intentar
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => window.location.reload()}>
            Recargar
          </button>
        </div>
        <pre
          data-testid="detalle-error"
          style={{ fontSize: 10, lineHeight: 1.4, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', opacity: 0.8, margin: 0 }}
        >
          {error.message || error.name}
          {componentStack ? `\n${primerasLineas(componentStack, 5)}` : ''}
        </pre>
      </main>
    );
  }
}
