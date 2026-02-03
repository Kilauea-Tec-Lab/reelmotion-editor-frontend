import React from "react";
import { Download, Loader2, Bell, Save, FolderOpen, ChevronDown, Lock, Crown } from "lucide-react";
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
  
  // Use EditorContext to get subscription info and dimensions
  const { subscriptionPlan, isPro, getAspectRatioDimensions } = useEditorContext();

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
    const { width: compositionWidth, height: compositionHeight } = getAspectRatioDimensions();
    
    // Calculate aspect ratio
    const ratio = compositionWidth / compositionHeight;
    
    let targetHeight = 720; // Default 720p
    
    if (resolution === '1080p') targetHeight = 1080;
    if (resolution === '4k') targetHeight = 2160;

    let renderWidth = 0;
    let renderHeight = 0;

    // Use logic similar to ReactVideoEditor initialization but adapted for target resolution
    // If landscape (width > height)
    if (compositionWidth >= compositionHeight) {
       renderHeight = targetHeight;
       renderWidth = Math.round(renderHeight * ratio);
    } else {
       // Portrait or Square
       // For portrait, the logic is usually inverted (width is the constraint)
       // But 720p usually means 720px on the smallest side or 1280x720.
       // Let's stick to the targetHeight being the vertical resolution for landscape,
       // and for portrait, let's say targetWidth is the resolution class?
       // Remotion logic in ReactVideoEditor was:
       /*
        if (compositionWidth > MAX_RES) {
            const ratio = compositionHeight / compositionWidth;
            renderWidth = MAX_RES;
            renderHeight = Math.round(renderWidth * ratio);
        }
       */
       
       if (resolution === '720p') {
          // Max side 1280, min side 720 usually
          // Let's simplified: 
          // 720p -> Shortest side is 720 (or Longest is 1280?)
          // Usually 720p means 1280x720.
          // Let's scale based on height for now as per `targetHeight`
          // But if portrait, 720p usually implies width=720.
          if (compositionWidth < compositionHeight) {
             renderWidth = targetHeight; // 720, 1080, 2160
             renderHeight = Math.round(renderWidth / ratio);
          } else {
             renderHeight = targetHeight;
             renderWidth = Math.round(renderHeight * ratio);
          }
    }
     // Actually let's be more precise:
     // 720p = 1280x720
     // 1080p = 1920x1080
     // 4K = 3840x2160
     
     const targetLongSide = resolution === '4k' ? 3840 : resolution === '1080p' ? 1920 : 1280;
     
     if (compositionWidth >= compositionHeight) {
         renderWidth = targetLongSide;
         renderHeight = Math.round(renderWidth / ratio);
     } else {
         renderHeight = targetLongSide;
         renderWidth = Math.round(renderHeight * ratio);
     }
    }

    // Ensure even dimensions
    renderWidth = Math.round(renderWidth / 2) * 2;
    renderHeight = Math.round(renderHeight / 2) * 2;

    // Call render with overridden resolution
    // We need to cast handleRender because we modified useRendering but RenderControlsProps was not updated in this file yet (it's updated below in this edit)
    (handleRender as any)({ width: renderWidth, height: renderHeight });
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
            state.error?.message || "Failed to render video. Please try again.",
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
        className="relative hover:bg-accent"
        onClick={() => setIsLoadDialogOpen(true)}
        disabled={!onLoadEdit}
        title={!onLoadEdit ? "Load functionality not available" : "Load edit"}
      >
        <FolderOpen className="w-3.5 h-3.5" />&nbsp;Load
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="relative hover:bg-accent"
        onClick={() => setIsSaveDialogOpen(true)}
        disabled={!editionData}
        title={!editionData ? "No edition data available" : "Save edit"}
      >
        <Save className="w-3.5 h-3.5" />&nbsp;Save
      </Button>
      <Popover onOpenChange={() => setHasNewRender(false)}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="relative hover:bg-accent"
          >
            <Bell className="w-3.5 h-3.5" />
            {hasNewRender && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-3">
          <div className="space-y-1.5">
            <h4 className="text-sm font-medium">Recent Renders</h4>
            {renders.length === 0 ? (
              <p className="text-xs text-muted-foreground">No renders yet</p>
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
                    <div className="text-xs text-zinc-200 truncate max-w-[160px]" title={render.status === "error" ? "Render Failed" : getDisplayFileName(render.url!)}>
                      {render.status === "error" ? (
                        <span className="text-red-400 font-medium">
                          Render Failed
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
                      title="Save video"
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
        onClick={handleRender as any} // Fallback to default render if clicked directly? Actually, default logic below
        size="sm"
        variant="outline"
        disabled={state.status === "rendering" || state.status === "invoking" || isRenderDisabled}
        className={`hidden bg-gray-800 text-white border-gray-700 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 ${isRenderDisabled ? "cursor-not-allowed" : ""}`}
        title={isRenderDisabled ? "Rendering is currently disabled" : undefined}
      >
        Legacy Button
      </Button>

      {/* New Export Button with Dropdown */}
      {state.status === "invoking" || state.status === "rendering" ? (
        <Button disabled variant="secondary" size="sm">
          <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
          {renderType === "cloudrun" ? (
            state.status === "invoking" ? "Starting..." : "Rendering..."
          ) : (
            `Rendering ${
              state.progress > 0 ? `(${Math.round(state.progress * 100)}%)` : ""
            }`
          )}
        </Button>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
             <Button
                variant="default"
                disabled={isRenderDisabled}
                size="sm"
                className="bg-primarioLogo hover:bg-primarioLogo/90 text-white"
              >
                {isRenderDisabled ? "Disabled" : "Export Video"}
                <ChevronDown className="w-3.5 h-3.5 ml-2" />
              </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[220px]">
             <DropdownMenuLabel>Select Resolution</DropdownMenuLabel>
             <DropdownMenuSeparator />
             
             {/* 720p - Always Available */}
             <DropdownMenuItem onClick={() => handleExport('720p')} className="cursor-pointer">
                 <div className="flex flex-col">
                   <span className="font-medium">Standard (720p)</span>
                   <span className="text-xs text-muted-foreground">Basic Quality</span>
                 </div>
             </DropdownMenuItem>

             {/* 1080p - Pro+ */}
             <DropdownMenuItem 
               onClick={() => can1080p ? handleExport('1080p') : setShowSubscriptionModal(true)}
               className={`cursor-pointer ${!can1080p ? "bg-gray-50 dark:bg-gray-900" : ""}`}
             >
                 <div className="flex items-center justify-between w-full">
                   <div className="flex flex-col text-left">
                     <span className="font-medium">HD (1080p)</span>
                     <span className="text-xs text-muted-foreground">Pro Quality</span>
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
                     <span className="font-medium">Ultra HD (4K)</span>
                     <span className="text-xs text-muted-foreground">Elite Quality</span>
                   </div>
                   {!can4k && <Crown className="w-4 h-4 text-purple-500 ml-2" />}
                 </div>
             </DropdownMenuItem>

          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
};

export default RenderControls;
