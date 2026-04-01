import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LogIn, UserPlus, KeyRound } from "lucide-react";
import { PWAInstallGate } from "@/components/PWAInstallGate";
import { isPWAInstalled, hasUserSignedUp, markUserSignedUp, shouldBypassPWAGate } from "@/utils/pwaDetection";
import { hapticLight, hapticSuccess, hapticError } from "@/utils/haptics";

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  // Capture invite code from URL
  const inviteCode = searchParams.get('invite');
  const [isLateralInvite, setIsLateralInvite] = useState(false);
  
  // If invite code present, default to signup mode and check invite type
  useEffect(() => {
    if (inviteCode) {
      setIsLogin(false);
      sessionStorage.setItem('kaizen-invite-code', inviteCode);
      
      // Look up invite type
      supabase
        .from('invite_codes')
        .select('invite_type')
        .eq('code', inviteCode)
        .eq('is_active', true)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.invite_type === 'lateral') {
            setIsLateralInvite(true);
          }
        });
    }
  }, [inviteCode]);

  // Check if PWA is installed
  const isPWA = isPWAInstalled();
  
  // Check if coming from password recovery callback
  const isRecoveryFromCallback = searchParams.get('recovery') === 'true';

  useEffect(() => {
    // If coming from callback with recovery flag, set password reset mode
    if (isRecoveryFromCallback) {
      setIsPasswordReset(true);
      return; // Don't check session or redirect
    }
    
    // Listen for auth state changes to detect password recovery
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordReset(true);
      } else if (event === 'SIGNED_IN' && session && !isPasswordReset && !isRecoveryFromCallback) {
        const setupComplete = localStorage.getItem('kaizen-setup-complete');
        if (setupComplete) {
          navigate("/");
        } else {
          navigate("/setup");
        }
      }
    });

    // Check if user is already logged in (but not if we're doing password reset)
    if (!isRecoveryFromCallback) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session && !isPasswordReset) {
          const setupComplete = localStorage.getItem('kaizen-setup-complete');
          if (setupComplete) {
            navigate("/");
          } else {
            navigate("/setup");
          }
        }
      });
    }

    return () => subscription.unsubscribe();

    // Set default view based on signup history
    if (hasUserSignedUp()) {
      setIsLogin(true);
    }

    return () => subscription.unsubscribe();
  }, [navigate, isPasswordReset]);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      toast({
        title: "Password updated!",
        description: "Your password has been successfully changed.",
      });

      setIsPasswordReset(false);
      setPassword("");
      setConfirmPassword("");
      
      // Redirect to home
      const setupComplete = localStorage.getItem('kaizen-setup-complete');
      if (setupComplete) {
        navigate("/");
      } else {
        navigate("/setup");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update password.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        // Login
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        hapticSuccess();
        // Welcome message will show on the loading screen instead
        
        // Check if setup has been completed
        const setupComplete = localStorage.getItem('kaizen-setup-complete');
        if (setupComplete) {
          navigate("/");
        } else {
          navigate("/setup");
        }
      } else {
        // Sign up — require invite code
        if (!inviteCode) {
          toast({
            title: "Invite required",
            description: "You need an invite link from your team leader to sign up.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

          toast({
            title: "Name required",
            description: "Please enter your name to continue.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        // Validate email domain to catch common typos
        const emailDomain = email.split('@')[1]?.toLowerCase() || '';
        const commonTLDTypos: Record<string, string> = {
          'con': 'com', 'cmo': 'com', 'ocm': 'com', 'comm': 'com', 'co': 'com',
          'nte': 'net', 'ent': 'net', 'nett': 'net',
          'ogr': 'org', 'oeg': 'org',
          'edu': null as unknown as string, // valid
          'gmai.com': null as unknown as string, // catch missing 'l'
        };
        const tld = emailDomain.split('.').pop() || '';
        const suggestedTLD = commonTLDTypos[tld];
        
        // Also check for common domain typos
        const commonDomainTypos: Record<string, string> = {
          'gmai.com': 'gmail.com', 'gmial.com': 'gmail.com', 'gamil.com': 'gmail.com',
          'gmal.com': 'gmail.com', 'gmil.com': 'gmail.com', 'gmail.co': 'gmail.com',
          'gmail.con': 'gmail.com', 'gmail.cmo': 'gmail.com',
          'yahooo.com': 'yahoo.com', 'yaho.com': 'yahoo.com',
          'hotmal.com': 'hotmail.com', 'hotmai.com': 'hotmail.com',
          'outlok.com': 'outlook.com', 'outloo.com': 'outlook.com',
          'icloud.con': 'icloud.com', 'icloud.cmo': 'icloud.com',
        };
        const suggestedDomain = commonDomainTypos[emailDomain];

        if (suggestedDomain) {
          const correctedEmail = email.split('@')[0] + '@' + suggestedDomain;
          toast({
            title: "Check your email",
            description: `Did you mean ${correctedEmail}? "${emailDomain}" looks like a typo.`,
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        if (suggestedTLD) {
          toast({
            title: "Check your email",
            description: `Your email ends in ".${tld}" — did you mean ".${suggestedTLD}"?`,
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        // Basic format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
        if (!emailRegex.test(email)) {
          toast({
            title: "Invalid email",
            description: "Please enter a valid email address.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        const redirectUrl = `${window.location.origin}/`;
        const signupMetadata: Record<string, string> = { name };
        if (inviteCode) {
          signupMetadata.invite_code = inviteCode;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: signupMetadata,
          },
        });

        if (error) {
          // Check if user already exists
          if (error.message.toLowerCase().includes("already registered") || 
              error.message.toLowerCase().includes("already exists")) {
            setIsLogin(true);
            toast({
              title: "Account already exists",
              description: "Switching you to login. Please sign in with your existing account.",
              variant: "default",
            });
            setIsLoading(false);
            return;
          }
          throw error;
        }

        // Mark that user has signed up on this device
        markUserSignedUp();

        hapticSuccess();
        toast({
          title: "Account created!",
          description: "Welcome to Kaizen. Setting up your account...",
        });
        
        // New accounts always need setup
        navigate("/setup");
      }
    } catch (error: any) {
      hapticError();
      toast({
        title: "Error",
        description: error.message || "An error occurred during authentication.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Password reset form
  if (isPasswordReset) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <KeyRound className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">Set New Password</CardTitle>
            <CardDescription>
              Enter your new password below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  minLength={6}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <KeyRound className="mr-2 h-4 w-4" />
                    Update Password
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl font-bold text-primary">K</span>
          </div>
          <CardTitle className="text-2xl font-bold">
            {isLogin ? "Welcome Back" : inviteCode ? "You've Been Invited!" : "Join Kaizen"}
          </CardTitle>
          <CardDescription>
            {isLogin
              ? "Log in to continue your sales journey"
              : inviteCode
                ? "Create your account to join your team"
                : "Create your account to get started"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={!isLogin}
                  disabled={isLoading}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
              {!isLogin && (
                <p className="text-xs text-muted-foreground">
                  {isLateralInvite 
                    ? "Use your Vivint email address" 
                    : "Use the same email from your onboarding process"}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                minLength={6}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Please wait...
                </>
              ) : isLogin ? (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Log In
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Sign Up
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <div className="space-y-3">
              {isLogin ? (
                <>
                  {inviteCode ? (
                    <div className="bg-primary/10 rounded-lg p-3 border border-primary/20">
                      <p className="text-sm text-muted-foreground mb-1">New to Kaizen?</p>
                      <button
                        type="button"
                        onClick={() => setIsLogin(false)}
                        className="text-primary hover:underline font-semibold text-base"
                        disabled={isLoading}
                      >
                        Create an account →
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Need an account? Ask your team leader for an invite link.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate("/forgot-password")}
                    className="text-sm text-muted-foreground hover:text-primary hover:underline"
                    disabled={isLoading}
                  >
                    Forgot password?
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsLogin(true)}
                  className="text-primary hover:underline font-medium text-sm"
                  disabled={isLoading}
                >
                  Already have an account? Log in
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
