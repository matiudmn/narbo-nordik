import { Outlet } from 'react-router-dom';
import Header from './Header';
import BottomNav from './BottomNav';

export default function Layout() {
  return (
    <div className="min-h-screen bg-surface">
      <Header />
      <main className="pt-14 pb-20 px-4 max-w-5xl mx-auto">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
