import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { UserX, Mail, LogOut } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const SetupFlow = () => {
  const navigate = useNavigate();
  const [statusText, setStatusText] = useState("Loading your profile...");
  const [notInNotion, setNotInNotion] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    runSetup();
  }, []);

  const runSetup = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      setUserEmail(user.email || null);

      // Step 1: Check/sync rep profile
      setStatusText("Syncing your profile...");
      
      const { data: existingRep } = await supabase
        .from('reps')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!existingRep) {
        await supabase.functions.invoke('sync-notion-reps');
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const { data: repAfterSync } = await supabase
          .from('reps')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (!repAfterSync) {
          setNotInNotion(true);
          return;
        }
      }

      // Cache rep data
      const { data: repData } = await supabase
        .from('reps')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (repData) {
        localStorage.setItem(`rep-data-cache-${user.id}`, JSON.stringify({
          data: repData,
          timestamp: Date.now()
        }));
      }

      // Run remaining data fetches in parallel for speed
      setStatusText("Loading app data...");
      
      const { data: { session } } = await supabase.auth.getSession();

      await Promise.all([
        // Competitors - sync from Notion if needed
        (async () => {
          setStatusText("Loading competitor data...");
          const { data: competitors } = await supabase
            .from('competitors')
            .select('*')
            .order('name', { ascending: true });

          if (!competitors || competitors.length === 0) {
            await supabase.functions.invoke('sync-notion-competitors');
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            const { data: syncedCompetitors } = await supabase
              .from('competitors')
              .select('*')
              .order('name', { ascending: true });
            
            if (syncedCompetitors && syncedCompetitors.length > 0) {
              localStorage.setItem('competitors-cache', JSON.stringify({
                data: syncedCompetitors,
                timestamp: Date.now()
              }));
            }
          } else {
            localStorage.setItem('competitors-cache', JSON.stringify({
              data: competitors,
              timestamp: Date.now()
            }));
          }
        })(),

        // Blitzes
        (async () => {
          const { data: blitzData } = await supabase.functions.invoke('fetch-preseason-blitzes');
          if (blitzData?.blitzes) {
            localStorage.setItem('blitzes-cache', JSON.stringify({
              data: blitzData.blitzes,
              timestamp: Date.now()
            }));
          }
        })(),

        // Team access
        (async () => {
          if (session) {
            const { data: teamAccessData } = await supabase.functions.invoke('fetch-team-access', {
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (teamAccessData) {
              localStorage.setItem('team-access-cache', JSON.stringify({
                data: teamAccessData,
                timestamp: Date.now()
              }));
            }
          }
        })(),

        // Blitz attendance
        (async () => {
          if (repData?.notion_page_id && session) {
            const { data: attendanceData } = await supabase.functions.invoke('fetch-blitz-attendance', {
              body: { scope: 'team', leaderNotionPageId: repData.notion_page_id },
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (attendanceData) {
              localStorage.setItem('blitz-attendance-cache', JSON.stringify({
                data: attendanceData,
                timestamp: Date.now()
              }));
            }
          }
        })(),

        // Daily entries (for calendar & insights) - fetch last 90 days
        (async () => {
          setStatusText("Loading your activity history...");
          const ninetyDaysAgo = new Date();
          ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
          
          const { data: entries } = await supabase
            .from('daily_entries')
            .select('*')
            .eq('user_id', user.id)
            .gte('entry_date', ninetyDaysAgo.toISOString().split('T')[0])
            .order('entry_date', { ascending: false });
          
          if (entries) {
            localStorage.setItem(`daily-entries-cache-${user.id}`, JSON.stringify({
              data: entries,
              timestamp: Date.now()
            }));
          }
        })(),

        // Initialize today's entry
        (async () => {
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
        })(),
      ]);

      // Mark setup as complete
      localStorage.setItem('kaizen-setup-complete', 'true');
      localStorage.setItem('kaizen-setup-timestamp', Date.now().toString());
      
      setStatusText("Ready!");
      
      // Quick redirect
      setTimeout(() => {
        navigate('/');
      }, 500);

    } catch (error) {
      console.error('Setup error:', error);
      // Allow continuation even on error
      localStorage.setItem('kaizen-setup-complete', 'true');
      localStorage.setItem('kaizen-setup-timestamp', Date.now().toString());
      navigate('/');
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
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate('/auth');
                }}
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
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5 flex flex-col items-center justify-center p-4">
      {/* Animated Logo */}
      <div className="relative mb-8">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
          <span className="text-4xl font-bold text-primary">K</span>
        </div>
        {/* Spinning ring around logo */}
        <div className="absolute inset-0 -m-2">
          <div className="w-24 h-24 border-2 border-primary/20 border-t-primary rounded-full animate-spin" 
               style={{ animationDuration: '1.5s' }} />
        </div>
      </div>

      {/* Status text */}
      <p className="text-sm text-muted-foreground animate-pulse">
        {statusText}
      </p>
    </div>
  );
};

export default SetupFlow;
