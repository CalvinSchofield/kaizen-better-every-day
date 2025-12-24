import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Database, CheckCircle2, AlertCircle } from 'lucide-react';

interface MigrationStats {
  mgmtGroups: { fetched: number; inserted: number };
  teams: { fetched: number; inserted: number };
  blitzes: { fetched: number; inserted: number };
  recruits: { fetched: number; inserted: number };
  recruitBlitzes: { inserted: number };
  errors: string[];
}

export const MigrationTrigger = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState<MigrationStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runMigration = async () => {
    setIsRunning(true);
    setError(null);
    setStats(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('You must be logged in to run the migration');
      }

      toast.info('Starting migration from Notion...', { duration: 5000 });

      const { data, error: fnError } = await supabase.functions.invoke('migrate-notion-data', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (fnError) {
        throw fnError;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setStats(data.stats);
      toast.success('Migration completed successfully!');
    } catch (err: any) {
      console.error('Migration error:', err);
      setError(err.message || 'Unknown error occurred');
      toast.error(`Migration failed: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Notion to Supabase Migration
        </CardTitle>
        <CardDescription>
          Transfer all recruits, blitzes, teams, and management groups from Notion to the new Supabase tables.
          This is a one-time migration that can be run multiple times safely (uses upsert).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runMigration} 
          disabled={isRunning}
          size="lg"
          className="w-full"
        >
          {isRunning ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Running Migration...
            </>
          ) : (
            <>
              <Database className="h-4 w-4 mr-2" />
              Run Migration
            </>
          )}
        </Button>

        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Migration Failed</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
          </div>
        )}

        {stats && (
          <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Migration Complete!</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-2 bg-background rounded">
                <p className="text-muted-foreground">MGMT Groups</p>
                <p className="font-medium">{stats.mgmtGroups.inserted} / {stats.mgmtGroups.fetched}</p>
              </div>
              <div className="p-2 bg-background rounded">
                <p className="text-muted-foreground">Teams</p>
                <p className="font-medium">{stats.teams.inserted} / {stats.teams.fetched}</p>
              </div>
              <div className="p-2 bg-background rounded">
                <p className="text-muted-foreground">Blitzes</p>
                <p className="font-medium">{stats.blitzes.inserted} / {stats.blitzes.fetched}</p>
              </div>
              <div className="p-2 bg-background rounded">
                <p className="text-muted-foreground">Recruits</p>
                <p className="font-medium">{stats.recruits.inserted} / {stats.recruits.fetched}</p>
              </div>
              <div className="p-2 bg-background rounded col-span-2">
                <p className="text-muted-foreground">Blitz Commitments</p>
                <p className="font-medium">{stats.recruitBlitzes.inserted} linked</p>
              </div>
            </div>

            {stats.errors.length > 0 && (
              <div className="mt-2 p-2 bg-yellow-500/10 rounded text-sm">
                <p className="font-medium text-yellow-600">Warnings ({stats.errors.length})</p>
                <ul className="mt-1 text-xs text-muted-foreground max-h-24 overflow-auto">
                  {stats.errors.slice(0, 10).map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                  {stats.errors.length > 10 && (
                    <li>... and {stats.errors.length - 10} more</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
