import { useState, useCallback, useEffect } from 'react';

export type VisualizationMode = 'ring' | 'timeline';

const STORAGE_KEY = 'activity-visualization-preference';

export const useVisualizationPreference = () => {
  const [mode, setMode] = useState<VisualizationMode>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return (stored === 'timeline' ? 'timeline' : 'ring') as VisualizationMode;
    } catch {
      return 'ring';
    }
  });

  const setPreference = useCallback((newMode: VisualizationMode) => {
    setMode(newMode);
    try {
      localStorage.setItem(STORAGE_KEY, newMode);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const toggle = useCallback(() => {
    setPreference(mode === 'ring' ? 'timeline' : 'ring');
  }, [mode, setPreference]);

  return {
    mode,
    setMode: setPreference,
    toggle,
    isRing: mode === 'ring',
    isTimeline: mode === 'timeline',
  };
};
