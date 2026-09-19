import { Audio } from "remotion";
import { SoundOverlay } from "../../../types";
import { resolveMediaUrl } from "../../../utils/url-helper";

interface SoundLayerContentProps {
  overlay: SoundOverlay;
  baseUrl?: string;
}

export const SoundLayerContent: React.FC<SoundLayerContentProps> = ({
  overlay,
  baseUrl,
}) => {
  // Validate that src exists
  if (!overlay.src) {
    console.error("Sound overlay missing src:", overlay);
    return null;
  }

  const audioSrc = resolveMediaUrl(overlay.src, baseUrl);

  return (
    <Audio
      src={audioSrc}
      startFrom={overlay.startFromSound || 0}
      volume={overlay.styles?.volume ?? 1}
      pauseWhenBuffering
    />
  );
};
