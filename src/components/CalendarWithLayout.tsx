import { useState } from "react";
import Layout from "@/components/Layout";
import Calendar from "@/pages/Calendar";
import { Button } from "@/components/ui/button";

export const CalendarWithLayout = () => {
  const [viewMode, setViewMode] = useState<"week" | "month">("week");

  const headerRightContent = (
    <div className="flex gap-1">
      <Button
        variant={viewMode === "week" ? "default" : "ghost"}
        size="sm"
        className="h-8 px-3 text-sm"
        onClick={() => setViewMode("week")}
      >
        Week
      </Button>
      <Button
        variant={viewMode === "month" ? "default" : "ghost"}
        size="sm"
        className="h-8 px-3 text-sm"
        onClick={() => setViewMode("month")}
      >
        Month
      </Button>
    </div>
  );

  return (
    <Layout headerRightContent={headerRightContent}>
      <Calendar viewMode={viewMode} onViewModeChange={setViewMode} />
    </Layout>
  );
};

export default CalendarWithLayout;
