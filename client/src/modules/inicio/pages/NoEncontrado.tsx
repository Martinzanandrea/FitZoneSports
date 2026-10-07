import { Link } from 'react-router-dom';
import { ArrowIcon, PublicShell } from '../../../shared/components/Landing';
import { useTitulo } from '../../../shared/hooks/useTitulo';

export function NoEncontrado() {
  useTitulo('Página no encontrada');

  return (
    <PublicShell>
      <section className="lp-wrap lp-404">
        <p aria-hidden="true" className="lp-404-num">
          404
        </p>
        <h1 className="lp-h2">Esta página no existe</h1>
        <p className="lp-lead">
          La dirección que buscaste no corresponde a ninguna pantalla de FitZone Sports.
        </p>
        <Link className="lp-btn lp-btn-primary" to="/">
          Volver al inicio
          <ArrowIcon />
        </Link>
      </section>
    </PublicShell>
  );
}
