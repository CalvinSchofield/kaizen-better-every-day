import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/components/ui/drawer';
import { Upload, FileSpreadsheet, Check, AlertCircle, Loader2, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import * as XLSX from 'xlsx';

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
}

interface MeVsMeUploadProps {
  open: boolean;
  onClose: () => void;
}

// Parse working time strings like "4h 38m", "2h 3m", "5h 13m"
function parseWorkingTime(timeStr: string): number {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  
  const hourMatch = timeStr.match(/(\d+)h/);
  const minMatch = timeStr.match(/(\d+)m/);
  
  const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
  const mins = minMatch ? parseInt(minMatch[1]) : 0;
  
  return hours + (mins / 60);
}

// Parse dates like "Tue, Oct 1, 2024" or "Mon, Jan 6, 2025"
function parseDateFlexible(dateStr: string): string | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  const trimmed = dateStr.trim();
  
  // Try YYYY-MM-DD first
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  
  // Try MM/DD/YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Try "Tue, Oct 1, 2024" format
  const months: Record<string, string> = {
    'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
    'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
    'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
  };
  
  const longMatch = trimmed.match(/(?:\w+,\s*)?(\w+)\s+(\d{1,2}),?\s*(\d{4})/i);
  if (longMatch) {
    const [, monthName, day, year] = longMatch;
    const monthNum = months[monthName.toLowerCase().slice(0, 3)];
    if (monthNum) {
      return `${year}-${monthNum}-${day.padStart(2, '0')}`;
    }
  }
  
  // Try native Date parsing as fallback
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  
  return null;
}

export const MeVsMeUpload = ({ open, onClose }: MeVsMeUploadProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [uploadSummary, setUploadSummary] = useState<UploadSummary | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [metricType, setMetricType] = useState<'efp' | 'fp'>('efp');
  const queryClient = useQueryClient();

  const parseCSV = useCallback((text: string, isEfp: boolean): ParsedRow[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    // Find the header row - it might not be the first row (could have title rows above)
    let headerRowIdx = 0;
    let headers: string[] = [];
    
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const potentialHeaders = lines[i].toLowerCase().split(',').map(h => h.trim());
      // Check if this row has "date" column - that's our header row
      if (potentialHeaders.some(h => h === 'date' || h === 'entry_date')) {
        headerRowIdx = i;
        headers = potentialHeaders;
        break;
      }
    }
    
    if (headers.length === 0) {
      throw new Error('Could not find header row with "Date" column');
    }
    
    // Find column indices - support multiple naming conventions
    const dateIdx = headers.findIndex(h => h === 'date' || h === 'entry_date');
    const doorsIdx = headers.findIndex(h => h.includes('door'));
    const dmsIdx = headers.findIndex(h => h.includes('decision') || h === 'dms');
    const pitchesIdx = headers.findIndex(h => h.includes('pitch'));
    const transitionsIdx = headers.findIndex(h => h.includes('transition'));
    const presentationsIdx = headers.findIndex(h => h.includes('presentation'));
    const closesIdx = headers.findIndex(h => h.includes('close'));
    // Look for EFP/FP column with multiple naming conventions
    const fpIdx = headers.findIndex(h => h === 'actual' || h.includes('fp') || h.includes('efp'));
    const prmrIdx = headers.findIndex(h => h.includes('prmr') || h.includes('revenue'));
    // "Working Time" column with values like "4h 38m"
    const hoursIdx = headers.findIndex(h => h.includes('hour') || h.includes('working time'));

    const rows: ParsedRow[] = [];
    
    // Start from the row after headers
    for (let i = headerRowIdx + 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length < 2) continue;

      const dateStr = values[dateIdx];
      const parsedDate = parseDateFlexible(dateStr);
      if (!parsedDate) continue;

      // Get the FP/EFP value
      const fpValue = fpIdx >= 0 ? parseFloat(values[fpIdx]) || 0 : 0;
      
      // If user tracked EFP, calculate PRMR from it (EFP × 85)
      // If user tracked FP+, we don't have PRMR unless they provided it
      let prmr = prmrIdx >= 0 ? parseFloat(values[prmrIdx]) || 0 : 0;
      let fpPlus = fpValue;
      
      if (isEfp && fpValue > 0 && prmr === 0) {
        // User tracked EFP, calculate PRMR
        prmr = fpValue * 85;
      }

      // Parse working time (handles "4h 38m" format)
      const hoursValue = hoursIdx >= 0 ? values[hoursIdx] : '';
      const hoursWorked = typeof hoursValue === 'string' && hoursValue.includes('h') 
        ? parseWorkingTime(hoursValue)
        : parseFloat(hoursValue) || 0;

      // Only include rows that have at least some data (not just empty days)
      const doors = doorsIdx >= 0 ? parseInt(values[doorsIdx]) || 0 : 0;
      const hasData = fpPlus > 0 || doors > 0 || hoursWorked > 0;
      
      if (!hasData) continue;

      rows.push({
        date: parsedDate,
        doors_knocked: doors,
        decision_makers: dmsIdx >= 0 ? parseInt(values[dmsIdx]) || 0 : 0,
        pitches: pitchesIdx >= 0 ? parseInt(values[pitchesIdx]) || 0 : 0,
        transitions: transitionsIdx >= 0 ? parseInt(values[transitionsIdx]) || 0 : 0,
        presentations: presentationsIdx >= 0 ? parseInt(values[presentationsIdx]) || 0 : 0,
        closes: closesIdx >= 0 ? parseInt(values[closesIdx]) || 0 : 0,
        fp_plus: fpPlus,
        prmr: prmr,
        hours_worked: hoursWorked,
      });
    }

    return rows;
  }, []);

  const parseExcelToCSV = useCallback(async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_csv(firstSheet);
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const fileName = selectedFile.name.toLowerCase();
    const isCSV = fileName.endsWith('.csv');
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
    const isNumbers = fileName.endsWith('.numbers');

    if (isNumbers) {
      setError('Apple Numbers files need to be exported first. In Numbers: File → Export To → Excel (.xlsx)');
      return;
    }

    if (!isCSV && !isExcel) {
      setError('Please select a CSV or Excel (.xlsx) file.');
      return;
    }

    setFile(selectedFile);
    
    try {
      let csvText: string;
      
      if (isExcel) {
        csvText = await parseExcelToCSV(selectedFile);
      } else {
        csvText = await selectedFile.text();
      }
      
      const rows = parseCSV(csvText, metricType === 'efp');
      
      if (rows.length === 0) {
        setError('No valid data rows found. Make sure your file has a "Date" column and data with activity.');
        return;
      }

      setParsedData(rows);
      
      setUploadSummary({
        totalRows: rows.length,
        validRows: rows.length,
        invalidRows: 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    }
  }, [parseCSV, parseExcelToCSV, metricType]);

  // Re-parse when metric type changes
  const handleMetricTypeChange = useCallback(async (value: 'efp' | 'fp') => {
    setMetricType(value);
    if (file) {
      try {
        const fileName = file.name.toLowerCase();
        const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
        
        let csvText: string;
        if (isExcel) {
          csvText = await parseExcelToCSV(file);
        } else {
          csvText = await file.text();
        }
        
        const rows = parseCSV(csvText, value === 'efp');
        setParsedData(rows);
        setUploadSummary({
          totalRows: rows.length,
          validRows: rows.length,
          invalidRows: 0,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse file');
      }
    }
  }, [file, parseCSV, parseExcelToCSV]);

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
            Upload your past season tracking spreadsheet (Excel or CSV)
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-4 space-y-4 overflow-y-auto">
          {/* Metric Type Selection */}
          <div className="space-y-3">
            <Label>What metric did you track?</Label>
            <RadioGroup value={metricType} onValueChange={(v) => handleMetricTypeChange(v as 'efp' | 'fp')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="efp" id="efp" />
                <Label htmlFor="efp" className="font-normal cursor-pointer">
                  EFP (Daily PRMR ÷ 85)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="fp" id="fp" />
                <Label htmlFor="fp" className="font-normal cursor-pointer">
                  FP+ (Accounts sold)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* File Input */}
          <div className="space-y-2">
            <Label htmlFor="csv-file">Select File</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              disabled={isUploading}
            />
          </div>

          {/* Expected Format */}
          <Card className="bg-muted/50 border-muted">
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Supported columns:</p>
                  <p><span className="font-medium">Required:</span> Date</p>
                  <p><span className="font-medium">Performance:</span> {metricType === 'efp' ? 'EFP' : 'FP+'} or PRMR</p>
                  <p><span className="font-medium">Activity:</span> Doors, Decision Makers, Pitches, Transitions, Presentations, Closes</p>
                  <p><span className="font-medium">Time:</span> Working Time or Hours</p>
                </div>
              </div>
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
            <Card className="border-green-500/30 bg-green-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Ready to Import
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-sm">
                  <strong>{uploadSummary.validRows}</strong> days with data found
                </p>
                <p className="text-xs text-muted-foreground">
                  {parsedData[0].date} → {parsedData[parsedData.length - 1].date}
                </p>
                <p className="text-xs text-muted-foreground">
                  Total {metricType === 'efp' ? 'EFP' : 'FP+'}: {parsedData.reduce((sum, r) => sum + r.fp_plus, 0).toFixed(1)}
                </p>
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
