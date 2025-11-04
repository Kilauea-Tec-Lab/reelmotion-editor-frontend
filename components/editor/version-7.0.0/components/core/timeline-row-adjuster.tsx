import { useEffect } from "react";
import { useTimeline } from "../../contexts/timeline-context";
import { useEditorContext } from "../../contexts/editor-context";
import { INITIAL_ROWS } from "../../constants";

/**
 * Component that automatically adjusts the number of visible timeline rows
 * based on the overlays present in the editor.
 * 
 * This component doesn't render anything but watches for changes in overlays
 * and ensures the timeline has enough rows to display all content.
 */
export const TimelineRowAdjuster: React.FC = () => {
  const { overlays } = useEditorContext();
  const { setVisibleRows } = useTimeline();

  useEffect(() => {
    if (!overlays || overlays.length === 0) {
      // If no overlays, keep at least INITIAL_ROWS
      setVisibleRows(INITIAL_ROWS);
      return;
    }

    // Find the maximum row number used by any overlay
    const maxRow = Math.max(...overlays.map((overlay) => overlay.row || 0));
    
    // Ensure we have at least enough rows to show all overlays
    // Add 1 because rows are 0-indexed (row 0, row 1, etc.)
    const requiredRows = Math.max(maxRow + 1, INITIAL_ROWS);
    
    setVisibleRows(requiredRows);
  }, [overlays, setVisibleRows]);

  return null;
};
