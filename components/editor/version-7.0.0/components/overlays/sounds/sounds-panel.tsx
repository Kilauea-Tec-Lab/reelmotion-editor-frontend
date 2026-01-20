import React from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Loader2, Pencil, Check } from "lucide-react";
import { LocalSound, OverlayType, SoundOverlay } from "../../../types";
import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import Cookies from "js-cookie";
import { toast } from "@/hooks/use-toast";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useTimelinePositioning } from "../../../hooks/use-timeline-positioning";
import { useEditorContext } from "../../../contexts/editor-context";
import { useTimeline } from "../../../contexts/timeline-context";
import { SoundDetails } from "./sound-details";
import { useEditorAuth } from "../../../hooks/use-editor-auth";
import { getOptimizedMediaUrl } from "../../../utils/url-helper";

/**
 * SoundsPanel Component
 *
 * A panel component that manages sound overlays in the editor. It provides functionality for:
 * - Displaying a list of available sound tracks
 * - Playing/pausing sound previews
 * - Adding sounds to the timeline
 * - Managing selected sound overlays and their properties
 *
 * The component switches between two views:
 * 1. Sound library view: Shows available sounds that can be added
 * 2. Sound details view: Shows controls for the currently selected sound overlay
 *
 * @component
 */
const SoundsPanel: React.FC = () => {
  const [playingTrack, setPlayingTrack] = useState<string | null>(null);
  const [loadingTrack, setLoadingTrack] = useState<string | null>(null);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  const audioDurationsRef = useRef<{ [key: string]: number }>({});
  const {
    addOverlay,
    overlays,
    durationInFrames,
    selectedOverlayId,
    changeOverlay,
  } = useEditorContext();
  const { findNextAvailablePosition } = useTimelinePositioning();
  const { visibleRows } = useTimeline();
  const [localOverlay, setLocalOverlay] = useState<SoundOverlay | null>(null);
  const { editorData, updateAudioName } = useEditorAuth();
  
  // Rename state
  const [soundToRename, setSoundToRename] = useState<LocalSound | null>(null);
  const [newName, setNewName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  // Convert project_voices to LocalSound format with optimized URLs
  const localSounds: LocalSound[] = React.useMemo(() => {
    if (!editorData?.project_voices) return [];
    
    return editorData.project_voices.map((voice) => ({
      id: voice.id,
      title: voice.name,
      artist: voice.description || "Project Voice",
      duration: 0, // Will be extracted from audio file
      // Use optimized URL (CDN if available, direct GCS otherwise)
      file: getOptimizedMediaUrl(voice.audio_url),
    }));
  }, [editorData?.project_voices]);

  useEffect(() => {
    if (selectedOverlayId === null) {
      setLocalOverlay(null);
      return;
    }

    const selectedOverlay = overlays.find(
      (overlay) => overlay.id === selectedOverlayId
    );

    if (selectedOverlay?.type === OverlayType.SOUND) {
      setLocalOverlay(selectedOverlay);
    }
  }, [selectedOverlayId, overlays]);

  /**
   * Updates the local overlay state and propagates changes to the editor context
   * @param {SoundOverlay} updatedOverlay - The modified sound overlay
   */
  const handleUpdateOverlay = (updatedOverlay: SoundOverlay) => {
    setLocalOverlay(updatedOverlay);
    changeOverlay(updatedOverlay.id, updatedOverlay);
  };

  const handleRename = async () => {
    if (!soundToRename || !newName.trim()) return;
    
    setIsRenaming(true);
    try {
      const token = Cookies.get("token");
      const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || "https://backend.reelmotion.ai";
      
      const formData = new FormData();
      formData.append("attachment_id", soundToRename.id);
      formData.append("name", newName);

      const response = await fetch(`${backendUrl}/chat/update-attachment-name`, {
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
      updateAudioName(soundToRename.id, newName);
      
      setSoundToRename(null);
      setNewName("");
      
      toast({
        title: "Success",
        description: "Audio name updated successfully",
      });
    } catch (error) {
      console.error("Error updating audio name:", error);
      toast({
        title: "Error",
        description: "Failed to update audio name",
        variant: "destructive",
      });
    } finally {
      setIsRenaming(false);
    }
  };

  /**
   * Initialize audio elements for each sound and handle cleanup
   */
  useEffect(() => {
    localSounds.forEach((sound) => {
      const audio = new Audio(sound.file);
      audio.preload = "metadata";
      audioRefs.current[sound.id] = audio;
      
      // Extract duration when metadata is loaded
      audio.addEventListener("loadedmetadata", () => {
        if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
          audioDurationsRef.current[sound.id] = audio.duration;
        }
      });
    });

    return () => {
      Object.values(audioRefs.current).forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });
    };
  }, [localSounds]);

  /**
   * Get audio duration - extracts from audio element or returns cached value
   */
  const getAudioDuration = (soundId: string, audioUrl: string): Promise<number> => {
    return new Promise((resolve) => {
      // Check if we already have the duration cached
      if (audioDurationsRef.current[soundId] && audioDurationsRef.current[soundId] > 0) {
        resolve(audioDurationsRef.current[soundId]);
        return;
      }

      // Check if audio element already has duration
      const existingAudio = audioRefs.current[soundId];
      if (existingAudio && existingAudio.duration && !isNaN(existingAudio.duration) && isFinite(existingAudio.duration)) {
        audioDurationsRef.current[soundId] = existingAudio.duration;
        resolve(existingAudio.duration);
        return;
      }

      // Create new audio element to get duration
      const audio = new Audio(audioUrl);
      audio.preload = "metadata";

      const handleLoadedMetadata = () => {
        if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
          audioDurationsRef.current[soundId] = audio.duration;
          resolve(audio.duration);
        } else {
          resolve(5); // Default 5 seconds if can't determine
        }
        cleanup();
      };

      const handleError = () => {
        console.warn("Failed to load audio duration, using default");
        resolve(5); // Default 5 seconds
        cleanup();
      };

      const cleanup = () => {
        audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
        audio.removeEventListener("error", handleError);
      };

      audio.addEventListener("loadedmetadata", handleLoadedMetadata);
      audio.addEventListener("error", handleError);

      // Timeout fallback
      setTimeout(() => {
        if (!audioDurationsRef.current[soundId]) {
          resolve(5);
          cleanup();
        }
      }, 5000);
    });
  };

  /**
   * Toggles play/pause state for a sound track
   * Ensures only one track plays at a time
   *
   * @param soundId - Unique identifier of the sound to toggle
   */
  const togglePlay = (soundId: string) => {
    const audio = audioRefs.current[soundId];
    if (playingTrack === soundId) {
      audio.pause();
      setPlayingTrack(null);
    } else {
      if (playingTrack) {
        audioRefs.current[playingTrack].pause();
      }
      audio
        .play()
        .catch((error) => console.error("Error playing audio:", error));
      setPlayingTrack(soundId);
    }
  };

  /**
   * Adds a sound overlay to the timeline at the next available position
   * Extracts real duration from audio file
   *
   * @param {LocalSound} sound - The sound track to add to the timeline
   */
  const handleAddToTimeline = async (sound: LocalSound) => {
    // Show loading state
    setLoadingTrack(sound.id);

    try {
      // Get real audio duration
      const audioDuration = await getAudioDuration(sound.id, sound.file);
      
      // Find the next available position on the timeline
      const { from, row } = findNextAvailablePosition(
        overlays,
        visibleRows,
        durationInFrames
      );

      // Create the sound overlay configuration with real duration
      const newSoundOverlay: SoundOverlay = {
        id: Date.now(),
        type: OverlayType.SOUND,
        content: sound.title,
        src: sound.file,
        from,
        row,
        // Layout properties
        left: 0,
        top: 0,
        width: 1920,
        height: 100,
        rotation: 0,
        isDragging: false,
        durationInFrames: Math.ceil(audioDuration * 30), // 30fps with real duration
        styles: {
          opacity: 1,
        },
      };

      addOverlay(newSoundOverlay);
    } catch (error) {
      console.error("Error adding sound to timeline:", error);
    } finally {
      setLoadingTrack(null);
    }
  };

  /**
   * Handle drag start for sound items
   * Includes cached duration if available
   */
  const handleDragStart = (e: React.DragEvent, sound: LocalSound) => {
    // Use cached duration if available, otherwise use a placeholder
    const duration = audioDurationsRef.current[sound.id] || 5;
    
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData(
      "application/reelmotion-sound",
      JSON.stringify({
        type: "sound",
        title: sound.title,
        file: sound.file,
        duration: duration,
        artist: sound.artist,
        id: sound.id,
      })
    );
  };

  /**
   * Renders an individual sound card with play controls and metadata
   * Clicking the card adds the sound to the timeline
   * Clicking the play button toggles sound preview
   *
   * @param {LocalSound} sound - The sound track data to render
   * @returns {JSX.Element} A sound card component
   */
  const renderSoundCard = (sound: LocalSound) => {
    const isLoading = loadingTrack === sound.id;
    
    return (
      <div
        key={sound.id}
        draggable={!isLoading}
        onDragStart={(e) => handleDragStart(e, sound)}
        onClick={() => !isLoading && handleAddToTimeline(sound)}
        className={`group flex items-center gap-3 w-4/5 p-2.5 bg-white dark:bg-darkBox rounded-md 
          border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900
          transition-all duration-150 relative ${isLoading ? 'opacity-70 cursor-wait' : 'cursor-pointer'}`}
      >
        <Button
          variant="ghost"
          size="sm"
          disabled={isLoading}
          onClick={(e) => {
            e.stopPropagation();
            if (!isLoading) togglePlay(sound.id);
          }}
          className="h-8 w-8 rounded-full bg-transparent hover:bg-gray-100 dark:hover:bg-gray-900 
            text-gray-700 dark:text-gray-300"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : playingTrack === sound.id ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {sound.title}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {isLoading ? "Adding to timeline..." : sound.artist}
          </p>
        </div>

        <div onClick={(e) => e.stopPropagation()} className="opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu onOpenChange={(isOpen) => {
            if (isOpen) {
              setSoundToRename(sound);
              setNewName(sound.title || "");
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
                  placeholder="Rename audio..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename();
                  }}
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
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 p-4 bg-gray-50 dark:bg-darkBox  h-full">
      {!localOverlay ? (
        localSounds.map(renderSoundCard)
      ) : (
        <SoundDetails
          localOverlay={localOverlay}
          setLocalOverlay={handleUpdateOverlay}
        />
      )}
    </div>
  );
};

export default SoundsPanel;
