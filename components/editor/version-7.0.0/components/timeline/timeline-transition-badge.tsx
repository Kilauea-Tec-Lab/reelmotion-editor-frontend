import React from "react";
import { Overlay } from "../../types";
import { useSidebar } from "../../contexts/sidebar-context";

interface TimelineTransitionBadgeProps {
  /** Clip that starts at the junction (owner of `transitionIn`). */
  incoming: Overlay & { transitionIn?: unknown };
  totalDuration: number;
  setSelectedItem: (item: { id: number }) => void;
}

/**
 * Small button at the cut between two adjacent clips. Filled when a
 * transition is set; click selects the incoming clip and opens its panel.
 */
export const TimelineTransitionBadge: React.FC<TimelineTransitionBadgeProps> = ({
  incoming,
  totalDuration,
  setSelectedItem,
}) => {
  const { setActivePanel, setIsOpen } = useSidebar();
  const hasTransition = !!incoming.transitionIn;

  return (
    <button
      type="button"
      title={hasTransition ? "Transition" : "Add transition"}
      className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-4 h-4 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${
        hasTransition ? "bg-primarioLogo" : "bg-gray-500/80 hover:bg-primarioLogo"
      }`}
      style={{ left: `${(incoming.from / totalDuration) * 100}%` }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedItem({ id: incoming.id });
        setActivePanel(incoming.type);
        setIsOpen(true);
      }}
    >
      <svg viewBox="0 0 10 10" className="w-2 h-2 text-white" fill="currentColor">
        <path d="M0 5 L4 1 L4 9 Z M10 5 L6 1 L6 9 Z" />
      </svg>
    </button>
  );
};
