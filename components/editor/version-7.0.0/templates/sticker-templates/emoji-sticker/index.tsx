import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { StickerTemplate, StickerTemplateProps } from "../base-template";

interface EmojiStickerProps extends StickerTemplateProps {
  emoji?: string;
}

const EmojiStickerComponent: React.FC<EmojiStickerProps> = ({
  overlay,
  isSelected,
  onUpdate,
  emoji = "😊",
}) => {
  const frame = useCurrentFrame();
  const scale = overlay.styles.scale || 1;

  // Calculate size based on scale
  const baseSize = Math.min(overlay.width, overlay.height);
  const fontSize = baseSize * scale;

  // Handle size updates
  React.useEffect(() => {
    if (onUpdate) {
      onUpdate({
        width: fontSize,
        height: fontSize,
      });
    }
  }, [fontSize, onUpdate]);

  // Remotion animation interpolation
  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });
  const animatedScale = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        fontSize: `${fontSize}px`,
        cursor: "pointer",
        userSelect: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        border: isSelected ? "2px solid #0088ff" : "none",
        borderRadius: "8px",
        opacity,
        transform: `scale(${animatedScale})`,
      }}
    >
      {emoji}
    </div>
  );
};

// Define different emoji templates with various categories
const createEmojiTemplate = (
  id: string,
  name: string,
  emoji: string
): StickerTemplate => ({
  config: {
    id: `emoji-${id}`,
    name: `${name}`,
    category: "Emojis",
    defaultProps: {
      emoji,
      styles: {
        scale: 1,
      },
    },
    // Add a thumbnail to help with preview
    thumbnail: emoji,
  },
  Component: EmojiStickerComponent,
});

// Create various emoji templates grouped by category
export const smileysEmojis = [
  createEmojiTemplate("grin", "Grinning Face", "😀"),
  createEmojiTemplate("joy", "Face with Tears of Joy", "😂"),
  createEmojiTemplate("heart-eyes", "Heart Eyes", "😍"),
  createEmojiTemplate("cool", "Cool Face", "😎"),
  createEmojiTemplate("wink", "Winking Face", "😉"),
  createEmojiTemplate("kiss", "Kissing Face", "😘"),
  createEmojiTemplate("thinking", "Thinking Face", "🤔"),
  createEmojiTemplate("sunglasses", "Smiling Face with Sunglasses", "😎"),
];

export const emotionsEmojis = [
  createEmojiTemplate("love", "Red Heart", "❤️"),
  createEmojiTemplate("fire", "Fire", "🔥"),
  createEmojiTemplate("hundred", "100 Points", "💯"),
  createEmojiTemplate("sparkles", "Sparkles", "✨"),
  createEmojiTemplate("thumbs-up", "Thumbs Up", "👍"),
  createEmojiTemplate("clap", "Clapping Hands", "👏"),
  createEmojiTemplate("muscle", "Flexed Biceps", "💪"),
  createEmojiTemplate("pray", "Folded Hands", "🙏"),
];

export const objectsEmojis = [
  createEmojiTemplate("star", "Star", "⭐"),
  createEmojiTemplate("gift", "Gift", "🎁"),
  createEmojiTemplate("balloon", "Balloon", "🎈"),
  createEmojiTemplate("party", "Party Popper", "🎉"),
  createEmojiTemplate("trophy", "Trophy", "🏆"),
  createEmojiTemplate("crown", "Crown", "👑"),
  createEmojiTemplate("diamond", "Gem Stone", "💎"),
  createEmojiTemplate("rocket", "Rocket", "🚀"),
];

export const foodEmojis = [
  createEmojiTemplate("pizza", "Pizza", "🍕"),
  createEmojiTemplate("burger", "Hamburger", "🍔"),
  createEmojiTemplate("cake", "Birthday Cake", "🎂"),
  createEmojiTemplate("coffee", "Coffee", "☕"),
];

export const natureEmojis = [
  createEmojiTemplate("rainbow", "Rainbow", "🌈"),
  createEmojiTemplate("sun", "Sun", "☀️"),
  createEmojiTemplate("moon", "Crescent Moon", "🌙"),
  createEmojiTemplate("lightning", "Lightning", "⚡"),
];

// Export all emoji stickers (30 total)
export const emojiStickers = [
  ...smileysEmojis,
  ...emotionsEmojis,
  ...objectsEmojis,
  ...foodEmojis,
  ...natureEmojis,
];
