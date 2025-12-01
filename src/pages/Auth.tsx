import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LogIn, UserPlus } from "lucide-react";
import { PWAInstallGate } from "@/components/PWAInstallGate";
import { isPWAInstalled, hasUserSignedUp, markUserSignedUp } from "@/utils/pwaDetection";

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check if PWA is installed
  const isPWA = isPWAInstalled();

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Check if setup has been completed
        const setupComplete = localStorage.getItem('kaizen-setup-complete');
        if (setupComplete) {
          navigate("/");
        } else {
          navigate("/setup");
        }
      }
    });

    // Set default view based on signup history
    // If user has signed up before on this device, default to login
    if (hasUserSignedUp()) {
      setIsLogin(true);
    }
  }, [navigate]);

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

        toast({
          title: "Welcome back!",
          description: "You've successfully logged in.",
        });
        
        // Check if setup has been completed
        const setupComplete = localStorage.getItem('kaizen-setup-complete');
        if (setupComplete) {
          navigate("/");
        } else {
          navigate("/setup");
        }
      } else {
        // Sign up
        if (!name.trim()) {
          toast({
            title: "Name required",
            description: "Please enter your name to continue.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        const redirectUrl = `${window.location.origin}/`;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              name: name,
            },
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

        toast({
          title: "Account created!",
          description: "Welcome to Kaizen. Setting up your account...",
        });
        
        // New accounts always need setup
        navigate("/setup");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An error occurred during authentication.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Show PWA install gate if not installed
  if (!isPWA) {
    return <PWAInstallGate />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl font-bold text-primary">K</span>
          </div>
          <CardTitle className="text-2xl font-bold">
            {isLogin ? "Welcome Back" : "Join Kaizen"}
          </CardTitle>
          <CardDescription>
            {isLogin
              ? "Log in to continue your sales journey"
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
                  Use the same email from your onboarding process
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

          <div className="mt-6 text-center text-sm">
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary hover:underline font-medium"
                disabled={isLoading}
              >
                {isLogin
                  ? "Don't have an account? Sign up"
                  : "Already have an account? Log in"}
              </button>
              {isLogin && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => navigate("/forgot-password")}
                    className="text-sm text-muted-foreground hover:text-primary hover:underline"
                    disabled={isLoading}
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
