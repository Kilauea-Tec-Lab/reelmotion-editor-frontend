import React from "react";
import Cookies from "js-cookie";
import { Download, Loader2, Bell, Save, FolderOpen, ChevronDown, Lock, Crown, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { SaveEditDialog } from "./save-edit-dialog";
import { LoadEditDialog } from "./load-edit-dialog";
import { SaveRenderDialog } from "./save-render-dialog";
import { useEditorContext } from "../../contexts/editor-context";
import { SubscriptionModal } from "../shared/subscription-modal";
import { useTranslation } from "@/lib/i18n";
import { LanguageSelector } from "@/components/language-selector";

/**
 * Interface representing a single video render attempt
 * @property {string} url - URL of the rendered video (if successful)
 * @property {Date} timestamp - When the render was completed
 * @property {string} id - Unique identifier for the render
 * @property {'success' | 'error'} status - Result of the render attempt
 * @property {string} error - Error message if render failed
 */
interface RenderItem {
  url?: string;
  timestamp: Date;
  id: string;
  status: "success" | "error";
  error?: string;
}

/**
 * Props for the RenderControls component
 * @property {object} state - Current render state containing status, progress, and URL
 * @property {() => void} handleRender - Function to trigger a new render
 * @property {() => void} saveProject - Function to save the project (deprecated, use editionData)
 * @property {('ssr' | 'lambda' | 'cloudrun')?} renderType - Type of render (SSR, Lambda, or Cloud Run)
 * @property {object} editionData - Edition data to be saved to backend
 * @property {function} onLoadEdit - Callback function when an edit is loaded
 */
interface RenderControlsProps {
  state: any;
  handleRender: () => void;
  saveProject?: () => Promise<void>;
  renderType?: "ssr" | "lambda" | "cloudrun";
  editionData?: {
    id: string;
    inputProps: any;
  };
  onLoadEdit?: (editionData: any) => void;
}

/**
 * RenderControls component provides UI controls for video rendering functionality
 *
 * Features:
 * - Render button that shows progress during rendering
 * - Notification bell showing render history
 * - Download buttons for completed renders
 * - Error display for failed renders
 *
 * The component maintains a history of render attempts, both successful and failed,
 * and provides visual feedback about the current render status.
 */
const RenderControls: React.FC<RenderControlsProps> = ({
  state,
  handleRender,
  saveProject,
  renderType = "ssr",
  editionData,
  onLoadEdit,
}) => {
  // Store multiple renders
  const [renders, setRenders] = React.useState<RenderItem[]>([]);
  // Track if there are new renders
  const [hasNewRender, setHasNewRender] = React.useState(false);
  const { t } = useTranslation();

  // Use EditorContext to get subscription info, dimensions, overlays and export count
  const { subscriptionPlan, isPro, getAspectRatioDimensions, getRenderDimensions, overlays, exportNumber } = useEditorContext();

  // Check if timeline has elements
  const isTimelineEmpty = !overlays || overlays.length === 0;

  // Check if free user has exhausted export limit (3 or more)
  const isFreeExportBlocked = (subscriptionPlan || 'free').toLowerCase() === 'free' && exportNumber >= 3;

  // Track save dialog state
  const [isSaveDialogOpen, setIsSaveDialogOpen] = React.useState(false);
  // Track load dialog state
  const [isLoadDialogOpen, setIsLoadDialogOpen] = React.useState(false);
  // Track save render dialog state
  const [isSaveRenderDialogOpen, setIsSaveRenderDialogOpen] = React.useState(false);
  // Track selected video URL for saving
  const [selectedVideoUrl, setSelectedVideoUrl] = React.useState<string>("");
  // Track subscription modal state
  const [showSubscriptionModal, setShowSubscriptionModal] = React.useState(false);

  // Check if rendering is disabled via environment variable
  const isRenderDisabled = process.env.NEXT_PUBLIC_DISABLE_RENDER === "true";

  const handleExport = (resolution: '720p' | '1080p' | '4k') => {
    // Use the ACTUAL render dimensions (after free-tier downscale) so the
    // scale factor produces clean integer output dimensions. Using the raw
    // aspect-ratio dimensions here would double-scale and yield fractional
    // sizes that h264 pads with gray pixels on the right/bottom edges.
    const { width: renderW, height: renderH } = getRenderDimensions();

    // Target long side based on resolution
    // 720p = 1280, 1080p = 1920, 4K = 3840
    const targetLongSide = resolution === '4k' ? 3840 : resolution === '1080p' ? 1920 : 1280;

    const currentLongSide = Math.max(renderW, renderH);
    const renderScale = targetLongSide / currentLongSide;

    // Call render with scale factor — Remotion handles the uniform upscaling
    (handleRender as any)({ scale: renderScale });

    // Notify backend if subscription is free
    if ((subscriptionPlan || 'free').toLowerCase() === 'free') {
      notifyFreeRender();
    }
  };

  /**
   * Sends a POST to editor/free-render-sum to track free user renders
   */
  const notifyFreeRender = async () => {
    try {
      const token = Cookies.get("token");
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://backend.reelmotion.ai";
      await fetch(`${backendUrl}/editor/free-render-sum`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ subscription: "free" }),
      });
    } catch (error) {
      console.error("Error notifying free render:", error);
    }
  };
  
  // Determine access levels
  // Assuming subscriptionPlan can be 'free', 'pro', 'elite' (need to verify exact strings) 
  // Based on user prompt: 
  // 720p: Everyone
  // 1080p: Pro, Elite
  // 4k: Elite
  
  // Safe normalization
  const plan = (subscriptionPlan || 'free').toLowerCase();
  const can1080p = plan === 'pro' || plan === 'elite' || plan === 'business'; // extended checks just in case
  const can4k = plan === 'elite' || plan === 'business';

  // Add keyboard shortcut for save (Ctrl+S / Cmd+S)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (editionData) {
          setIsSaveDialogOpen(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editionData]);

  // Add new render to the list when completed
  React.useEffect(() => {
    if (state.status === "done") {
      setRenders((prev) => [
        {
          url: state.url,
          timestamp: new Date(),
          id: crypto.randomUUID(),
          status: "success",
        },
        ...prev,
      ]);
      setHasNewRender(true);
    } else if (state.status === "error") {
      setRenders((prev) => [
        {
          timestamp: new Date(),
          id: crypto.randomUUID(),
          status: "error",
          error:
            state.error?.message || t("header.renderFailedDefault"),
        },
        ...prev,
      ]);
      setHasNewRender(true);
    }
  }, [state.status, state.url, state.error]);

  const handleDownload = (url: string) => {
    let downloadUrl = url;

    if (renderType === "ssr") {
      // Convert the video URL to a download URL for SSR
      downloadUrl = url
        .replace("/rendered-videos/", "/api/latest/ssr/download/")
        .replace(".mp4", "");
    }
    // Lambda URLs are already in the correct format for download

    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = "rendered-video.mp4";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSaveClick = (url: string) => {
    setSelectedVideoUrl(url);
    setIsSaveRenderDialogOpen(true);
  };

  const getDisplayFileName = (url: string) => {
    if (renderType === "ssr") {
      return url.split("/").pop();
    }
    // For Lambda URLs, use the full URL pathname
    try {
      return new URL(url).pathname.split("/").pop();
    } catch {
      return url.split("/").pop();
    }
  };

  return (
    <>
      {/* Save Edit Dialog */}
      {editionData && (
        <SaveEditDialog
          open={isSaveDialogOpen}
          onOpenChange={setIsSaveDialogOpen}
          editionData={editionData}
        />
      )}

      {/* Load Edit Dialog */}
      {onLoadEdit && (
        <LoadEditDialog
          open={isLoadDialogOpen}
          onOpenChange={setIsLoadDialogOpen}
          onLoadEdit={onLoadEdit}
        />
      )}

      {/* Save Render Dialog */}
      <SaveRenderDialog
        open={isSaveRenderDialogOpen}
        onOpenChange={setIsSaveRenderDialogOpen}
        videoUrl={selectedVideoUrl}
      />

      {/* Subscription Modal */}
      <SubscriptionModal 
        open={showSubscriptionModal} 
        onOpenChange={setShowSubscriptionModal} 
      />

      <Button
        variant="ghost"
        size="sm"
        className="relative hover:bg-accent hidden md:inline-flex"
        onClick={() => setIsLoadDialogOpen(true)}
        disabled={!onLoadEdit}
        title={!onLoadEdit ? t("header.loadFunctionalityUnavailable") : t("header.loadEdit")}
      >
        <FolderOpen className="w-3.5 h-3.5" />&nbsp;{t("header.load")}
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="relative hover:bg-accent hidden md:inline-flex"
        onClick={() => setIsSaveDialogOpen(true)}
        disabled={!editionData}
        title={!editionData ? t("header.noEditionData") : t("header.saveEdit")}
      >
        <Save className="w-3.5 h-3.5" />&nbsp;{t("header.save")}
      </Button>
      <Popover onOpenChange={() => setHasNewRender(false)}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="relative hover:bg-accent hidden md:inline-flex"
          >
            <Bell className="w-3.5 h-3.5" />
            {hasNewRender && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-3">
          <div className="space-y-1.5">
            <h4 className="text-sm font-medium">{t("header.recentRenders")}</h4>
            {renders.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("header.noRenders")}</p>
            ) : (
              renders.map((render) => (
                <div
                  key={render.id}
                  className={`flex items-center justify-between rounded-md border p-1.5 ${
                    render.status === "error"
                      ? "border-destructive/50 bg-destructive/10"
                      : "border-border"
                  }`}
                >
                  <div className="flex flex-col min-w-0 flex-1 mr-2">
                    <div className="text-xs text-zinc-200 truncate max-w-[160px]" title={render.status === "error" ? t("header.renderFailed") : getDisplayFileName(render.url!)}>
                      {render.status === "error" ? (
                        <span className="text-red-400 font-medium">
                          {t("header.renderFailed")}
                        </span>
                      ) : (
                        getDisplayFileName(render.url!)
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatDistanceToNow(render.timestamp, {
                        addSuffix: true,
                      })}
                      {render.error && (
                        <div
                          className="text-red-400 mt-0.5 truncate max-w-[180px]"
                          title={render.error}
                        >
                          {render.error}
                        </div>
                      )}
                    </div>
                  </div>
                  {render.status === "success" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-zinc-200 hover:text-gray-800 h-6 w-6"
                      onClick={() => handleSaveClick(render.url!)}
                      title={t("header.saveVideo")}
                    >
                      <Save className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Button
        onClick={handleRender as any}
        size="sm"
        variant="outline"
        disabled={state.status === "rendering" || state.status === "invoking" || isRenderDisabled}
        className={`hidden bg-gray-800 text-white border-gray-700 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 ${isRenderDisabled ? "cursor-not-allowed" : ""}`}
        title={isRenderDisabled ? t("header.renderDisabledTitle") : undefined}
      >
        Legacy Button
      </Button>

      {/* New Export Button with Dropdown */}
      {state.status === "invoking" || state.status === "rendering" ? (
        <Button disabled variant="secondary" size="sm">
          <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
          {renderType === "cloudrun" ? (
            state.status === "invoking" ? t("header.starting") : t("header.rendering")
          ) : (
            `${t("header.renderingProgress")} ${
              state.progress > 0 ? `(${Math.round(state.progress * 100)}%)` : ""
            }`
          )}
        </Button>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
             <Button
                variant="default"
                disabled={isRenderDisabled || isTimelineEmpty || isFreeExportBlocked}
                size="sm"
                className="bg-primarioLogo hover:bg-primarioLogo/90 text-white"
                title={isTimelineEmpty ? t("header.timelineEmptyTitle") : isFreeExportBlocked ? t("header.freeExportBlockedTitle") : isRenderDisabled ? t("header.renderDisabledTitle") : undefined}
              >
                {isRenderDisabled ? t("header.exportDisabled") : isTimelineEmpty ? t("header.export") : isFreeExportBlocked ? t("header.exportLimitReached") : t("header.export")}
                <ChevronDown className="w-3.5 h-3.5 ml-2" />
              </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[220px]">
             <DropdownMenuLabel>{t("header.selectResolution")}</DropdownMenuLabel>
             <DropdownMenuSeparator />

             {/* 720p - Always Available */}
             <DropdownMenuItem onClick={() => handleExport('720p')} className="cursor-pointer">
                 <div className="flex flex-col">
                   <span className="font-medium">{t("header.standard720p")}</span>
                   <span className="text-xs text-muted-foreground">{t("header.basicQuality")}</span>
                 </div>
             </DropdownMenuItem>

             {/* 1080p - Pro+ */}
             <DropdownMenuItem
               onClick={() => can1080p ? handleExport('1080p') : setShowSubscriptionModal(true)}
               className={`cursor-pointer ${!can1080p ? "bg-gray-50 dark:bg-gray-900" : ""}`}
             >
                 <div className="flex items-center justify-between w-full">
                   <div className="flex flex-col text-left">
                     <span className="font-medium">{t("header.hd1080p")}</span>
                     <span className="text-xs text-muted-foreground">{t("header.proQuality")}</span>
                   </div>
                   {!can1080p && <Crown className="w-4 h-4 text-yellow-500 ml-2" />}
                 </div>
             </DropdownMenuItem>

             {/* 4K - Elite Only */}
             <DropdownMenuItem
               onClick={() => can4k ? handleExport('4k') : setShowSubscriptionModal(true)}
               className={`cursor-pointer ${!can4k ? "bg-gray-50 dark:bg-gray-900" : ""}`}
             >
                 <div className="flex items-center justify-between w-full">
                   <div className="flex flex-col text-left">
                     <span className="font-medium">{t("header.ultraHd4k")}</span>
                     <span className="text-xs text-muted-foreground">{t("header.eliteQuality")}</span>
                   </div>
                   {!can4k && <Crown className="w-4 h-4 text-purple-500 ml-2" />}
                 </div>
             </DropdownMenuItem>

          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Mobile kebab menu — surfaces Cargar / Guardar / Idioma / Notificaciones
          inline with the same handlers as the desktop buttons. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden relative hover:bg-accent px-2"
            aria-label={t("header.actions")}
          >
            <MoreVertical className="w-4 h-4" />
            {hasNewRender && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-[260px]"
          onCloseAutoFocus={() => setHasNewRender(false)}
        >
          <DropdownMenuLabel className="flex items-center justify-between gap-2">
            <span>{t("language.label")}</span>
            <LanguageSelector showLabel={false} className="gap-0" />
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => setIsLoadDialogOpen(true)}
            disabled={!onLoadEdit}
            className="cursor-pointer"
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            {t("header.load")}
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => setIsSaveDialogOpen(true)}
            disabled={!editionData}
            className="cursor-pointer"
          >
            <Save className="w-4 h-4 mr-2" />
            {t("header.save")}
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="flex items-center gap-2">
            <Bell className="w-3.5 h-3.5" />
            {t("header.recentRenders")}
          </DropdownMenuLabel>

          <div className="max-h-60 overflow-y-auto px-1 pb-1">
            {renders.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2 py-1.5">
                {t("header.noRenders")}
              </p>
            ) : (
              renders.map((render) => (
                <div
                  key={render.id}
                  className={`flex items-center justify-between rounded-md border p-1.5 mb-1 ${
                    render.status === "error"
                      ? "border-destructive/50 bg-destructive/10"
                      : "border-border"
                  }`}
                >
                  <div className="flex flex-col min-w-0 flex-1 mr-2">
                    <div
                      className="text-xs text-foreground truncate"
                      title={
                        render.status === "error"
                          ? t("header.renderFailed")
                          : getDisplayFileName(render.url!)
                      }
                    >
                      {render.status === "error" ? (
                        <span className="text-red-400 font-medium">
                          {t("header.renderFailed")}
                        </span>
                      ) : (
                        getDisplayFileName(render.url!)
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatDistanceToNow(render.timestamp, {
                        addSuffix: true,
                      })}
                    </div>
                  </div>
                  {render.status === "success" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.preventDefault();
                        handleSaveClick(render.url!);
                      }}
                      title={t("header.saveVideo")}
                    >
                      <Save className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};

export default RenderControls;
