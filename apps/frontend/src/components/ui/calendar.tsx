import * as React from "react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/shared/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("h-full w-full p-1", className)}
      classNames={{
        months: "flex h-full w-full flex-col",
        month: "w-full space-y-1.5",
        caption: "flex items-center justify-center pt-1 pb-1",
        caption_label: "hidden",
        nav: "hidden",
        dropdowns: "flex items-center justify-center gap-2",
        dropdown_root:
          "relative flex h-8 min-w-[92px] items-center rounded-md border border-border bg-card px-2 text-xs",
        dropdown:
          "h-full w-full bg-transparent pr-1 text-xs font-medium outline-none",
        chevron: "hidden",
        button_previous:
          "inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-muted/20",
        button_next:
          "inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-muted/20",
        month_grid: "w-full border-collapse",
        weekdays: "grid grid-cols-7",
        weekday:
          "text-center text-[10px] font-medium text-muted",
        week: "mt-1 grid grid-cols-7",
        day: "h-7 w-7 justify-self-center p-0 text-xs",
        day_button:
          "h-7 w-7 rounded-md text-xs font-normal hover:bg-muted/20",
        selected:
          "bg-primary text-white hover:bg-primary/90",
        today: "border border-primary/60",
        outside: "text-muted opacity-50",
        disabled: "text-muted opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
