-- Add custom spending rate field to rep_goals for users who haven't tracked all spending
ALTER TABLE public.rep_goals 
ADD COLUMN IF NOT EXISTS custom_spending_rate numeric;