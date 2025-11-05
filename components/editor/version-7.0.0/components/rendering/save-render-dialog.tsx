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

      const payload: { url: string; name?: string; id?: string } = {
        url: videoUrl,
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

        <Tabs value={saveMode} onValueChange={(v) => setSaveMode(v as any)}>
          <TabsList className="w-full grid grid-cols-2 bg-gray-100/50 dark:bg-darkBoxSub/50 backdrop-blur-sm rounded-sm border border-gray-200 dark:border-gray-700 gap-1">
            <TabsTrigger
              value="name"
              className="data-[state=active]:bg-primarioLogo data-[state=active]:text-gray-900 dark:data-[state=active]:text-white 
              rounded-sm transition-all duration-200 text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50"
            >
              Save with Name
            </TabsTrigger>
            <TabsTrigger
              value="project"
              className="data-[state=active]:bg-primarioLogo data-[state=active]:text-gray-900 dark:data-[state=active]:text-white 
              rounded-sm transition-all duration-200 text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50"
            >
              Associate with Project
            </TabsTrigger>
          </TabsList>

          <TabsContent value="name" className="space-y-4">
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
          </TabsContent>

          <TabsContent value="project" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-select">Select Project</Label>
              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : (
                <Select
                  value={selectedProject}
                  onValueChange={setSelectedProject}
                  disabled={isSaving}
                >
                  <SelectTrigger id="project-select">
                    <SelectValue placeholder="Choose a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.length === 0 ? (
                      <div className="py-2 px-2 text-sm text-muted-foreground">
                        No projects available
                      </div>
                    ) : (
                      projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
          </TabsContent>
        </Tabs>

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
