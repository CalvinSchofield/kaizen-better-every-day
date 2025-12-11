-- Add profile_photo_url column to reps table
ALTER TABLE public.reps ADD COLUMN profile_photo_url text;

-- Create storage bucket for profile photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true);

-- Allow authenticated users to upload their own profile photos
CREATE POLICY "Users can upload own profile photo"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'profile-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to update their own profile photos
CREATE POLICY "Users can update own profile photo"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'profile-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to delete their own profile photos
CREATE POLICY "Users can delete own profile photo"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'profile-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow public read access to profile photos
CREATE POLICY "Public can view profile photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'profile-photos');