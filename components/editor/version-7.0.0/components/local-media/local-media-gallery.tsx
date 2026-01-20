"use client";

import React, { useEffect, useState, useRef } from "react";
import { useLocalMedia } from "../../contexts/local-media-context";
import { formatBytes, formatDuration } from "../../utils/format-utils";
import { resolveVideoUrl } from "../../utils/url-helper";
import { Button } from "../../../../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../ui/tabs";
import { Loader2, Upload, Trash2, Image, Video, Music, Pencil, Check } from "lucide-react";
import { Input } from "../../../../ui/input";
import Cookies from "js-cookie";
import { toast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../../ui/dialog";

/**
 * User Media Gallery Component
 *
 * Displays the user's uploaded media files and provides functionality to:
 * - Upload new media files
 * - Filter media by type (image, video, audio)
 * - Preview media files
 * - Delete media files
 * - Add media to the timeline
 */
export function LocalMediaGallery({
  onSelectMedia,
}: {
  onSelectMedia?: (mediaFile: any) => void;
}) {
  const { localMediaFiles, addMediaFile, removeMediaFile, isLoading, updateMediaFileName, uploadProgress } =
    useLocalMedia();
  const [activeTab, setActiveTab] = useState("all");
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  
  // Rename state
  const [fileToRename, setFileToRename] = useState<any>(null);
  const [newName, setNewName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  const resetDragState = () => {
    dragCounterRef.current = 0;
    setIsDragging(false);
  };

  const isFileDrag = (e: React.DragEvent) => {
    const types = Array.from(e.dataTransfer?.types || []);
    return types.includes("Files");
  };

  useEffect(() => {
    // macOS/Safari can miss dragleave in some edge cases; ensure we always recover.
    const handleWindowReset = () => resetDragState();

    window.addEventListener("drop", handleWindowReset);
    window.addEventListener("dragend", handleWindowReset);
    window.addEventListener("blur", handleWindowReset);

    return () => {
      window.removeEventListener("drop", handleWindowReset);
      window.removeEventListener("dragend", handleWindowReset);
      window.removeEventListener("blur", handleWindowReset);
    };
  }, []);

  const getAcceptForTab = (tab: string) => {
    switch (tab) {
      case "image":
        return "image/*";
      case "video":
        return "video/*";
      case "audio":
        return "audio/*";
      case "all":
      default:
        return "image/*,video/*,audio/*";
    }
  };

  const isFileAllowedForTab = (file: File, tab: string) => {
    const isAnyMedia =
      file.type.startsWith("image/") ||
      file.type.startsWith("video/") ||
      file.type.startsWith("audio/");

    if (tab === "all") return isAnyMedia;
    return file.type.startsWith(`${tab}/`);
  };

  const getTabUploadLabel = (tab: string) => {
    switch (tab) {
      case "image":
        return "image";
      case "video":
        return "video";
      case "audio":
        return "audio";
      case "all":
      default:
        return "image, video, or audio";
    }
  };

  // Filter media files based on active tab (already sorted newest first in context)
  const filteredMedia = localMediaFiles
    .filter((file) => {
      if (activeTab === "all") return true;
      return file.type === activeTab;
    });

  // Handle file upload (unified for both button and drag&drop)
  const uploadFile = async (file: File) => {
    try {
      setUploadError(null);
      setIsUploading(true);
      await addMediaFile(file);
    } catch (error) {
      console.error("Error uploading file:", error);
      setUploadError("Failed to upload file. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  // Handle file upload from input
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];

      if (!isFileAllowedForTab(file, activeTab)) {
        setUploadError(
          `Invalid file type. Please upload a ${getTabUploadLabel(activeTab)} file.`
        );
        event.target.value = "";
        return;
      }

      await uploadFile(file);
      // Reset the input value to allow uploading the same file again
      event.target.value = "";
    }
  };

  const handleRename = async () => {
    if (!fileToRename || !newName.trim()) return;
    
    setIsRenaming(true);
    try {
      const token = Cookies.get("token");
      const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || "https://backend.reelmotion.ai";
      
      const formData = new FormData();
      formData.append("id", fileToRename.id);
      formData.append("file_name", newName);

      const response = await fetch(`${backendUrl}/editor/edit-upload-name`, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to update name");
      }

      // Update local state
      updateMediaFileName(fileToRename.id, newName);
      
      setFileToRename(null);
      setNewName("");
      
      toast({
        title: "Success",
        description: "File name updated successfully",
      });
    } catch (error) {
      console.error("Error updating file name:", error);
      toast({
        title: "Error",
        description: "Failed to update file name",
        variant: "destructive",
      });
    } finally {
      setIsRenaming(false);
    }
  };

  // Handle drag events
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isFileDrag(e)) return;

    dragCounterRef.current += 1;
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // If we leave the window entirely, force reset.
    if (
      e.clientX <= 0 ||
      e.clientY <= 0 ||
      e.clientX >= window.innerWidth ||
      e.clientY >= window.innerHeight
    ) {
      resetDragState();
      return;
    }

    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isFileDrag(e) && !isDragging) {
      setIsDragging(true);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resetDragState();

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];

      if (!isFileAllowedForTab(file, activeTab)) {
        setUploadError(
          `Invalid file type. Please upload a ${getTabUploadLabel(activeTab)} file.`
        );
        return;
      }

      await uploadFile(file);
    }
  };

  // Handle upload button click
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Handle media selection - add directly to timeline
  const handleMediaSelect = (file: any) => {
    if (onSelectMedia) {
      onSelectMedia(file);
    }
  };

  // Add media to timeline
  const handleAddToTimeline = () => {
    if (selectedFile && onSelectMedia) {
      onSelectMedia(selectedFile);
      setPreviewOpen(false);
    }
  };

  // Handle media deletion
  const handleDeleteMedia = async (fileId: string) => {
    try {
      setDeletingId(fileId);
      await removeMediaFile(fileId);
    } catch (error) {
      console.error("Error deleting file:", error);
    } finally {
      setDeletingId(null);
    }
  };

  // Render preview content based on file type
  const renderPreviewContent = () => {
    if (!selectedFile) return null;

    const commonClasses =
      "max-h-[50vh] w-full object-contain rounded-lg shadow-sm";

    switch (selectedFile.type) {
      case "image":
        return (
          <div className="relative bg-gray-50 dark:bg-darkBox  rounded-lg p-2">
            <img
              src={selectedFile.path}
              alt={selectedFile.name}
              className={`${commonClasses} object-contain`}
            />
          </div>
        );
      case "video":
        return (
          <div className="relative bg-gray-50 dark:bg-darkBox  rounded-lg p-2">
            <video
              src={resolveVideoUrl(selectedFile.path)}
              crossOrigin="anonymous"
              controls
              className={commonClasses}
              controlsList="nodownload"
              playsInline
            />
          </div>
        );
      case "audio":
        return (
          <div className="flex flex-col items-center space-y-3 p-4 bg-gray-50 dark:bg-darkBox rounded-lg">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <Music className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <audio
              src={
                selectedFile.path.startsWith("http")
                  ? selectedFile.path
                  : `${window.location.origin}${selectedFile.path}`
              }
              controls
              className="w-[280px] max-w-full"
              controlsList="nodownload"
            />
          </div>
        );
      default:
        return (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Unsupported file type
          </div>
        );
    }
  };

  // Render media item
  const renderMediaItem = (file: any) => {
    const isDeleting = deletingId === file.id;
    
    return (
      <div
        key={file.id}
        className="relative group/item rounded-sm overflow-hidden cursor-pointer"
        onClick={() => !isDeleting && handleMediaSelect(file)}
      >
        <div className="relative aspect-video bg-gray-200 dark:bg-darkBoxSub">
          {/* Deleting Overlay */}
          {isDeleting && (
            <div className="absolute inset-0 bg-black/60 dark:bg-black/80 z-20 flex items-center justify-center">
              <div className="flex flex-col items-center space-y-2">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
                <p className="text-white text-xs font-medium">Deleting...</p>
              </div>
            </div>
          )}

          {/* Media Content */}
          {file.type === "image" && (
            <img
              src={file.thumbnail || file.path}
              alt={file.name}
              className="w-full h-full object-cover"
            />
          )}
          {file.type === "video" && (
            <>
              {/* Use video element as thumbnail - proxy GCS URLs to avoid CORS */}
              <video
                src={resolveVideoUrl(file.path || file.thumbnail || "")}
                crossOrigin="anonymous"
                muted
                playsInline
                preload="metadata"
                className="w-full h-full object-cover"
                onLoadedMetadata={(e) => {
                  // Seek to first frame for thumbnail
                  const video = e.currentTarget;
                  video.currentTime = 0.1;
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                  <Video className="w-4 h-4 text-white" />
                </div>
              </div>
              {file.duration > 0 && (
                <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-white font-medium">
                   {formatDuration(file.duration)}
                </div>
              )}
            </>
          )}
          {file.type === "audio" && (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
              <Music className="w-8 h-8 text-gray-400" />
            </div>
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/item:opacity-100 transition-opacity duration-200 z-10" />

          {/* Media Name & Options */}
          <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent flex items-center justify-between gap-1 z-20">
            <p className="text-white text-xs font-medium truncate flex-1 text-left">
              {file.name || "Untitled"}
            </p>
            
            <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover/item:opacity-100 transition-all" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu onOpenChange={(isOpen) => {
                if (isOpen) {
                  setFileToRename(file);
                  setNewName(file.name || "");
                }
              }}>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 shrink-0 bg-black/60 backdrop-blur-sm hover:bg-black/80 text-pink-400 rounded-full"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60 p-2">
                  <div className="flex items-center gap-2" onKeyDown={(e) => e.stopPropagation()}>
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="h-8 text-xs"
                      placeholder="Rename file..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename();
                        e.stopPropagation(); // Prevent timeline actions
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Button 
                      size="icon" 
                      className="h-8 w-8 shrink-0 bg-pink-500 hover:bg-pink-600 text-white"
                      onClick={handleRename}
                      disabled={isRenaming}
                    >
                      {isRenaming ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0 bg-black/60 backdrop-blur-sm hover:bg-black/80 text-red-400 rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteMedia(file.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render uploading skeleton with progress bar
  const renderUploadingSkeleton = () => {
    const percentage = uploadProgress?.percentage || 0;
    
    return (
      <div
        key="uploading-skeleton"
        className="relative rounded-sm overflow-hidden bg-gray-200 dark:bg-darkBoxSub"
      >
        {/* Thumbnail skeleton with progress */}
        <div className="aspect-video relative bg-gray-200 dark:bg-gray-800 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-pink-500 animate-spin mb-2" />
          <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
            Uploading... {percentage}%
          </p>
          
          {/* Progress bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-300 dark:bg-gray-700">
            <div 
              className="h-full bg-pink-500 transition-all duration-300 ease-out"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm">Saved Uploads</h2>
        <div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={handleUploadClick}
            disabled={isLoading || isUploading}
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Upload
          </Button>
          <input
            ref={fileInputRef}
            id="file-upload"
            type="file"
            className="hidden"
            onChange={handleFileUpload}
            accept={getAcceptForTab(activeTab)}
            disabled={isLoading || isUploading}
          />
        </div>
      </div>

      {uploadError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4">
          {uploadError}
        </div>
      )}

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col"
      >
        <TabsList className="w-full grid grid-cols-4 bg-gray-100/50 dark:bg-darkBoxSub /50 backdrop-blur-sm rounded-sm border border-gray-200 dark:border-gray-700 gap-1">
          <TabsTrigger
            value="all"
            className="data-[state=active]:bg-primarioLogo data-[state=active]:text-gray-900 dark:data-[state=active]:text-white 
            rounded-sm transition-all duration-200 text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50"
          >
            <span className="flex items-center gap-2 text-xs">All</span>
          </TabsTrigger>
          <TabsTrigger
            value="image"
            className="data-[state=active]:bg-primarioLogo data-[state=active]:text-gray-900 dark:data-[state=active]:text-white 
            rounded-sm transition-all duration-200 text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50"
          >
            <span className="flex items-center gap-2 text-xs">
              <Image className="w-3 h-3" />
              Images
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="video"
            className="data-[state=active]:bg-primarioLogo data-[state=active]:text-gray-900 dark:data-[state=active]:text-white 
            rounded-sm transition-all duration-200 text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50"
          >
            <span className="flex items-center gap-2 text-xs">
              <Video className="w-3 h-3" />
              Videos
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="audio"
            className="data-[state=active]:bg-primarioLogo data-[state=active]:text-gray-900 dark:data-[state=active]:text-white 
            rounded-sm transition-all duration-200 text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50"
          >
            <span className="flex items-center gap-2 text-xs">
              <Music className="w-3 h-3" />
              Audio
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent 
          value={activeTab} 
          className="flex-1 overflow-y-auto p-0 relative"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* Drag & Drop Overlay */}
          {isDragging && (
            <div className="absolute inset-0 z-50 bg-blue-500/10 dark:bg-blue-500/20 border-2 border-dashed border-blue-500 dark:border-blue-400 rounded-lg flex items-center justify-center backdrop-blur-sm pointer-events-none">
              <div className="text-center space-y-2">
                <Upload className="w-12 h-12 mx-auto text-blue-600 dark:text-blue-400 animate-bounce" />
                <p className="text-lg font-medium text-blue-600 dark:text-blue-400">Drop files here</p>
                <p className="text-sm text-blue-500 dark:text-blue-300">
                  {activeTab === "all"
                    ? "Images, videos, or audio files"
                    : `${getTabUploadLabel(activeTab)[0].toUpperCase()}${getTabUploadLabel(activeTab).slice(1)} files`}
                </p>
              </div>
            </div>
          )}

          {isLoading && localMediaFiles.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 text-sm text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <p>Loading media files...</p>
            </div>
          ) : filteredMedia.length === 0 && !isUploading ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-darkBoxSub  flex items-center justify-center">
                <Upload className="w-4 h-4 text-gray-400" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">No media files</p>
                <p className="text-xs text-gray-500">
                  Upload or drag & drop your first media file
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleUploadClick}
                className="text-xs"
              >
                Upload Media
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 ">
              {isUploading && renderUploadingSkeleton()}
              {filteredMedia.map(renderMediaItem)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Media Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedFile?.name}</DialogTitle>
            <DialogDescription>
              {selectedFile?.type} • {formatBytes(selectedFile?.size)}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center">{renderPreviewContent()}</div>
          <div className="flex justify-end mt-4">
            <Button variant="default" size="sm" onClick={handleAddToTimeline}>
              Add to Timeline
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
