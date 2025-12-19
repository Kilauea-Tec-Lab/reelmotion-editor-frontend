import { toast } from "@/hooks/use-toast";
import { useState } from "react";

// Interface defining the structure of video data returned from Pexels API
interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  url: string; // URL to the video on Pexels website
  image: string; // Thumbnail image URL
  duration?: number; // Duration in seconds
  tags?: string[]; // Array of tags
  user?: {
    id: number;
    name: string;
    url: string;
  };
  video_files: Array<{
    // Array of different video formats/qualities
    id: number;
    quality: string; // e.g., "hd", "sd"
    file_type: string; // e.g., "video/mp4"
    link: string; // Direct URL to video file
  }>;
}

// Custom hook for fetching and managing videos from Pexels API
export function usePexelsVideos() {
  // State for storing fetched videos
  const [videos, setVideos] = useState<PexelsVideo[]>([]);
  // State for tracking loading status during API calls
  const [isLoading, setIsLoading] = useState(false);
  // State for tracking current page
  const [page, setPage] = useState(1);
  // State for tracking if there are more results
  const [hasMore, setHasMore] = useState(true);

  // Function to fetch videos based on search query or popular content
  const fetchVideos = async (query: string, pageNum: number = 1, append: boolean = false) => {
    setIsLoading(true);
    try {
      const endpoint = `/api/pexels/videos?query=${encodeURIComponent(query)}&per_page=30&page=${pageNum}`;

      const response = await fetch(endpoint);
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || data?.message || `HTTP error! status: ${response.status}`);
      }
      
      if (append) {
        setVideos(prev => [...prev, ...data.videos]);
      } else {
        setVideos(data.videos);
      }
      
      setPage(pageNum);
      setHasMore(data.videos.length > 0);
    } catch (error) {
      // Log error and show user-friendly toast notification
      console.error("Error fetching Pexels media:", error);
      toast({
        title: "Error fetching media",
        description:
          error instanceof Error
            ? error.message
            : "Failed to fetch media. Check your Pexels API key and try again.",
        variant: "destructive",
      });
    } finally {
      // Reset loading state regardless of success/failure
      setIsLoading(false);
    }
  };

  // Return hook values and functions
  return { videos, isLoading, fetchVideos, page, hasMore };
}
