import { useState, useEffect } from 'react';

export const useScrollDirection = (threshold = 50) => {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      // Try window scroll first
      let currentScrollY = window.scrollY;
      
      // If window isn't scrolling, check for scrollable containers
      if (currentScrollY === 0) {
        // Check common scrollable containers
        const mainElement = document.querySelector('main');
        const scrollableDiv = document.querySelector('[class*="overflow-auto"]') || 
                              document.querySelector('[class*="overflow-y-auto"]');
        
        if (mainElement && mainElement.scrollTop > 0) {
          currentScrollY = mainElement.scrollTop;
        } else if (scrollableDiv && (scrollableDiv as HTMLElement).scrollTop > 0) {
          currentScrollY = (scrollableDiv as HTMLElement).scrollTop;
        }
      }
      
      setIsVisible(currentScrollY < lastScrollY || currentScrollY < threshold);
      setLastScrollY(currentScrollY);
    };

    // Listen to window scroll
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Also listen to scroll on main element
    const mainElement = document.querySelector('main');
    if (mainElement) {
      mainElement.addEventListener('scroll', handleScroll, { passive: true });
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (mainElement) {
        mainElement.removeEventListener('scroll', handleScroll);
      }
    };
  }, [lastScrollY, threshold]);

  return isVisible;
};
