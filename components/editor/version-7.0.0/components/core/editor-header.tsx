import { useState, useEffect } from "react";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Image from "next/image";
import dynamic from "next/dynamic";
import { Check, Keyboard } from "lucide-react";

import RenderControls from "../rendering/render-controls";
import { useEditorContext } from "../../contexts/editor-context";

/**
 * Dynamic import of the ThemeToggle component to enable client-side rendering only.
 * This prevents hydration mismatches since theme detection requires browser APIs.
 */
const ThemeToggleClient = dynamic(
  () =>
    import("@/components/theme-toggle")
      .then((mod) => mod.ThemeToggle)
      .catch((err) => {
        console.error("Error loading ThemeToggle:", err);
        return () => null; // Fallback component
      }),
  {
    ssr: false,
    loading: () => <></>, // Optional loading state
  }
);

/**
 * EditorHeader component renders the top navigation bar of the editor interface.
 *
 * @component
 * @description
 * This component provides the main navigation and control elements at the top of the editor:
 * - A sidebar trigger button for showing/hiding the sidebar
 * - A visual separator
 * - A theme toggle switch for light/dark mode
 * - Rendering controls for media export
 *
 * The header is sticky-positioned at the top of the viewport and includes
 * responsive styling for both light and dark themes.
 *
 * @example
 * ```tsx
 * <EditorHeader />
 * ```
 *
 * @returns {JSX.Element} A header element containing navigation and control components
 */
export function EditorHeader() {
  /**
   * Destructure required values from the editor context:
   * - renderMedia: Function to handle media rendering/export
   * - state: Current editor state
   * - renderType: Type of render
   * - editionData: Edition data for backend save
   * - loadEdit: Function to load an edit from backend
   */
  const { renderMedia, state, saveProject, renderType, editionData, loadEdit, lastSaveTime } = useEditorContext();

  const [showSaved, setShowSaved] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    if (lastSaveTime) {
      setShowSaved(true);
      const timer = setTimeout(() => setShowSaved(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [lastSaveTime]);

  return (
    <header
      className="sticky top-0 flex shrink-0 items-center gap-2.5 
      bg-white dark:bg-gray-900/10
      border-l 
      border-b border-gray-100/10 dark:border-gray-100/10
      p-2.5 px-4.5"
    >
      {/* Logo for mobile (hidden on desktop where sidebar shows it) */}
      <a href="https://reelmotion.ai" className="sm:hidden flex items-center">
        <Image
          src="/icons/icon_reelmotion_ai.png"
          alt="Logo"
          width={27}
          height={27}
        />
      </a>

      {/* Sidebar toggle button with theme-aware styling */}
      <SidebarTrigger className="hidden sm:block text-gray-700 dark:text-gray-300" />

      {/* Vertical separator for visual organization */}
      <Separator
        orientation="vertical"
        className="hidden sm:block mr-2.5 h-5"
      />

      {/* Theme toggle component (client-side only) */}
      <ThemeToggleClient />

      {/* Autosave status indicator */}
      {showSaved && (
        <span className="text-xs text-green-500 flex items-center gap-1 animate-in fade-in duration-300">
          <Check className="h-3 w-3" />
          Saved
        </span>
      )}

      {/* Keyboard shortcuts button (desktop only) */}
      <Button variant="ghost" size="icon" onClick={() => setShortcutsOpen(true)} aria-label="Keyboard shortcuts" className="hidden sm:flex">
        <Keyboard className="h-4 w-4" />
      </Button>

      {/* Spacer to push rendering controls to the right */}
      <div className="flex-grow" />

      {/* Media rendering controls */}
      <RenderControls
        handleRender={renderMedia}
        state={state}
        saveProject={saveProject}
        renderType={renderType}
        editionData={editionData}
        onLoadEdit={loadEdit}
      />
      {/* Keyboard Shortcuts Dialog */}
      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Keyboard Shortcuts</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span>Play / Pause</span><kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs">Alt + Space</kbd></div>
            <div className="flex justify-between"><span>Undo</span><kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs">Ctrl + Z</kbd></div>
            <div className="flex justify-between"><span>Redo</span><kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs">Ctrl + Y</kbd></div>
            <div className="flex justify-between"><span>Save</span><kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs">Ctrl + S</kbd></div>
            <div className="flex justify-between"><span>Zoom In</span><kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs">Alt + =</kbd></div>
            <div className="flex justify-between"><span>Zoom Out</span><kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs">Alt + -</kbd></div>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
