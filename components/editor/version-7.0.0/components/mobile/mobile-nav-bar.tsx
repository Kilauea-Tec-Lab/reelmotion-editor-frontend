"use client";

import * as React from "react";
import {
  Film,
  Music,
  Type,
  Subtitles,
  FolderOpen,
  Sticker,
  Layout,
  Plus,
  X,
  Library,
  ChevronLeft,
} from "lucide-react";
import { useSidebar } from "../../contexts/sidebar-context";
import { useEditorContext } from "../../contexts/editor-context";
import { OverlayType } from "../../types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import { useEffect, useState, useRef, Suspense, useCallback, startTransition } from "react";
import { Loader2 } from "lucide-react";

// Lazy load all panel components - they only load when first accessed
const VideoOverlayPanel = React.lazy(() => import("../overlays/video/video-overlay-panel").then(m => ({ default: m.VideoOverlayPanel })));
const TextOverlaysPanel = React.lazy(() => import("../overlays/text/text-overlays-panel").then(m => ({ default: m.TextOverlaysPanel })));
const SoundsPanel = React.lazy(() => import("../overlays/sounds/sounds-panel"));
const CaptionsPanel = React.lazy(() => import("../overlays/captions/captions-panel").then(m => ({ default: m.CaptionsPanel })));
const ImageOverlayPanel = React.lazy(() => import("../overlays/images/image-overlay-panel").then(m => ({ default: m.ImageOverlayPanel })));
const StickersPanel = React.lazy(() => import("../overlays/stickers/stickers-panel").then(m => ({ default: m.StickersPanel })));
const LocalMediaPanel = React.lazy(() => import("../overlays/local-media/local-media-panel").then(m => ({ default: m.LocalMediaPanel })));
const TemplateOverlayPanel = React.lazy(() => import("../overlays/templates/template-overlay-panel").then(m => ({ default: m.TemplateOverlayPanel })));
const LibraryPanel = React.lazy(() => import("../overlays/library/library-panel").then(m => ({ default: m.LibraryPanel })));

// Panel title mapping (static, no need to recreate)
const PANEL_TITLES: Record<string, string> = {
  [OverlayType.VIDEO]: "Video",
  [OverlayType.TEXT]: "Text",
  [OverlayType.SOUND]: "Audio",
  [OverlayType.CAPTION]: "Caption",
  [OverlayType.IMAGE]: "Image",
  [OverlayType.LIBRARY]: "Library",
  [OverlayType.LOCAL_DIR]: "Media",
  [OverlayType.STICKER]: "Sticker",
  [OverlayType.TEMPLATE]: "Template",
};

const NAVIGATION_ITEMS = [
  { title: "Video", icon: Film, panel: OverlayType.VIDEO },
  { title: "Text", icon: Type, panel: OverlayType.TEXT },
  { title: "Audio", icon: Music, panel: OverlayType.SOUND },
  { title: "Caption", icon: Subtitles, panel: OverlayType.CAPTION },
  { title: "Library", icon: Library, panel: OverlayType.LIBRARY },
  { title: "Sticker", icon: Sticker, panel: OverlayType.STICKER },
  { title: "Media", icon: FolderOpen, panel: OverlayType.LOCAL_DIR },
  { title: "Template", icon: Layout, panel: OverlayType.TEMPLATE },
];

/**
 * MobileNavBar Component
 *
 * A compact mobile-only navigation bar that displays overlay type icons
 * with a horizontal scrollable interface. Designed to match the TimelineControls
 * visual style while remaining compact for mobile screens.
 */
export function MobileNavBar() {
  const { activePanel, setActivePanel } = useSidebar();
  const { selectedOverlayId, setSelectedOverlayId } = useEditorContext();
  const scrollableRef = useRef<HTMLDivElement>(null);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  // Track which panel to render (deferred from activePanel to not block sheet open)
  const [renderedPanel, setRenderedPanel] = useState<OverlayType | null>(null);

  // Check if scrolling is needed
  useEffect(() => {
    const checkScrollWidth = () => {
      if (scrollableRef.current) {
        const { scrollWidth, clientWidth } = scrollableRef.current;
        setShowScrollIndicator(scrollWidth > clientWidth);
      }
    };

    checkScrollWidth();
    window.addEventListener("resize", checkScrollWidth);
    return () => window.removeEventListener("resize", checkScrollWidth);
  }, []);

  // Scroll active item into view when it changes
  useEffect(() => {
    if (activePanel && scrollableRef.current) {
      const activeItem = scrollableRef.current.querySelector(
        `[data-panel="${activePanel}"]`
      ) as HTMLElement;

      if (activeItem) {
        const containerWidth = scrollableRef.current.offsetWidth;
        const itemLeft = activeItem.offsetLeft;
        const itemWidth = activeItem.offsetWidth;
        const scrollLeft = itemLeft - containerWidth / 2 + itemWidth / 2;

        scrollableRef.current.scrollTo({
          left: scrollLeft,
          behavior: "smooth",
        });
      }
    }
  }, [activePanel]);

  const renderActivePanel = () => {
    switch (renderedPanel) {
      case OverlayType.TEXT:
        return <TextOverlaysPanel />;
      case OverlayType.SOUND:
        return <SoundsPanel />;
      case OverlayType.VIDEO:
        return <VideoOverlayPanel />;
      case OverlayType.CAPTION:
        return <CaptionsPanel />;
      case OverlayType.IMAGE:
        return <ImageOverlayPanel />;
      case OverlayType.LIBRARY:
        return <LibraryPanel />;
      case OverlayType.STICKER:
        return <StickersPanel />;
      case OverlayType.LOCAL_DIR:
        return <LocalMediaPanel />;
      case OverlayType.TEMPLATE:
        return <TemplateOverlayPanel />;
      default:
        return null;
    }
  };

  const handleItemClick = useCallback((panel: OverlayType) => {
    // Open sheet immediately for instant visual feedback
    setActivePanel(panel);
    setIsSheetOpen(true);

    // Defer the heavy panel render so the sheet animation isn't blocked
    startTransition(() => {
      setRenderedPanel(panel);
    });
  }, [setActivePanel]);

  const handleSheetChange = useCallback((open: boolean) => {
    setIsSheetOpen(open);
    if (!open) {
      // Clear rendered panel when sheet closes to free memory
      setRenderedPanel(null);
    }
  }, []);

  return (
    <>
      <div className="md:hidden flex flex-col border-t border-gray-200 dark:border-gray-100/10 bg-white/95 dark:bg-darkBox  backdrop-blur-sm">
        <div className="relative flex-1 flex">
          {showScrollIndicator && (
            <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-white/90 to-transparent dark:from-gray-900/90 z-10 pointer-events-none" />
          )}

          <div
            ref={scrollableRef}
            className="flex-1 flex items-center overflow-x-auto scrollbar-hide px-1 py-2 overflow-auto gap-1.5 relative"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            {NAVIGATION_ITEMS.map((item) => (
              <button
                key={item.panel}
                data-panel={item.panel}
                onClick={() => handleItemClick(item.panel)}
                className={`rounded flex flex-col items-center px-2 py-1.5
                  ${
                    activePanel === item.panel
                      ? "bg-gray-100 text-gray-900 dark:bg-darkBoxSub  dark:text-white shadow-sm"
                      : "text-gray-700 dark:text-zinc-200 active:bg-gray-100 dark:active:bg-gray-800/50"
                  } transition-colors`}
              >
                <item.icon className="h-4 w-4" />
              </button>
            ))}

            {showScrollIndicator && (
              <button
                onClick={() => {
                  if (scrollableRef.current) {
                    scrollableRef.current.scrollBy({
                      left: 100,
                      behavior: "smooth",
                    });
                  }
                }}
                className="flex items-center justify-center h-9 min-w-9 px-2 rounded bg-gray-50 dark:bg-darkBoxSub /50 text-gray-500 dark:text-gray-400"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>

          {showScrollIndicator && (
            <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-white/90 to-transparent dark:from-gray-900/90 z-10 pointer-events-none" />
          )}
        </div>

        {isSheetOpen && (
          <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-1 pointer-events-none">
            <div className="h-1 w-10 bg-gray-300 dark:bg-gray-700 rounded-full opacity-50" />
          </div>
        )}
      </div>

      {/* Bottom Sheet for Mobile */}
      <Sheet open={isSheetOpen} onOpenChange={handleSheetChange}>
        <SheetContent
          side="bottom"
          className="pt-4 h-[70vh] rounded-t-xl pb-0 px-0 overflow-hidden"
        >
          <div className="flex flex-col h-full">
            <SheetHeader className="px-4 pb-3 border-b">
              <SheetTitle className="text-left text-lg font-light flex items-center gap-2">
                {selectedOverlayId !== null && (
                  <button
                    onClick={() => setSelectedOverlayId(null)}
                    className="h-6 w-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    aria-label="Back"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                )}
                {activePanel && PANEL_TITLES[activePanel]}
              </SheetTitle>
              <SheetClose className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </SheetClose>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-0">
              <Suspense fallback={
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              }>
                {isSheetOpen && renderActivePanel()}
              </Suspense>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
