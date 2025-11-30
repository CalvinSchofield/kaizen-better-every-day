import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

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
    { name: 'Preparing your data', status: 'pending', description: 'Setting up your tracking' },
  ]);
  const [currentStep, setCurrentStep] = useState(0);
  const [canContinue, setCanContinue] = useState(false);

  useEffect(() => {
    runSetup();
  }, []);

  const updateStep = (index: number, status: SetupStep['status']) => {
    setSteps(prev => prev.map((step, i) => 
      i === index ? { ...step, status } : step
    ));
  };

  const runSetup = async () => {
    try {
      // Step 1: Sync rep data from Notion
      setCurrentStep(0);
      updateStep(0, 'loading');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check if rep data exists, if not sync from Notion
      const { data: existingRep } = await supabase
        .from('reps')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!existingRep) {
        await supabase.functions.invoke('sync-notion-reps');
        await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for sync
      }
      
      updateStep(0, 'success');

      // Step 2: Load and cache competitors
      setCurrentStep(1);
      updateStep(1, 'loading');
      
      const { data: competitors } = await supabase
        .from('competitors')
        .select('*')
        .order('name', { ascending: true });

      if (!competitors || competitors.length === 0) {
        // Sync from Notion if no competitors
        await supabase.functions.invoke('sync-notion-competitors');
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Refetch after sync
        const { data: syncedCompetitors } = await supabase
          .from('competitors')
          .select('*')
          .order('name', { ascending: true });
        
        if (syncedCompetitors) {
          localStorage.setItem('competitors-cache', JSON.stringify({
            data: syncedCompetitors,
            timestamp: Date.now()
          }));
        }
      } else {
        // Cache existing data
        localStorage.setItem('competitors-cache', JSON.stringify({
          data: competitors,
          timestamp: Date.now()
        }));
      }
      
      updateStep(1, 'success');

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

      // Step 4: Initialize daily entry for today
      setCurrentStep(3);
      updateStep(3, 'loading');
      
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
      
      updateStep(3, 'success');

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-6">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl font-bold text-primary">K</span>
            </div>
            <h2 className="text-2xl font-bold mb-2">
              {canContinue ? "You're all set!" : "Getting things ready"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {canContinue 
                ? "Taking you to your dashboard..." 
                : "This will only take a moment"}
            </p>
          </div>

          <div className="space-y-4">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 p-3 rounded-lg transition-all ${
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
                  <p className={`font-medium ${
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
              className="w-full mt-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
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
