import { Link } from 'react-router-dom';
import { Brand } from '../../../shared/components/Landing';

export function NoEncontrado() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
      <header className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12 py-6">
        <Brand />
      </header>
      <main className="flex-1 flex flex-col items-center justify-center text-center px-5 pb-20">
        <p className="text-[clamp(5rem,20vw,10rem)] font-black leading-none tracking-[-0.075em] text-[#8B2EFF]">
          404
        </p>
        <h1 className="mt-4 text-2xl md:text-3xl font-extrabold tracking-tight text-[#0A0A0A]">
          Esta página no existe
        </h1>
        <p className="mt-2 text-sm text-black/55 max-w-sm">
          La dirección que buscaste no corresponde a ninguna pantalla de FitZone Sports.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#8B2EFF] px-8 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#7720E6]"
          style={{ minHeight: 44 }}
        >
          Volver al inicio
        </Link>
      </main>
    </div>
  );
}
