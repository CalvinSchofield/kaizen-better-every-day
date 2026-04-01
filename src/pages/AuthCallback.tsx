import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

/**
 * Handles auth callbacks from email links (password reset, email confirmation, etc.)
 * Supports both PKCE flow (?code=xxx) and implicit flow (#access_token=xxx).
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'error'>('processing');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // 1. PKCE flow: code is in query params
        const code = searchParams.get('code');
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error('PKCE exchange error:', error);
            setStatus('error');
            setTimeout(() => navigate('/auth', { replace: true }), 2000);
            return;
          }

          // Check if this was a password recovery flow
          // After PKCE exchange for recovery, the session is set and we need to show the reset form
          // We detect recovery by checking the URL's original type or the session event
          const type = searchParams.get('type');
          if (type === 'recovery') {
            navigate('/auth?recovery=true', { replace: true });
            return;
          }

          // For signup confirmations or other flows, go home
          navigate('/', { replace: true });
          return;
        }

        // 2. Implicit/hash flow: tokens are in the URL hash
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');
        
        const error = hashParams.get('error');
        const errorDescription = hashParams.get('error_description');
        
        if (error) {
          console.error('Auth callback error:', error, errorDescription);
          setStatus('error');
          setTimeout(() => navigate('/auth', { replace: true }), 2000);
          return;
        }

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            console.error('Session error:', sessionError);
            setStatus('error');
            setTimeout(() => navigate('/auth', { replace: true }), 2000);
            return;
          }

          if (type === 'recovery') {
            navigate('/auth?recovery=true', { replace: true });
            return;
          }

          navigate('/', { replace: true });
        } else {
          // No tokens or code — redirect to auth
          navigate('/auth', { replace: true });
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setStatus('error');
        setTimeout(() => navigate('/auth', { replace: true }), 2000);
      }
    };

    handleCallback();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="text-center">
        {status === 'processing' ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Processing...</p>
          </>
        ) : (
          <>
            <p className="text-destructive mb-2">Something went wrong</p>
            <p className="text-sm text-muted-foreground">Redirecting to login...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
