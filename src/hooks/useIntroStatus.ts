import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useIntroStatus = (userId: string | undefined) => {
  const [hasSeenIntro, setHasSeenIntro] = useState(true); // Default true to prevent flash
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    if (!userId) {
      setHasSeenIntro(true);
      setIsLoading(false);
      return;
    }
    
    const checkIntroStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('reps')
          .select('intro_seen')
          .eq('user_id', userId)
          .maybeSingle();
        
        if (error) {
          console.error('Error checking intro status:', error);
          setHasSeenIntro(true); // Default to true on error
        } else {
          setHasSeenIntro(data?.intro_seen ?? false);
        }
      } catch (err) {
        console.error('Error checking intro status:', err);
        setHasSeenIntro(true);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkIntroStatus();
  }, [userId]);
  
  const markIntroComplete = useCallback(async () => {
    if (!userId) return;
    
    try {
      const { error } = await supabase
        .from('reps')
        .update({ intro_seen: true })
        .eq('user_id', userId);
      
      if (error) {
        console.error('Error marking intro complete:', error);
      } else {
        setHasSeenIntro(true);
      }
    } catch (err) {
      console.error('Error marking intro complete:', err);
    }
  }, [userId]);
  
  const resetIntro = useCallback(async () => {
    if (!userId) return;
    
    try {
      const { error } = await supabase
        .from('reps')
        .update({ intro_seen: false })
        .eq('user_id', userId);
      
      if (error) {
        console.error('Error resetting intro:', error);
      } else {
        setHasSeenIntro(false);
      }
    } catch (err) {
      console.error('Error resetting intro:', err);
    }
  }, [userId]);
  
  return { hasSeenIntro, isLoading, markIntroComplete, resetIntro };
};
