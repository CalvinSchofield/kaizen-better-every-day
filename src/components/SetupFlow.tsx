import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, AlertCircle, UserX, Mail, LogOut } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SetupStep {
  name: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  description: string;
}

const SetupFlow = () => {
  const navigate = useNavigate();
  const [steps, setSteps] = useState<SetupStep[]>([
    { name: 'Syncing your profile', status: 'pending', description: 'Loading your data from Notion' },
    { name: 'Loading competitors', status: 'pending', description: 'Downloading competitor information' },
    { name: 'Fetching blitz schedule', status: 'pending', description: 'Getting upcoming blitz dates' },
    { name: 'Loading team access', status: 'pending', description: 'Checking your team permissions' },
    { name: 'Loading team attendance', status: 'pending', description: 'Fetching blitz attendance data' },
    { name: 'Preparing your data', status: 'pending', description: 'Setting up your tracking' },
  ]);
  const [currentStep, setCurrentStep] = useState(0);
  const [canContinue, setCanContinue] = useState(false);
  const [notInNotion, setNotInNotion] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    runSetup();
  }, []);

  const updateStep = (index: number, status: SetupStep['status']) => {
    setSteps(prev => prev.map((step, i) => 
      i === index ? { ...step, status } : step
    ));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const runSetup = async () => {
    try {
      // Step 1: Sync rep data from Notion
      setCurrentStep(0);
      updateStep(0, 'loading');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      setUserEmail(user.email || null);

      // Check if rep data exists
      const { data: existingRep } = await supabase
        .from('reps')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!existingRep) {
        // Try syncing from Notion
        await supabase.functions.invoke('sync-notion-reps');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for sync
        
        // Check again if rep was created after sync
        const { data: repAfterSync } = await supabase
          .from('reps')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (!repAfterSync) {
          // User is not in Notion database - show request access screen
          console.log('User not found in Notion after sync');
          setNotInNotion(true);
          updateStep(0, 'error');
          return; // Stop setup flow
        }
      }
      
      updateStep(0, 'success');

      // Step 2: Load and cache competitors
      setCurrentStep(1);
      updateStep(1, 'loading');
      
      const { data: competitors, error: competitorFetchError } = await supabase
        .from('competitors')
        .select('*')
        .order('name', { ascending: true });

      console.log('Initial competitors fetch:', { count: competitors?.length, error: competitorFetchError });

      if (!competitors || competitors.length === 0) {
        console.log('No competitors found, syncing from Notion...');
        
        // Sync from Notion if no competitors
        const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-notion-competitors');
        
        console.log('Sync response:', { syncData, syncError });
        
        if (syncError) {
          console.error('Competitor sync error:', syncError);
          updateStep(1, 'error');
        } else {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait longer for sync
          
          // Refetch after sync
          const { data: syncedCompetitors, error: refetchError } = await supabase
            .from('competitors')
            .select('*')
            .order('name', { ascending: true });
          
          console.log('After sync competitors:', { count: syncedCompetitors?.length, error: refetchError });
          
          if (syncedCompetitors && syncedCompetitors.length > 0) {
            localStorage.setItem('competitors-cache', JSON.stringify({
              data: syncedCompetitors,
              timestamp: Date.now()
            }));
            updateStep(1, 'success');
          } else {
            console.warn('No competitors after sync, but continuing...');
            updateStep(1, 'error');
          }
        }
      } else {
        // Cache existing data
        console.log('Caching existing competitors:', competitors.length);
        localStorage.setItem('competitors-cache', JSON.stringify({
          data: competitors,
          timestamp: Date.now()
        }));
        updateStep(1, 'success');
      }

      // Step 3: Fetch blitzes
      setCurrentStep(2);
      updateStep(2, 'loading');
      
      const { data: blitzData, error: blitzError } = await supabase.functions.invoke('fetch-preseason-blitzes');
      
      if (blitzData?.blitzes) {
        localStorage.setItem('blitzes-cache', JSON.stringify({
          data: blitzData.blitzes,
          timestamp: Date.now()
        }));
      }
      
      updateStep(2, blitzError ? 'error' : 'success');

      // Step 4: Fetch team access (for leadership features)
      setCurrentStep(3);
      updateStep(3, 'loading');
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          const { data: teamAccessData, error: teamAccessError } = await supabase.functions.invoke('fetch-team-access', {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });
          
          if (teamAccessData) {
            localStorage.setItem('team-access-cache', JSON.stringify({
              data: teamAccessData,
              timestamp: Date.now()
            }));
          }
          
          updateStep(3, teamAccessError ? 'error' : 'success');
        } else {
          updateStep(3, 'error');
        }
      } catch (error) {
        console.error('Team access fetch error:', error);
        updateStep(3, 'error');
      }

      // Step 5: Fetch blitz attendance for leaders
      setCurrentStep(4);
      updateStep(4, 'loading');
      
      try {
        const { data: repData } = await supabase
          .from('reps')
          .select('notion_page_id')
          .eq('user_id', user.id)
          .single();
        
        if (repData?.notion_page_id) {
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session) {
            // Fetch for team scope by default
            const { data: attendanceData } = await supabase.functions.invoke('fetch-blitz-attendance', {
              body: {
                scope: 'team',
                leaderNotionPageId: repData.notion_page_id,
              },
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            });
            
            // Cache attendance data
            if (attendanceData) {
              localStorage.setItem('blitz-attendance-cache', JSON.stringify({
                data: attendanceData,
                timestamp: Date.now()
              }));
            }
          }
        }
        
        updateStep(4, 'success');
      } catch (error) {
        console.error('Attendance fetch error:', error);
        updateStep(4, 'error');
      }

      // Step 6: Initialize daily entry for today
      setCurrentStep(5);
      updateStep(5, 'loading');
      
      const today = new Date().toISOString().split('T')[0];
      await supabase
        .from('daily_entries')
        .upsert({
          user_id: user.id,
          entry_date: today,
          doors_knocked: 0,
          decision_makers: 0,
          pitches: 0,
          transitions: 0,
          presentations: 0,
          closes: 0,
          fp_plus: 0,
          prmr: 0,
          is_finalized: false,
        }, {
          onConflict: 'user_id,entry_date',
          ignoreDuplicates: true
        });
      
      updateStep(5, 'success');

      // Mark setup as complete
      localStorage.setItem('kaizen-setup-complete', 'true');
      localStorage.setItem('kaizen-setup-timestamp', Date.now().toString());
      
      setCanContinue(true);
      
      // Auto-redirect after 2 seconds
      setTimeout(() => {
        navigate('/');
      }, 2000);

    } catch (error) {
      console.error('Setup error:', error);
      // Mark current step as error but allow continuation
      updateStep(currentStep, 'error');
      setCanContinue(true);
    }
  };

  const getStepIcon = (status: SetupStep['status']) => {
    switch (status) {
      case 'loading':
        return <Loader2 className="w-5 h-5 animate-spin text-primary" />;
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-orange-500" />;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-muted" />;
    }
  };

  // Show "Not in Notion" request access screen
  if (notInNotion) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto mb-4">
                <UserX className="w-8 h-8 text-orange-500" />
              </div>
              <h2 className="text-xl font-bold mb-2">Account Not Found</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Your account isn't set up in our system yet. Please contact your team leader to get added.
              </p>
              {userEmail && (
                <div className="bg-muted/50 rounded-lg p-3 mb-4">
                  <p className="text-xs text-muted-foreground mb-1">Signed in as:</p>
                  <p className="text-sm font-medium">{userEmail}</p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <h3 className="font-medium text-sm mb-2">What to do:</h3>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Contact your team leader or recruiter</li>
                  <li>Ask them to add your email to Notion</li>
                  <li>Once added, come back and try again</li>
                </ol>
              </div>

              <a
                href="mailto:?subject=Kaizen%20App%20Access%20Request&body=Hi%2C%0A%0AI'm%20trying%20to%20access%20the%20Kaizen%20app%20but%20my%20account%20isn't%20set%20up%20yet.%0A%0AMy%20email%3A%20" 
                className="flex items-center justify-center gap-2 w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                <Mail className="w-4 h-4" />
                Request Access
              </a>

              <Button
                variant="outline"
                onClick={handleLogout}
                className="w-full"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out & Try Different Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md max-h-[85vh] overflow-y-auto">
        <CardContent className="pt-6 pb-6">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl font-bold text-primary">K</span>
            </div>
            <h2 className="text-xl font-bold mb-1.5">
              {canContinue ? "You're all set!" : "Getting things ready"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {canContinue 
                ? "Taking you to your dashboard..." 
                : "This will only take a moment"}
            </p>
          </div>

          <div className="space-y-3">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`flex items-start gap-2.5 p-2.5 rounded-lg transition-all ${
                  step.status === 'loading' 
                    ? 'bg-primary/5 border border-primary/20' 
                    : step.status === 'success'
                    ? 'bg-green-500/5'
                    : 'bg-muted/30'
                }`}
              >
                <div className="mt-0.5">
                  {getStepIcon(step.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${
                    step.status === 'loading' ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    {step.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {canContinue && (
            <button
              onClick={() => navigate('/')}
              className="w-full mt-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Continue to Dashboard
            </button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SetupFlow;
