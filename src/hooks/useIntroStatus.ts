import { useState, useEffect, useCallback } from 'react';

const getIntroKey = (userId: string) => `kaizen-intro-completed-${userId}`;

export const useIntroStatus = (userId: string | undefined) => {
  const [hasSeenIntro, setHasSeenIntro] = useState(true); // Default true to prevent flash
  
  useEffect(() => {
    if (!userId) {
      setHasSeenIntro(true);
      return;
    }
    
    const key = getIntroKey(userId);
    const completed = localStorage.getItem(key) === 'true';
    setHasSeenIntro(completed);
  }, [userId]);
  
  const markIntroComplete = useCallback(() => {
    if (!userId) return;
    const key = getIntroKey(userId);
    localStorage.setItem(key, 'true');
    setHasSeenIntro(true);
  }, [userId]);
  
  const resetIntro = useCallback(() => {
    if (!userId) return;
    const key = getIntroKey(userId);
    localStorage.removeItem(key);
    setHasSeenIntro(false);
  }, [userId]);
  
  return { hasSeenIntro, markIntroComplete, resetIntro };
};
