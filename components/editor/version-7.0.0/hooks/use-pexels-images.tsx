import { toast } from "@/hooks/use-toast";
import { useState } from "react";

// Interface defining the structure of image data returned from Pexels API
interface PexelsImage {
  id: number;
  width: number;
  height: number;
  url: string; // URL to the image on Pexels website
  alt?: string; // Alt text/description
  photographer?: string; // Photographer name
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
    tiny: string;
  };
}

// Custom hook for fetching and managing images from Pexels API
export function usePexelsImages() {
  // State for storing fetched images
  const [images, setImages] = useState<PexelsImage[]>([]);
  // State for tracking loading status during API calls
  const [isLoading, setIsLoading] = useState(false);
  // State for tracking current page
  const [page, setPage] = useState(1);
  // State for tracking if there are more results
  const [hasMore, setHasMore] = useState(true);

  // Function to fetch images based on search query or curated content
  const fetchImages = async (query: string, pageNum: number = 1, append: boolean = false) => {
    setIsLoading(true);
    try {
      const endpoint = `/api/pexels/images?query=${encodeURIComponent(query)}&per_page=30&page=${pageNum}`;

      const response = await fetch(endpoint);
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || data?.message || `HTTP error! status: ${response.status}`);
      }
      
      if (append) {
        setImages(prev => [...prev, ...data.photos]);
      } else {
        setImages(data.photos);
      }
      
      setPage(pageNum);
      setHasMore(data.photos.length > 0);
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
  return { images, isLoading, fetchImages, page, hasMore };
}
