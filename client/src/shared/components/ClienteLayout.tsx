import { Outlet } from 'react-router-dom';
import { ClienteHeader } from './ClienteHeader';

export function ClienteLayout() {
  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <ClienteHeader />
      <main>
        <Outlet />
      </main>
    </div>
  );
}