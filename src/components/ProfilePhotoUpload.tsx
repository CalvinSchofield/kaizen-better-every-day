import { useState, useRef, useCallback } from "react";
import { Camera, X, Loader2, Check } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

interface ProfilePhotoUploadProps {
  currentPhotoUrl?: string | null;
  onPhotoUpdated: (url: string | null) => void;
  name?: string;
  size?: "sm" | "md" | "lg";
  showRemoveButton?: boolean;
}

// Strip emojis and get clean initials
const getInitials = (name: string) => {
  // Remove emojis and other unicode symbols
  const cleanName = name
    .replace(/[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Emoji_Modifier_Base}\p{Emoji_Component}]/gu, '')
    .trim();
  
  return cleanName
    .split(' ')
    .filter(n => n.length > 0)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const MAX_IMAGE_SIZE = 1200; // Max dimension in pixels
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB after compression

// Resize and compress image
const processImage = async (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    img.onload = () => {
      let { width, height } = img;
      
      // Scale down if larger than max size
      if (width > MAX_IMAGE_SIZE || height > MAX_IMAGE_SIZE) {
        if (width > height) {
          height = Math.round((height * MAX_IMAGE_SIZE) / width);
          width = MAX_IMAGE_SIZE;
        } else {
          width = Math.round((width * MAX_IMAGE_SIZE) / height);
          height = MAX_IMAGE_SIZE;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);
      
      // Start with high quality and reduce if needed
      let quality = 0.9;
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }
            
            // If still too large and quality can be reduced
            if (blob.size > MAX_FILE_SIZE && quality > 0.3) {
              quality -= 0.1;
              tryCompress();
            } else {
              resolve(blob);
            }
          },
          'image/jpeg',
          quality
        );
      };
      
      tryCompress();
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};

// Get cropped image from canvas
const getCroppedImg = (
  image: HTMLImageElement,
  crop: Crop
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('No 2d context'));
      return;
    }
    
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    const cropX = crop.x * scaleX;
    const cropY = crop.y * scaleY;
    const cropWidth = crop.width * scaleX;
    const cropHeight = crop.height * scaleY;
    
    // Output square image
    const outputSize = Math.min(cropWidth, cropHeight, MAX_IMAGE_SIZE);
    canvas.width = outputSize;
    canvas.height = outputSize;
    
    ctx.drawImage(
      image,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      outputSize,
      outputSize
    );
    
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob'));
        }
      },
      'image/jpeg',
      0.9
    );
  });
};

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

export const ProfilePhotoUpload = ({ 
  currentPhotoUrl, 
  onPhotoUpdated, 
  name = "",
  size = "lg",
  showRemoveButton = true
}: ProfilePhotoUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentPhotoUrl || null);
  const [cropMode, setCropMode] = useState(false);
  const [crop, setCrop] = useState<Crop>();
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const sizeClasses = {
    sm: "h-12 w-12",
    md: "h-20 w-20",
    lg: "h-28 w-28"
  };

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 1));
  }, []);

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

    try {
      // Process and resize the image first
      const processedBlob = await processImage(file);
      const objectUrl = URL.createObjectURL(processedBlob);
      setImageSrc(objectUrl);
      setCropMode(true);
    } catch (error) {
      console.error('Error processing image:', error);
      toast({
        title: "Failed to process image",
        description: "Please try a different image",
        variant: "destructive"
      });
    }
    
    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCropConfirm = async () => {
    if (!imgRef.current || !crop) return;
    
    setIsUploading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get cropped image
      const croppedBlob = await getCroppedImg(imgRef.current, crop);
      
      // Create preview
      const objectUrl = URL.createObjectURL(croppedBlob);
      setPreviewUrl(objectUrl);
      setCropMode(false);
      setImageSrc(null);

      // Upload to storage
      const fileName = `${user.id}/profile.jpg`;

      // Delete existing files first
      await supabase.storage
        .from('profile-photos')
        .remove([`${user.id}/profile.jpg`, `${user.id}/profile.png`, `${user.id}/profile.webp`]);

      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(fileName, croppedBlob, { 
          upsert: true,
          contentType: 'image/jpeg'
        });

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

  const handleCropCancel = () => {
    setCropMode(false);
    setImageSrc(null);
    setCrop(undefined);
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

  // Crop mode UI
  if (cropMode && imageSrc) {
    return (
      <div className="flex flex-col items-center gap-4 w-full">
        <p className="text-sm text-muted-foreground">Drag to adjust crop</p>
        <div className="w-full max-w-[280px] rounded-lg overflow-hidden">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            aspect={1}
            circularCrop
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Crop preview"
              onLoad={onImageLoad}
              className="max-w-full"
            />
          </ReactCrop>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCropCancel}
            disabled={isUploading}
          >
            <X className="h-4 w-4 mr-1.5" />
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleCropConfirm}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-1.5" />
            )}
            {isUploading ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    );
  }

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
  );
};
