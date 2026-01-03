-- Add unique constraint on user_id and device_token for upsert support
ALTER TABLE public.apns_device_tokens 
ADD CONSTRAINT apns_device_tokens_user_token_unique 
UNIQUE (user_id, device_token);