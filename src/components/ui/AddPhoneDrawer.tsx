import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AddPhoneDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personName: string;
  notionPageId: string;
  pendingAction?: 'text' | 'call' | null;
  onPhoneSaved?: (cleanPhone: string) => void;
}

/**
 * Smart phone number parser that handles various formats:
 * - +1 (209) 704-8616
 * - 1-555-555-5555
 * - (555) 555-5555
 * - 555-555-5555
 * - 5555555555
 * Returns clean 10-digit phone number
 */
export const parsePhoneNumber = (input: string): string => {
  // Remove all non-digit characters first
  const digitsOnly = input.replace(/\D/g, '');
  
  // If starts with country code 1 and has 11 digits, strip the 1
  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    return digitsOnly.slice(1);
  }
  
  // If more than 10 digits and starts with 1, strip the 1
  if (digitsOnly.length > 10 && digitsOnly.startsWith('1')) {
    return digitsOnly.slice(1, 11);
  }
  
  // Return first 10 digits if 10 or more digits (standard US)
  if (digitsOnly.length >= 10) {
    return digitsOnly.slice(0, 10);
  }
  
  // Return whatever we have if it's less than 10
  return digitsOnly;
};

/**
 * Format phone for display as user types
 */
export const formatPhoneDisplay = (input: string): string => {
  const cleaned = parsePhoneNumber(input);
  
  if (cleaned.length === 0) return '';
  if (cleaned.length <= 3) return `(${cleaned}`;
  if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
  return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
};

export const AddPhoneDrawer = ({
  open,
  onOpenChange,
  personName,
  notionPageId,
  pendingAction,
  onPhoneSaved,
}: AddPhoneDrawerProps) => {
  const { toast } = useToast();
  const [phoneInput, setPhoneInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Parse and format for display
    const formatted = formatPhoneDisplay(raw);
    setPhoneInput(formatted);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    const formatted = formatPhoneDisplay(pasted);
    setPhoneInput(formatted);
  };

  const handleSave = async () => {
    const cleanPhone = parsePhoneNumber(phoneInput);
    
    if (cleanPhone.length < 10) {
      toast({
        title: "Invalid phone number",
        description: "Please enter a valid 10-digit phone number",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { error } = await supabase.functions.invoke('update-recruit-phone', {
        body: {
          recruitNotionId: notionPageId,
          phone: cleanPhone,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      toast({
        title: "Phone saved",
        description: `${personName}'s phone number has been saved`,
      });

      // Close drawer
      onOpenChange(false);
      setPhoneInput('');
      
      // Execute callback and pending action after brief delay
      setTimeout(() => {
        onPhoneSaved?.(cleanPhone);
        
        if (pendingAction === 'text') {
          window.location.href = `sms:${cleanPhone}`;
        } else if (pendingAction === 'call') {
          window.location.href = `tel:${cleanPhone}`;
        }
      }, 300);
      
    } catch (error) {
      console.error('Error saving phone number:', error);
      toast({
        title: "Failed to save",
        description: "Could not save phone number. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setPhoneInput('');
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader>
          <SheetTitle>Add Phone Number</SheetTitle>
          <SheetDescription>
            Enter {personName}'s phone number{pendingAction ? ` to ${pendingAction === 'text' ? 'text' : 'call'} them` : ''}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 py-6">
          <Input
            type="tel"
            placeholder="(555) 555-5555"
            value={phoneInput}
            onChange={handlePhoneChange}
            onPaste={handlePaste}
            className="text-lg h-12"
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            This will save to Notion and be available everywhere
          </p>
        </div>
        <div className="flex gap-3 pt-2">
          <Button 
            variant="outline" 
            onClick={handleClose} 
            className="flex-1"
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            className="flex-1"
            disabled={isSaving || parsePhoneNumber(phoneInput).length < 10}
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </span>
            ) : (
              <>Save{pendingAction ? ` & ${pendingAction === 'text' ? 'Text' : 'Call'}` : ''}</>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
