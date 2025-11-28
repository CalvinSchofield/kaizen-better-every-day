import { CalendarView } from "@/components/CalendarView";
import { useRepData } from "@/hooks/useRepData";

const Calendar = () => {
  const { repData } = useRepData();

  // TODO: Fetch daily entries
  // TODO: Parse blitzes and personal summer dates

  return <CalendarView />;
};

export default Calendar;