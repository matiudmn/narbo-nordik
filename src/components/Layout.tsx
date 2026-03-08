import { Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Header from './Header';
import BottomNav from './BottomNav';

export default function Layout() {
  const { isImpersonating } = useAuth();

  return (
    <div className="min-h-screen bg-surface">
      <Header />
      <main className={`${isImpersonating ? 'pt-[5.5rem]' : 'pt-14'} pb-20 px-4 max-w-5xl mx-auto`}>
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
