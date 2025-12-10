import { useState, useEffect } from "react";
import { useUpdateMySuggestion } from "@/hooks/useGroupRecruits";
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle 
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface EditSuggestionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestion: {
    id: string;
    name: string;
    phone: string;
    relationship: string | null;
    notes: string | null;
  } | null;
}

const RELATIONSHIPS = [
  'Friend',
  'Roommate',
  'Coworker',
  'Family',
  'Classmate',
  'Acquaintance',
  'Other',
];

const formatPhoneNumber = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
};

export const EditSuggestionDrawer = ({ open, onOpenChange, suggestion }: EditSuggestionDrawerProps) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [notes, setNotes] = useState('');

  const updateMutation = useUpdateMySuggestion();

  useEffect(() => {
    if (suggestion && open) {
      setName(suggestion.name);
      setPhone(suggestion.phone);
      setRelationship(suggestion.relationship || '');
      setNotes(suggestion.notes || '');
    }
  }, [suggestion, open]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);
  };

  const handleSubmit = async () => {
    if (!suggestion) return;
    
    if (!name.trim() || !phone.trim()) {
      toast.error('Name and phone are required');
      return;
    }

    try {
      await updateMutation.mutateAsync({
        suggestionId: suggestion.id,
        name: name.trim(),
        phone: phone.trim(),
        relationship: relationship || undefined,
        notes: notes || undefined,
      });
      toast.success('Suggestion updated!');
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to update suggestion');
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90dvh]">
        <DrawerHeader>
          <DrawerTitle>Edit Suggestion</DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-4">
          <div>
            <Label>Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Their full name"
              className="mt-1"
            />
          </div>

          <div>
            <Label>Phone *</Label>
            <Input
              value={phone}
              onChange={handlePhoneChange}
              placeholder="(555) 123-4567"
              type="tel"
              className="mt-1"
            />
          </div>

          <div>
            <Label>How do you know them?</Label>
            <Select value={relationship} onValueChange={setRelationship}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select relationship" />
              </SelectTrigger>
              <SelectContent modal={false}>
                {RELATIONSHIPS.map((rel) => (
                  <SelectItem key={rel} value={rel}>
                    {rel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any helpful context..."
              className="mt-1"
              rows={3}
            />
          </div>

          <Button 
            className="w-full" 
            onClick={handleSubmit}
            disabled={updateMutation.isPending || !name || !phone}
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
