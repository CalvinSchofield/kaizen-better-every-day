import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

/**
 * Handles auth callbacks from email links (password reset, email confirmation, etc.)
 * This page processes the token in the URL hash before redirecting to the appropriate page.
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'error'>('processing');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the hash fragment from the URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');
        
        // Also check for error in hash
        const error = hashParams.get('error');
        const errorDescription = hashParams.get('error_description');
        
        if (error) {
          console.error('Auth callback error:', error, errorDescription);
          setStatus('error');
          setTimeout(() => navigate('/auth', { replace: true }), 2000);
          return;
        }

        if (accessToken && refreshToken) {
          // Set the session from the tokens
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

          // Check if this is a password recovery
          if (type === 'recovery') {
            // Navigate to auth page with recovery state
            navigate('/auth?recovery=true', { replace: true });
            return;
          }

          // For other types (signup confirmation, etc.), check setup status
          const setupComplete = localStorage.getItem('kaizen-setup-complete');
          if (setupComplete) {
            navigate('/', { replace: true });
          } else {
            navigate('/setup', { replace: true });
          }
        } else {
          // No tokens in URL, might be using code-based flow
          // Let the auth page handle it
          navigate('/auth', { replace: true });
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setStatus('error');
        setTimeout(() => navigate('/auth', { replace: true }), 2000);
      }
    };

    handleCallback();
  }, [navigate]);

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
