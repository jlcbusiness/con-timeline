import React from 'react';
import { Timeline } from './components/Timeline';
import { AuthGate } from './components/AuthGate';
import { LoginPage } from './components/LoginPage';
import { useSupabaseSession } from './hooks/useSupabaseSession';

const App: React.FC = () => {
  const { user, isLoading, supabase } = useSupabaseSession();
  const [pathname, setPathname] = React.useState(() => window.location.pathname);

  React.useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  React.useEffect(() => {
    if (isLoading) return;
    if (!supabase) return;

    if (user && pathname === '/login') {
      window.history.replaceState({}, '', '/');
      setPathname('/');
      return;
    }

    if (!user && pathname !== '/login') {
      window.history.replaceState({}, '', '/login');
      setPathname('/login');
    }
  }, [isLoading, pathname, supabase, user]);

  if (isLoading) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  if (!supabase) {
    return <LoginPage />;
  }

  if (pathname === '/login') {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AuthGate>
        <Timeline />
      </AuthGate>
    </div>
  );
};

export default App;
