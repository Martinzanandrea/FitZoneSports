import { Outlet } from 'react-router-dom';
import { Footer, SiteHeader } from './Landing';

// Layout público compartido (header + footer del diseño Figma) para
// la landing y las páginas públicas: /, /clases, /canchas, /sedes, /nosotros.
export function PublicLayout() {
  return (
    <main className="min-h-screen bg-[#FAFAFA] text-[#0A0A0A]">
      <SiteHeader />
      <Outlet />
      <Footer />
    </main>
  );
}
