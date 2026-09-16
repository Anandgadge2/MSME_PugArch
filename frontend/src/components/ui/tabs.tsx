import * as React from "react";
import { cn } from "../../lib/utils";

interface TabsProps {
  tabs: { id: string; label: string; icon?: React.ReactNode }[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

const Tabs = ({ tabs, activeTab, onChange, className }: TabsProps) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    
    e.preventDefault();
    const currentIndex = tabs.findIndex((t) => t.id === activeTab);
    if (currentIndex === -1) return;

    let nextIndex: number;
    if (e.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    }

    const nextTab = tabs[nextIndex];
    if (nextTab) {
      onChange(nextTab.id);
      const nextElement = document.getElementById(`tab-${nextTab.id}`);
      nextElement?.focus();
    }
  };

  return (
    <div
      role="tablist"
      aria-label="Navigation tabs"
      onKeyDown={handleKeyDown}
      className={cn("flex space-x-0 border-b border-slate-200", className)}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          id={`tab-${tab.id}`}
          role="tab"
          type="button"
          aria-selected={activeTab === tab.id}
          tabIndex={activeTab === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)}
          className={cn(
            "flex items-center justify-center space-x-2 px-3 py-2 text-xs sm:px-6 sm:py-3 sm:text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:outline-none border-b-2",
            activeTab === tab.id
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
};

export { Tabs };
