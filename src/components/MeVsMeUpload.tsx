import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/components/ui/drawer';
import { Upload, FileSpreadsheet, Check, AlertCircle, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface ParsedRow {
  date: string;
  doors_knocked: number;
  decision_makers: number;
  pitches: number;
  transitions: number;
  presentations: number;
  closes: number;
  fp_plus: number;
  prmr: number;
  hours_worked: number;
}

interface UploadSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  yearsSummary: Record<number, { preseason: number; summer: number; extension: number }>;
}

interface MeVsMeUploadProps {
  open: boolean;
  onClose: () => void;
}

export const MeVsMeUpload = ({ open, onClose }: MeVsMeUploadProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [uploadSummary, setUploadSummary] = useState<UploadSummary | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const parseCSV = useCallback((text: string): ParsedRow[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    
    // Find column indices - support multiple naming conventions
    const dateIdx = headers.findIndex(h => h === 'date' || h === 'entry_date');
    const doorsIdx = headers.findIndex(h => h.includes('door'));
    const dmsIdx = headers.findIndex(h => h.includes('decision') || h === 'dms');
    const pitchesIdx = headers.findIndex(h => h.includes('pitch'));
    const transitionsIdx = headers.findIndex(h => h.includes('transition'));
    const presentationsIdx = headers.findIndex(h => h.includes('presentation'));
    const closesIdx = headers.findIndex(h => h.includes('close'));
    const fpIdx = headers.findIndex(h => h.includes('fp') || h.includes('efp'));
    const prmrIdx = headers.findIndex(h => h.includes('prmr') || h.includes('revenue'));
    const hoursIdx = headers.findIndex(h => h.includes('hour'));

    if (dateIdx === -1) {
      throw new Error('CSV must have a "date" column');
    }

    const rows: ParsedRow[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length < 2) continue;

      const dateStr = values[dateIdx];
      if (!dateStr) continue;

      rows.push({
        date: dateStr,
        doors_knocked: doorsIdx >= 0 ? parseInt(values[doorsIdx]) || 0 : 0,
        decision_makers: dmsIdx >= 0 ? parseInt(values[dmsIdx]) || 0 : 0,
        pitches: pitchesIdx >= 0 ? parseInt(values[pitchesIdx]) || 0 : 0,
        transitions: transitionsIdx >= 0 ? parseInt(values[transitionsIdx]) || 0 : 0,
        presentations: presentationsIdx >= 0 ? parseInt(values[presentationsIdx]) || 0 : 0,
        closes: closesIdx >= 0 ? parseInt(values[closesIdx]) || 0 : 0,
        fp_plus: fpIdx >= 0 ? parseFloat(values[fpIdx]) || 0 : 0,
        prmr: prmrIdx >= 0 ? parseFloat(values[prmrIdx]) || 0 : 0,
        hours_worked: hoursIdx >= 0 ? parseFloat(values[hoursIdx]) || 0 : 0,
      });
    }

    return rows;
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }

    setFile(selectedFile);
    
    try {
      const text = await selectedFile.text();
      const rows = parseCSV(text);
      
      if (rows.length === 0) {
        setError('No valid data rows found in CSV');
        return;
      }

      setParsedData(rows);
      
      // Generate summary (will be calculated by edge function)
      setUploadSummary({
        totalRows: rows.length,
        validRows: rows.length,
        invalidRows: 0,
        yearsSummary: {},
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV');
    }
  }, [parseCSV]);

  const handleUpload = async () => {
    if (parsedData.length === 0) return;

    setIsUploading(true);
    setUploadProgress(10);

    try {
      const { data, error } = await supabase.functions.invoke('upload-historical-data', {
        body: { entries: parsedData },
      });

      setUploadProgress(90);

      if (error) throw error;

      setUploadProgress(100);
      
      toast.success(`Imported ${data.imported} days of historical data`);
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['historical-data-summary'] });
      queryClient.invalidateQueries({ queryKey: ['historical-entries'] });
      queryClient.invalidateQueries({ queryKey: ['historical-cumulative'] });
      queryClient.invalidateQueries({ queryKey: ['has-historical-data'] });
      
      // Reset and close
      setFile(null);
      setParsedData([]);
      setUploadSummary(null);
      onClose();
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to upload historical data');
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedData([]);
    setUploadSummary(null);
    setError(null);
    onClose();
  };

  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DrawerContent className="max-h-[90dvh]">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Historical Data
          </DrawerTitle>
          <DrawerDescription>
            Upload a CSV file with your past season data to enable Me vs Me comparisons
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-4 space-y-4 overflow-y-auto">
          {/* File Input */}
          <div className="space-y-2">
            <Label htmlFor="csv-file">Select CSV File</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={isUploading}
            />
          </div>

          {/* Expected Format */}
          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground mb-2">Expected CSV columns:</p>
              <code className="text-xs block bg-background p-2 rounded">
                date, doors_knocked, decision_makers, pitches, transitions, presentations, closes, fp_plus, prmr, hours_worked
              </code>
              <p className="text-xs text-muted-foreground mt-2">
                Date format: YYYY-MM-DD or MM/DD/YYYY
              </p>
            </CardContent>
          </Card>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Upload Summary */}
          {uploadSummary && parsedData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Ready to Import
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  <strong>{uploadSummary.validRows}</strong> days of data found
                </p>
                {parsedData.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Date range: {parsedData[0].date} to {parsedData[parsedData.length - 1].date}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Uploading...</span>
              </div>
              <Progress value={uploadProgress} />
            </div>
          )}
        </div>

        <DrawerFooter>
          <Button
            onClick={handleUpload}
            disabled={parsedData.length === 0 || isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import {parsedData.length} Days
              </>
            )}
          </Button>
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            Cancel
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
