import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { DarkModeProvider, useDarkMode } from './contexts/DarkModeContext';
import { secureLog } from './lib/secureLog';
import { Toaster } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';

function AppContent() {
  const { isDarkMode } = useDarkMode();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // NOTE: Database schema/seed bootstrap intentionally removed.
    // The old code called unauthenticated DDL/seed/migration endpoints on every
    // fresh client load — a critical vulnerability (anyone could run schema
    // changes or create pre-approved admin accounts). Schema setup is now a
    // one-time server-side operation gated behind a super-admin session.
    const token = localStorage.getItem('lgu_session_token');

    if (token) {
      secureLog.session('🔍 Checking session token', token);
      const validateSession = async () => {
        try {
          const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-c5b85875/me`, {
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'X-Session-Token': token,
            },
          });

          if (!res.ok) {
            secureLog.session('❌ Session invalid, clearing token');
            localStorage.removeItem('lgu_session_token');
            sessionStorage.setItem('sessionExpired', 'true');
          } else {
            secureLog.success('✅ Session valid');
          }
        } catch (error) {
          secureLog.session('⚠️ Session validation failed, clearing token');
          localStorage.removeItem('lgu_session_token');
        }
      };
      validateSession();
    }

    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground font-bold tracking-widest uppercase">Initializing Vault...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <RouterProvider router={router} />
      <Toaster
        position="top-right"
        theme={isDarkMode ? 'dark' : 'light'}
        richColors
        closeButton
        expand={false}
        duration={4000}
      />
    </>
  );
}

function App() {
  return (
    <DarkModeProvider>
      <AppContent />
    </DarkModeProvider>
  );
}

export default App;
