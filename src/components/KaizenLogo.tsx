import { useEffect, useState } from "react";

const KaizenLogo = () => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check initial theme
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    
    checkTheme();
    
    // Watch for theme changes
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  return (
    <div className="text-center">
      <div className="text-5xl font-bold text-primary mb-1">
        Kaizen
      </div>
      <div className={`font-cursive text-3xl ${isDark ? 'text-white' : 'text-black'}`}>
        better every day
      </div>
    </div>
  );
};

export default KaizenLogo;
