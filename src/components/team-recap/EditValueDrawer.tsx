import { useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface EditValueDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field: string;
  label: string;
  currentValue: number | string;
  onSave: (value: number | string) => void;
  type?: 'number' | 'text';
}

export function EditValueDrawer({ 
  open, 
  onOpenChange, 
  field, 
  label, 
  currentValue, 
  onSave,
  type = 'number'
}: EditValueDrawerProps) {
  const [value, setValue] = useState(String(currentValue));

  const handleSave = () => {
    const newValue = type === 'number' ? parseFloat(value) || 0 : value;
    onSave(newValue);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-safe">
        <DrawerHeader>
          <DrawerTitle>Edit {label}</DrawerTitle>
        </DrawerHeader>
        
        <div className="px-4 pb-4 space-y-4">
          <div>
            <Label htmlFor="edit-value">New Value</Label>
            <Input
              id="edit-value"
              type={type}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="mt-1"
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-1">
              Current: {currentValue}
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSave}
            >
              Save
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
