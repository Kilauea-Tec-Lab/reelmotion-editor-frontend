"use client";

import * as React from "react";
import {
  Film,
  Music,
  Type,
  Subtitles,
  ImageIcon,
  FolderOpen,
  Sticker,
  Layout,
  ChevronLeft,
  Icon,
  ArrowBigLeft,
  ArrowDownLeft,
  ArrowLeft,
  Library,
  Crown,
} from "lucide-react";
import Image from "next/image";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useSidebar } from "../../contexts/sidebar-context";
import { VideoOverlayPanel } from "../overlays/video/video-overlay-panel";
import { TextOverlaysPanel } from "../overlays/text/text-overlays-panel";
import SoundsPanel from "../overlays/sounds/sounds-panel";
import Link from "next/link";
import { OverlayType } from "../../types";
import { CaptionsPanel } from "../overlays/captions/captions-panel";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ImageOverlayPanel } from "../overlays/images/image-overlay-panel";
import { LibraryPanel } from "../overlays/library/library-panel";
import { LocalMediaPanel } from "../overlays/local-media/local-media-panel";
import { StickersPanel } from "../overlays/stickers/stickers-panel";
import { TemplateOverlayPanel } from "../overlays/templates/template-overlay-panel";
import { useEditorContext } from "../../contexts/editor-context";
import { Button } from "@/components/ui/button";
import { SubscriptionModal } from "../shared/subscription-modal";

/**
 * AppSidebar Component
 *
 * A dual-sidebar layout component for the video editor application.
 * Consists of two parts:
 * 1. A narrow icon-based sidebar on the left for main navigation
 * 2. A wider content sidebar that displays the active panel's content
 *
 * @component
 * @param props - Props extending from the base Sidebar component
 */
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { activePanel, setActivePanel, setIsOpen } = useSidebar();
  const { setSelectedOverlayId, selectedOverlayId, overlays, isPro } = useEditorContext();
  const [showSubscriptionModal, setShowSubscriptionModal] = React.useState(false);

  React.useEffect(() => {
    if (selectedOverlayId !== null) {
      const selectedOverlay = overlays.find((o) => o.id === selectedOverlayId);
      if (selectedOverlay && selectedOverlay.type !== activePanel) {
        setActivePanel(selectedOverlay.type);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOverlayId]);

  const getPanelTitle = (type: OverlayType): string => {
    switch (type) {
      case OverlayType.VIDEO:
        return "Video";
      case OverlayType.TEXT:
        return "Text";
      case OverlayType.SOUND:
        return "Audio";
      case OverlayType.CAPTION:
        return "Caption";
      case OverlayType.IMAGE:
        return "Image";
      case OverlayType.LIBRARY:
        return "Library";
      case OverlayType.LOCAL_DIR:
        return "Uploads";
      case OverlayType.STICKER:
        return "Stickers";
      case OverlayType.TEMPLATE:
        return "Template";
      default:
        return "Unknown";
    }
  };

  const navigationItems = [
    {
      title: getPanelTitle(OverlayType.VIDEO),
      url: "#",
      icon: Film,
      panel: OverlayType.VIDEO,
      type: OverlayType.VIDEO,
    },
    
    {
      title: getPanelTitle(OverlayType.TEXT),
      url: "#",
      icon: Type,
      panel: OverlayType.TEXT,
      type: OverlayType.TEXT,
    },
    {
      title: getPanelTitle(OverlayType.SOUND),
      url: "#",
      icon: Music,
      panel: OverlayType.SOUND,
      type: OverlayType.SOUND,
    },
    {
      title: getPanelTitle(OverlayType.CAPTION),
      url: "#",
      icon: Subtitles,
      panel: OverlayType.CAPTION,
      type: OverlayType.CAPTION,
    },
    /*
    {
      title: getPanelTitle(OverlayType.IMAGE),
      url: "#",
      icon: ImageIcon,
      panel: OverlayType.IMAGE,
      type: OverlayType.IMAGE,
    },
    */
    {
      title: getPanelTitle(OverlayType.STICKER),
      url: "#",
      icon: Sticker,
      panel: OverlayType.STICKER,
      type: OverlayType.STICKER,
    },
    {
      title: getPanelTitle(OverlayType.LIBRARY),
      url: "#",
      icon: Library,
      panel: OverlayType.LIBRARY,
      type: OverlayType.LIBRARY,
    },
    {
      title: getPanelTitle(OverlayType.LOCAL_DIR),
      url: "#",
      icon: FolderOpen,
      panel: OverlayType.LOCAL_DIR,
      type: OverlayType.LOCAL_DIR,
    },
    /*
    {
      title: getPanelTitle(OverlayType.TEMPLATE),
      url: "#",
      icon: Layout,
      panel: OverlayType.TEMPLATE,
      type: OverlayType.TEMPLATE,
    },*/
  ];

  /**
   * Renders the appropriate panel component based on the active panel selection
   * @returns {React.ReactNode} The component corresponding to the active panel
   */
  const renderActivePanel = () => {
    switch (activePanel) {
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
      case OverlayType.STICKER:
        return <StickersPanel />;
      case OverlayType.LIBRARY:
        return <LibraryPanel />;
      case OverlayType.LOCAL_DIR:
        return <LocalMediaPanel />;
      case OverlayType.TEMPLATE:
        return <TemplateOverlayPanel />;
      default:
        return null;
    }
  };

  return (
    <Sidebar
      collapsible="icon"
      className="overflow-hidden [&>[data-sidebar=sidebar]]:flex-row border-r border-1 dark:bg-darkBox border-gray-100/10"
      {...props}
    >
      {/* First sidebar */}
      <Sidebar
        collapsible="none"
        className="!w-[calc(var(--sidebar-width-icon)_+_1px)] dark:bg-darkBox border-gray-100/10 border-r"
      >
        <SidebarHeader className="">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild className="md:h-8 md:py-4">
                <a href="https://reelmotion.ai">
                  <div className="flex aspect-square size-9 items-center justify-center rounded-lg">
                    <Image
                      src="/icons/icon_reelmotion_ai.png"
                      alt="Logo"
                      width={27}
                      height={27}
                    />
                  </div>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            {navigationItems.map((item) => {
              const isLocked =
                (item.panel === OverlayType.CAPTION ||
                  item.panel === OverlayType.TEXT ||
                  item.panel === OverlayType.LIBRARY) &&
                !isPro;
              return (
                <TooltipProvider key={item.title} delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton
                        onClick={() => {
                          if (isLocked) {
                            setShowSubscriptionModal(true);
                            return;
                          }
                          setActivePanel(item.panel);
                          setIsOpen(true);
                        }}
                        size="lg"
                        className={`flex flex-col items-center gap-2 px-1.5 py-2 ${
                          activePanel === item.panel
                            ? "bg-primary/10 text-primary hover:bg-primary/10"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <div className="relative">
                          <item.icon
                            className="h-4 w-4 text-gray-700 dark:text-white font-light"
                            strokeWidth={1.25}
                          />
                          {isLocked && (
                            <div className="absolute -top-3 -right-3 bg-darkBox rounded-full p-0.5 border border-border">
                              <Crown className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                            </div>
                          )}
                        </div>
                        <span className="text-[8px] font-medium leading-none">
                          {item.title}
                        </span>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent
                      side="right"
                      className="border dark:bg-darkBox  text-foreground"
                    >
                      {item.title} {isLocked && "(Pro)"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </SidebarGroup>
          <SubscriptionModal open={showSubscriptionModal} onOpenChange={setShowSubscriptionModal} />
        </SidebarContent>
        <SidebarFooter className="border-t">
          <SidebarGroup>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarMenuButton
                    asChild
                    size="lg"
                    className="flex flex-col items-center gap-2 px-1.5 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <a href={process.env.NEXT_PUBLIC_REELMOTION_URL}>
                      <ArrowLeft
                        className="h-4 w-4 text-gray-700 dark:text-white font-light"
                        strokeWidth={1.25}
                      />
                      <span className="text-[8px] font-medium leading-none">
                        Return
                      </span>
                    </a>
                  </SidebarMenuButton>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  className="border dark:bg-darkBox  text-foreground"
                >
                  Return
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </SidebarGroup>
        </SidebarFooter>
      </Sidebar>

      {/* Second sidebar */}
      <Sidebar
        collapsible="none"
        className="hidden flex-1 md:flex dark:bg-darkBox  border-r border-gray-100/10"
      >
        <SidebarHeader className="gap-3.5 border-b px-4 py-[12px]">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              {selectedOverlayId !== null && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setSelectedOverlayId(null)}
                  aria-label="Back"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              <div className="text-base font-medium text-foreground">
                {activePanel ? getPanelTitle(activePanel) : ""}
              </div>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent className="text-foreground dark:bg-darkBox ">
          {renderActivePanel()}
        </SidebarContent>
      </Sidebar>
    </Sidebar>
  );
}
