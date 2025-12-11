import { createContext, useContext, useState, ReactNode } from "react";

interface HeaderContextType {
  customTitle: string | null;
  setCustomTitle: (title: string | null) => void;
  customRightContent: ReactNode | null;
  setCustomRightContent: (content: ReactNode | null) => void;
}

const HeaderContext = createContext<HeaderContextType | null>(null);

export const HeaderProvider = ({ children }: { children: ReactNode }) => {
  const [customTitle, setCustomTitle] = useState<string | null>(null);
  const [customRightContent, setCustomRightContent] = useState<ReactNode | null>(null);

  return (
    <HeaderContext.Provider value={{ customTitle, setCustomTitle, customRightContent, setCustomRightContent }}>
      {children}
    </HeaderContext.Provider>
  );
};

export const useHeader = () => {
  const context = useContext(HeaderContext);
  if (!context) {
    throw new Error("useHeader must be used within HeaderProvider");
  }
  return context;
};
