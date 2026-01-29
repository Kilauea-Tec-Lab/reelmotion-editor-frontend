"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Save, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import Cookies from "js-cookie";

interface ProjectInfo {
  id: string;
  name: string;
}

interface SaveRenderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl: string;
}

/**
 * SaveRenderDialog component provides UI for saving or downloading rendered videos
 *
 * Features:
 * - Save with custom name
 * - Associate with existing project
 * - Download video directly
 */
export const SaveRenderDialog: React.FC<SaveRenderDialogProps> = ({
  open,
  onOpenChange,
  videoUrl,
}) => {
  const [saveMode, setSaveMode] = useState<"name" | "project">("name");
  const [videoName, setVideoName] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch projects when dialog opens
  useEffect(() => {
    if (open) {
      fetchProjects();
      // Reset form
      setVideoName("");
      setSelectedProject("");
      setSaveMode("name");
    }
  }, [open]);

  const fetchProjects = async () => {
    try {
      setIsLoading(true);
      const token = Cookies.get("token");
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "https://backend.reelmotion.ai";

      const response = await fetch(`${backendUrl}/editor/get-info-to-edit`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch projects");
      }

      const data = await response.json();

      if (data.code === 200 && data.project_info) {
        setProjects(data.project_info);
      } else {
        throw new Error("Invalid response structure");
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
      toast({
        title: "Error",
        description: "Failed to load projects. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    // Validate input
    if (saveMode === "name" && !videoName.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a video name.",
        variant: "destructive",
      });
      return;
    }

    if (saveMode === "project" && !selectedProject) {
      toast({
        title: "Validation Error",
        description: "Please select a project.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);
      const token = Cookies.get("token");
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "https://backend.reelmotion.ai";
      
      // 1. Upload to GCS and delete from local
      // We call our own Next.js API route for this
      const gcsUploadResponse = await fetch("/api/latest/save-render-to-gcs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoUrl: videoUrl,
          userId: selectedProject || "anonymous" // Organization folder
        }),
      });

      if (!gcsUploadResponse.ok) {
        const errorData = await gcsUploadResponse.json();
        throw new Error(errorData.error || "Failed to upload to cloud storage");
      }

      const { gcsUrl } = await gcsUploadResponse.json();
      console.log("Video uploaded to GCS:", gcsUrl);


      // 2. Save metadata to backend using the new GCS URL
      const payload: { url: string; name?: string; id?: string } = {
        url: gcsUrl, // Use the GCS URL!
      };

      if (saveMode === "name") {
        payload.name = videoName.trim();
      } else {
        payload.id = selectedProject;
      }

      const response = await fetch(`${backendUrl}/editor/save-export`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to save video");
      }

      const data = await response.json();

      if (data.code === 200 || data.success) {
        toast({
          title: "Success",
          description: "Video saved successfully!",
        });
        onOpenChange(false);
      } else {
        throw new Error(data.message || "Failed to save video");
      }
    } catch (error) {
      console.error("Error saving video:", error);
      toast({
        title: "Error",
        description: "Failed to save video. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = videoName.trim() || "rendered-video.mp4";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    toast({
      title: "Download Started",
      description: "Your video is being downloaded.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] ">
        <DialogHeader>
          <DialogTitle>Save Rendered Video</DialogTitle>
          <DialogDescription>
            Choose how you want to save or download your rendered video.
          </DialogDescription>
        </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="video-name">Video Name</Label>
              <Input
                id="video-name"
                placeholder="Enter video name"
                value={videoName}
                onChange={(e) => setVideoName(e.target.value)}
                disabled={isSaving}
              />
            </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleDownload}
            disabled={isSaving}
          >
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
