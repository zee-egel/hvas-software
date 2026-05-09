import { Bell } from "./Icons";

interface HeaderProps {
  currentWeek: number;
  currentTime: string;
}

export default function Header({ currentWeek, currentTime }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-8 md:px-10 py-6 border-b border-border/10 bg-bg">
      <div>
        <h2 className="text-[1.75rem] leading-tight font-semibold text-heading tracking-tight">
          Dashboard Overview
        </h2>
        <p className="text-sm text-subtitle mt-1">
          Real-time inventory intelligence for your restaurant
        </p>
      </div>

      <div className="flex items-center gap-5">
        <span className="text-sm text-body font-medium">
          Week {currentWeek} &middot; {currentTime}
        </span>
        <button className="relative p-2 rounded-md hover:bg-card transition-colors">
          <Bell className="w-5 h-5 text-body" />
        </button>
      </div>
    </header>
  );
}
