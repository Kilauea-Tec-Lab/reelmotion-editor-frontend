import React from "react";
import { Download, Loader2, Bell, Save, FolderOpen, ChevronDown, MoreVertical, Coins } from "lucide-react";
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
import { useLocalMedia, MaterializeProgress } from "../../contexts/local-media-context";
import { toast } from "@/hooks/use-toast";
import { Overlay } from "../../types";
import { InsufficientTokensModal } from "../shared/insufficient-tokens-modal";
import { EXPORT_PRICES, type ExportResolution } from "../../constants";
import { INSUFFICIENT_TOKENS } from "../../ssr-helpers/export-billing";
import { useTranslation } from "@/lib/i18n";
import { LanguageSelector } from "@/components/language-selector";

const RESOLUTIONS: { id: ExportResolution; label: string; quality: string }[] = [
  { id: "720p", label: "header.standard720p", quality: "header.basicQuality" },
  { id: "1080p", label: "header.hd1080p", quality: "header.proQuality" },
  { id: "4k", label: "header.ultraHd4k", quality: "header.eliteQuality" },
];

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
  handleRender: (options?: { scale?: number; overlays?: Overlay[]; resolution?: ExportResolution }) => void;
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

  const { getAspectRatioDimensions, getRenderDimensions, overlays, setOverlays } = useEditorContext();
  const { materializeOverlays } = useLocalMedia();
  // Local files are uploaded right before export; shown in the export button.
  const [uploadStatus, setUploadStatus] = React.useState<string | null>(null);

  // Check if timeline has elements
  const isTimelineEmpty = !overlays || overlays.length === 0;

  // Track save dialog state
  const [isSaveDialogOpen, setIsSaveDialogOpen] = React.useState(false);
  // Track load dialog state
  const [isLoadDialogOpen, setIsLoadDialogOpen] = React.useState(false);
  // Track save render dialog state
  const [isSaveRenderDialogOpen, setIsSaveRenderDialogOpen] = React.useState(false);
  // Track selected video URL for saving
  const [selectedVideoUrl, setSelectedVideoUrl] = React.useState<string>("");
  // Shown when the SSR route refuses the export for lack of tokens
  const [showInsufficientTokens, setShowInsufficientTokens] = React.useState(false);

  // Check if rendering is disabled via environment variable
  const isRenderDisabled = process.env.NEXT_PUBLIC_DISABLE_RENDER === "true";

  const handleExport = async (resolution: ExportResolution) => {
    // Output size = composition size × renderScale (uniform, overlays keep
    // their relative positions). 720p = long side 1280, so free users get a
    // downscale, never a re-layout.
    const { width: renderW, height: renderH } = getRenderDimensions();

    // Target long side based on resolution
    // 720p = 1280, 1080p = 1920, 4K = 3840
    const targetLongSide = resolution === '4k' ? 3840 : resolution === '1080p' ? 1920 : 1280;

    const currentLongSide = Math.max(renderW, renderH);
    const renderScale = targetLongSide / currentLongSide;

    let exportOverlays: Overlay[];
    try {
      exportOverlays = await materializeOverlays(overlays, (p: MaterializeProgress) =>
        setUploadStatus(t("header.uploadingMedia", { index: p.index, total: p.total, name: p.name, percent: p.percentage }))
      );
    } catch (error) {
      console.error("Error uploading local media:", error);
      toast({ variant: "destructive", title: t("common.error"), description: t("header.uploadMediaFailed") });
      return;
    } finally {
      setUploadStatus(null);
    }
    if (exportOverlays !== overlays) setOverlays(exportOverlays);

    // Call render with scale factor — Remotion handles the uniform upscaling.
    // The resolution is what the server charges for (EXPORT_PRICES).
    handleRender({ scale: renderScale, overlays: exportOverlays, resolution });
  };

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
      if (state.error?.message === INSUFFICIENT_TOKENS) {
        setShowInsufficientTokens(true);
        return;
      }
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

      <InsufficientTokensModal open={showInsufficientTokens} onOpenChange={setShowInsufficientTokens} />

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

      {/* New Export Button with Dropdown */}
      {uploadStatus || state.status === "invoking" || state.status === "rendering" ? (
        <Button disabled variant="secondary" size="sm">
          <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
          {uploadStatus ? (
            uploadStatus
          ) : renderType === "cloudrun" ? (
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
                disabled={isRenderDisabled || isTimelineEmpty}
                size="sm"
                className="bg-primarioLogo hover:bg-primarioLogo/90 text-white"
                title={isTimelineEmpty ? t("header.timelineEmptyTitle") : isRenderDisabled ? t("header.renderDisabledTitle") : undefined}
              >
                {isRenderDisabled ? t("header.exportDisabled") : t("header.export")}
                <ChevronDown className="w-3.5 h-3.5 ml-2" />
              </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[220px]">
             <DropdownMenuLabel>{t("header.selectResolution")}</DropdownMenuLabel>
             <DropdownMenuSeparator />

             {RESOLUTIONS.map(({ id, label, quality }) => (
               <DropdownMenuItem key={id} onClick={() => handleExport(id)} className="cursor-pointer">
                 <div className="flex items-center justify-between w-full gap-3">
                   <div className="flex flex-col text-left">
                     <span className="font-medium">{t(label)}</span>
                     <span className="text-xs text-muted-foreground">{t(quality)}</span>
                   </div>
                   <span className="inline-flex items-center gap-1 text-xs font-mono text-yellow-500 whitespace-nowrap">
                     <Coins className="w-3.5 h-3.5" />
                     {t("header.tokensPrice", { n: EXPORT_PRICES[id] })}
                   </span>
                 </div>
               </DropdownMenuItem>
             ))}

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
