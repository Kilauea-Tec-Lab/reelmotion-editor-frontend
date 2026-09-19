import { useState, useEffect } from "react";
import { resolveMediaUrl } from "../utils/url-helper";

interface WaveformData {
  peaks: number[];
  length: number;
}

interface WaveformOptions {
  numPoints?: number;
  fps?: number;
}

/**
 * A React hook that processes audio files to generate waveform visualization data.
 * The hook fetches an audio file, analyzes it, and generates an array of normalized amplitude values
 * that can be used to render a waveform visualization.
 *
 * @param src - URL of the audio file to process
 * @param startFromSound - Start time offset in frames (default: 0)
 * @param durationInFrames - Duration to process in frames
 * @param options - Configuration options
 * @param options.numPoints - Number of data points to generate for the waveform (default: 400)
 * @param options.fps - Frames per second for time calculations (default: 30)
 *
 * @returns {WaveformData | null} Object containing:
 *   - peaks: Array of normalized amplitude values between 0 and 1
 *   - length: Total number of samples processed
 *
 * @example
 * ```tsx
 * const waveform = useWaveformProcessor(
 *   'path/to/audio.mp3',
 *   0,
 *   300, // 10 seconds at 30fps
 *   { numPoints: 200, fps: 30 }
 * );
 * ```
 */
// Chrome caps AudioContexts at ~6 per page and each decode re-downloads the
// file, so decoding is shared across clips/trims of the same source.
let sharedAudioContext: AudioContext | null = null;
const decodedAudio = new Map<string, Promise<AudioBuffer>>();

const decodeAudio = (url: string): Promise<AudioBuffer> => {
  let pending = decodedAudio.get(url);
  if (!pending) {
    pending = (async () => {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      sharedAudioContext ??= new AudioContext();
      return sharedAudioContext.decodeAudioData(arrayBuffer);
    })();
    pending.catch(() => decodedAudio.delete(url));
    decodedAudio.set(url, pending);
  }
  return pending;
};

export function useWaveformProcessor(
  src: string | undefined,
  startFromSound: number = 0,
  durationInFrames: number,
  options: WaveformOptions = {}
) {
  const [waveformData, setWaveformData] = useState<WaveformData | null>(null);
  const { numPoints = 400, fps = 30 } = options;

  useEffect(() => {
    if (!src) return;

    let isActive = true;

    const processAudio = async () => {
      try {
        const audioBuffer = await decodeAudio(resolveMediaUrl(src));

        if (!isActive) return;

        const sampleRate = audioBuffer.sampleRate;
        const channelData = audioBuffer.getChannelData(0);
        const startTime = startFromSound / fps;
        const duration = durationInFrames / fps;

        const startSample = Math.floor(startTime * sampleRate);
        const samplesForDuration = Math.floor(duration * sampleRate);
        const samplesPerPeak = Math.floor(samplesForDuration / numPoints);

        const peaks = Array.from({ length: numPoints }, (_, i) => {
          const start = startSample + i * samplesPerPeak;
          const end = Math.min(start + samplesPerPeak, channelData.length);

          let peakMax = 0;
          let sumSquares = 0;
          let validSamples = 0;

          for (let j = start; j < end; j++) {
            if (j >= channelData.length) break;
            const value = Math.abs(channelData[j]);
            peakMax = Math.max(peakMax, value);
            sumSquares += value * value;
            validSamples++;
          }

          if (validSamples === 0) return 0;
          const rms = Math.sqrt(sumSquares / validSamples);
          return (peakMax + rms) / 2;
        });

        // Normalize using 95th percentile
        const sortedPeaks = [...peaks].sort((a, b) => a - b);
        const normalizeValue = sortedPeaks[Math.floor(peaks.length * 0.95)];
        const normalizedPeaks = peaks.map((peak) =>
          Math.min(peak / normalizeValue, 1)
        );

        setWaveformData({
          peaks: normalizedPeaks,
          length: samplesForDuration,
        });
      } catch (error) {
        console.error("Error processing audio waveform:", error);
      }
    };

    processAudio();
    return () => {
      isActive = false;
    };
  }, [src, startFromSound, durationInFrames, fps, numPoints]);

  return waveformData;
}
