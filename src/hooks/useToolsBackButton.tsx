import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHeader } from "@/contexts/HeaderContext";

/**
 * Sets a back button in the header that navigates to /tools.
 * Call at the top level of any tools sub-page component.
 */
export const useToolsBackButton = () => {
  const navigate = useNavigate();
  const { setCustomLeftContent } = useHeader();

  useEffect(() => {
    setCustomLeftContent(
      <Button variant="ghost" size="icon" onClick={() => navigate('/tools')} className="h-10 w-10">
        <ChevronLeft className="h-5 w-5" />
      </Button>
    );
    return () => {
      setCustomLeftContent(null);
    };
  }, [navigate, setCustomLeftContent]);
};
