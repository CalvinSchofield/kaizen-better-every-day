import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Trophy, Upload, Trash2, FileSpreadsheet, Calendar, Loader2 } from 'lucide-react';
import { useMeVsMe } from '@/hooks/useMeVsMe';
import { MeVsMeUpload } from './MeVsMeUpload';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

export const MeVsMeSettings = () => {
  const { isEnabled, isLoading, dataSummary, toggleEnabled, isToggling, deleteAllData, isDeleting } = useMeVsMe();
  const [uploadOpen, setUploadOpen] = useState(false);

  const handleToggle = (enabled: boolean) => {
    toggleEnabled(enabled);
    toast.success(enabled ? 'Me vs Me enabled' : 'Me vs Me disabled');
  };

  const handleDeleteAll = () => {
    deleteAllData();
    toast.success('Historical data deleted');
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <CardTitle>Me vs Me</CardTitle>
          </div>
          <CardDescription>
            Compare your current performance against previous years
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="me-vs-me-toggle">Enable comparisons</Label>
              <p className="text-xs text-muted-foreground">
                Show vs last year metrics in Insights
              </p>
            </div>
            <Switch
              id="me-vs-me-toggle"
              checked={isEnabled}
              onCheckedChange={handleToggle}
              disabled={isToggling}
            />
          </div>

          {/* Data Summary */}
          {dataSummary ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                Historical Data
              </div>
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <p className="text-sm">
                  <strong>{dataSummary.totalDays}</strong> days imported
                </p>
                {dataSummary.years.map((yearInfo) => (
                  <div key={yearInfo.year} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {yearInfo.year}: {yearInfo.days} days ({yearInfo.seasons.join(', ')})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <FileSpreadsheet className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No historical data imported yet
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              onClick={() => setUploadOpen(true)}
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              {dataSummary ? 'Import More Data' : 'Import CSV'}
            </Button>

            {dataSummary && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Delete All Data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete all historical data?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all {dataSummary.totalDays} days of imported historical data. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAll}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>

      <MeVsMeUpload open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </>
  );
};
