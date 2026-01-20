import { useState, useEffect } from "react";
import Cookies from "js-cookie";
import { toAbsoluteUrl, getOptimizedMediaUrl } from "../utils/url-helper";

// Interface defining the structure of video data from Reelmotion backend
interface ReelmotionVideo {
  id: string;
  name: string | null;
  video_url: string;
  thumbnail_url?: string | null;
}

// Interface for the API response
interface EditorDataResponse {
  code: number;
  projects_videos: ReelmotionVideo[];
}

const ITEMS_PER_PAGE = 15;

/**
 * Custom hook for fetching and managing videos from Reelmotion backend
 * Implements lazy loading (pagination) and search functionality
 * Uses direct GCS URLs with CDN for faster loading
 */
export function useReelmotionVideos() {
  const [allVideos, setAllVideos] = useState<ReelmotionVideo[]>([]);
  const [displayedVideos, setDisplayedVideos] = useState<ReelmotionVideo[]>([]);
  const [filteredVideos, setFilteredVideos] = useState<ReelmotionVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch videos from backend on mount
  useEffect(() => {
    const fetchVideos = async () => {
      try {
        setIsLoading(true);
        const token = Cookies.get("token");
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || "https://backend.reelmotion.ai";

        const response = await fetch(`${backendUrl}/editor/get-info-to-edit`, {
          headers: {
            Authorization: "Bearer " + token,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: EditorDataResponse = await response.json();

        if (data.code === 200 && data.projects_videos) {
          // Filter out videos without names and duplicates
          const uniqueVideos = data.projects_videos
            .filter(
              (video, index, self) =>
                video.name &&
                index ===
                  self.findIndex(
                    (v) => v.video_url === video.video_url && v.name === video.name
                  )
            )
            .map((video) => ({
              ...video,
              // Use optimized URL (CDN if available, direct GCS otherwise)
              // GCS has CORS configured, so no proxy needed
              video_url: getOptimizedMediaUrl(video.video_url),
              thumbnail_url: video.thumbnail_url ? getOptimizedMediaUrl(video.thumbnail_url) : null,
            }))
            .reverse(); // Reverse the order to show newest first

          setAllVideos(uniqueVideos);
          setFilteredVideos(uniqueVideos);
          
          // Load first page
          const firstPage = uniqueVideos.slice(0, ITEMS_PER_PAGE);
          setDisplayedVideos(firstPage);
          setHasMore(uniqueVideos.length > ITEMS_PER_PAGE);
        }
      } catch (error) {
        console.error("Error fetching Reelmotion videos:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVideos();
  }, []);

  // Handle search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredVideos(allVideos);
      const firstPage = allVideos.slice(0, ITEMS_PER_PAGE);
      setDisplayedVideos(firstPage);
      setCurrentPage(1);
      setHasMore(allVideos.length > ITEMS_PER_PAGE);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = allVideos.filter((video) =>
      video.name?.toLowerCase().includes(query)
    );

    setFilteredVideos(filtered);
    const firstPage = filtered.slice(0, ITEMS_PER_PAGE);
    setDisplayedVideos(firstPage);
    setCurrentPage(1);
    setHasMore(filtered.length > ITEMS_PER_PAGE);
  }, [searchQuery, allVideos]);

  // Load more videos (pagination)
  const loadMore = () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);

    // Simulate loading delay for UX
    setTimeout(() => {
      const nextPage = currentPage + 1;
      const startIndex = 0;
      const endIndex = nextPage * ITEMS_PER_PAGE;
      const newDisplayedVideos = filteredVideos.slice(startIndex, endIndex);

      setDisplayedVideos(newDisplayedVideos);
      setCurrentPage(nextPage);
      setHasMore(endIndex < filteredVideos.length);
      setIsLoadingMore(false);
    }, 500);
  };

  const updateVideoName = (id: string, newName: string) => {
    const updateVideo = (video: ReelmotionVideo) => 
      video.id === id ? { ...video, name: newName } : video;

    setAllVideos(prev => prev.map(updateVideo));
    setFilteredVideos(prev => prev.map(updateVideo));
    setDisplayedVideos(prev => prev.map(updateVideo));
  };

  return {
    videos: displayedVideos,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    searchQuery,
    setSearchQuery,
    totalVideos: filteredVideos.length,
    updateVideoName,
  };
}
