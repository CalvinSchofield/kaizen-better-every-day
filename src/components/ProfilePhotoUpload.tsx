import { useState, useRef } from "react";
import { Camera, Upload, X, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ProfilePhotoUploadProps {
  currentPhotoUrl?: string | null;
  onPhotoUpdated: (url: string | null) => void;
  name?: string;
  size?: "sm" | "md" | "lg";
  showRemoveButton?: boolean;
}

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export const ProfilePhotoUpload = ({ 
  currentPhotoUrl, 
  onPhotoUpdated, 
  name = "",
  size = "lg",
  showRemoveButton = true
}: ProfilePhotoUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentPhotoUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const sizeClasses = {
    sm: "h-12 w-12",
    md: "h-20 w-20",
    lg: "h-28 w-28"
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image under 5MB",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create a preview
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);

      // Upload to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/profile.${fileExt}`;

      // Delete existing file first (if any)
      await supabase.storage
        .from('profile-photos')
        .remove([`${user.id}/profile.jpg`, `${user.id}/profile.png`, `${user.id}/profile.webp`]);

      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(fileName);

      // Add cache-busting timestamp
      const urlWithTimestamp = `${publicUrl}?t=${Date.now()}`;

      // Update reps table
      const { error: updateError } = await supabase
        .from('reps')
        .update({ profile_photo_url: urlWithTimestamp })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      onPhotoUpdated(urlWithTimestamp);
      
      toast({
        title: "Photo uploaded",
        description: "Your profile photo has been updated"
      });

    } catch (error) {
      console.error('Upload error:', error);
      setPreviewUrl(currentPhotoUrl || null);
      toast({
        title: "Upload failed",
        description: "Failed to upload photo. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    setIsUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Remove from storage
      await supabase.storage
        .from('profile-photos')
        .remove([`${user.id}/profile.jpg`, `${user.id}/profile.png`, `${user.id}/profile.webp`]);

      // Update reps table
      const { error: updateError } = await supabase
        .from('reps')
        .update({ profile_photo_url: null })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setPreviewUrl(null);
      onPhotoUpdated(null);

      toast({
        title: "Photo removed",
        description: "Your profile photo has been removed"
      });

    } catch (error) {
      console.error('Remove error:', error);
      toast({
        title: "Failed to remove",
        description: "Failed to remove photo. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <Avatar className={cn(sizeClasses[size], "border-2 border-border")}>
          <AvatarImage src={previewUrl || undefined} alt="Profile photo" />
          <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
            {name ? getInitials(name) : <Camera className="h-6 w-6" />}
          </AvatarFallback>
        </Avatar>
        
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-full">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Camera className="h-4 w-4" />
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          <Upload className="h-4 w-4 mr-1.5" />
          {previewUrl ? "Change" : "Upload"}
        </Button>
        
        {showRemoveButton && previewUrl && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemovePhoto}
            disabled={isUploading}
          >
            <X className="h-4 w-4 mr-1.5" />
            Remove
          </Button>
        )}
      </div>
    </div>
  );
};
