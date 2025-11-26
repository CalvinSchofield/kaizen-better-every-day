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
    <svg
      viewBox="0 0 400 200"
      className="w-48 mx-auto opacity-80"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Kaizen in orange */}
      <text
        x="200"
        y="80"
        fontFamily="Arial, sans-serif"
        fontSize="64"
        fontWeight="bold"
        fill="#f68b1f"
        textAnchor="middle"
      >
        Kaizen
      </text>
      
      {/* better every day in script - adapts to theme */}
      <text
        x="200"
        y="140"
        fontFamily="'Brush Script MT', cursive"
        fontSize="36"
        fontStyle="italic"
        fill={isDark ? "#ffffff" : "#000000"}
        textAnchor="middle"
      >
        better every day
      </text>
    </svg>
  );
};

export default KaizenLogo;
