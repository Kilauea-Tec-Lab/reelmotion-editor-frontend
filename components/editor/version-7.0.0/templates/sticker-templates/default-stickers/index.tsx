import React from "react";
import { StickerTemplate } from "../base-template";
import { interpolate, useCurrentFrame } from "remotion";

const CenteredWrapper: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    {children}
  </div>
);

// 1. Animated Loading Spinner
const loadingSpinner: StickerTemplate = {
  config: {
    id: "loading-spinner",
    name: "Loading Spinner",
    category: "Default",
    isPro: false,
    defaultProps: {
      size: 64,
      color: "#2196F3",
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const rotation = interpolate(frame, [0, 60], [0, 360], {
      extrapolateRight: "clamp",
    });

    const size = overlay.height || 64;

    return (
      <CenteredWrapper>
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#2196F3"
            strokeWidth="8"
            strokeDasharray="60 200"
            strokeLinecap="round"
          />
        </svg>
      </CenteredWrapper>
    );
  },
};

// 2. Glowing Orb
const glowingOrb: StickerTemplate = {
  config: {
    id: "glowing-orb",
    name: "Glowing Orb",
    category: "Default",
    isPro: false,
    defaultProps: {
      size: 70,
      color: "#00E5FF",
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const glow = interpolate(frame % 60, [0, 30, 60], [0.6, 1, 0.6], {
      extrapolateRight: "clamp",
    });

    const size = overlay.height || 70;

    return (
      <CenteredWrapper>
        <div
          style={{
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: "50%",
            background: "radial-gradient(circle, #00E5FF 0%, #0091EA 70%)",
            boxShadow: `0 0 ${size * 0.5 * glow}px #00E5FF`,
            opacity: glow,
          }}
        />
      </CenteredWrapper>
    );
  },
};

// 3. Typing Dots
const typingDots: StickerTemplate = {
  config: {
    id: "typing-dots",
    name: "Typing Dots",
    category: "Default",
    isPro: false,
    defaultProps: {
      size: 60,
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const size = overlay.height || 60;
    const dotSize = size * 0.2;

    const bounce1 = interpolate(frame % 30, [0, 10, 20, 30], [0, -10, 0, 0], {
      extrapolateRight: "clamp",
    });
    const bounce2 = interpolate(frame % 30, [5, 15, 25, 30], [0, -10, 0, 0], {
      extrapolateRight: "clamp",
    });
    const bounce3 = interpolate(frame % 30, [10, 20, 30], [0, -10, 0], {
      extrapolateRight: "clamp",
    });

    return (
      <CenteredWrapper>
        <div style={{ display: "flex", gap: `${dotSize * 0.5}px` }}>
          <div
            style={{
              width: `${dotSize}px`,
              height: `${dotSize}px`,
              borderRadius: "50%",
              backgroundColor: "#666",
              transform: `translateY(${bounce1}px)`,
            }}
          />
          <div
            style={{
              width: `${dotSize}px`,
              height: `${dotSize}px`,
              borderRadius: "50%",
              backgroundColor: "#666",
              transform: `translateY(${bounce2}px)`,
            }}
          />
          <div
            style={{
              width: `${dotSize}px`,
              height: `${dotSize}px`,
              borderRadius: "50%",
              backgroundColor: "#666",
              transform: `translateY(${bounce3}px)`,
            }}
          />
        </div>
      </CenteredWrapper>
    );
  },
};

// 4. Sparkle Effect
const sparkleEffect: StickerTemplate = {
  config: {
    id: "sparkle-effect",
    name: "Sparkle",
    category: "Default",
    isPro: false,
    defaultProps: {
      size: 56,
      color: "#FFD700",
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const scale = interpolate(frame % 40, [0, 20, 40], [0.5, 1, 0.5], {
      extrapolateRight: "clamp",
    });
    const rotation = interpolate(frame % 40, [0, 40], [0, 180], {
      extrapolateRight: "clamp",
    });

    const size = overlay.height || 56;

    return (
      <CenteredWrapper>
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          style={{ transform: `rotate(${rotation}deg) scale(${scale})` }}
        >
          <path
            d="M50 0 L55 45 L100 50 L55 55 L50 100 L45 55 L0 50 L45 45 Z"
            fill="#FFD700"
          />
        </svg>
      </CenteredWrapper>
    );
  },
};

// 5. Neon Arrow
const neonArrow: StickerTemplate = {
  config: {
    id: "neon-arrow",
    name: "Neon Arrow",
    category: "Default",
    isPro: true,
    defaultProps: {
      size: 60,
      color: "#FF00FF",
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const glow = interpolate(frame % 30, [0, 15, 30], [0.5, 1, 0.5], {
      extrapolateRight: "clamp",
    });

    const size = overlay.height || 60;

    return (
      <CenteredWrapper>
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          style={{
            filter: `drop-shadow(0 0 ${10 * glow}px #FF00FF)`,
            opacity: glow,
          }}
        >
          <path
            d="M20 50 L60 50 L60 30 L90 50 L60 70 L60 50"
            fill="none"
            stroke="#FF00FF"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </CenteredWrapper>
    );
  },
};

// 6. Countdown Timer
const countdownTimer: StickerTemplate = {
  config: {
    id: "countdown-timer",
    name: "Countdown",
    category: "Default",
    isPro: true,
    defaultProps: {
      size: 70,
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const seconds = Math.max(10 - Math.floor(frame / 30), 0);
    const size = overlay.height || 70;

    return (
      <CenteredWrapper>
        <div
          style={{
            fontSize: `${size * 0.5}px`,
            fontWeight: "bold",
            color: seconds <= 3 ? "#F44336" : "#4CAF50",
            fontFamily: "monospace",
            textAlign: "center",
          }}
        >
          {seconds}
        </div>
      </CenteredWrapper>
    );
  },
};

// 7. WiFi Signal
const wifiSignal: StickerTemplate = {
  config: {
    id: "wifi-signal",
    name: "WiFi Signal",
    category: "Default",
    isPro: false,
    defaultProps: {
      size: 60,
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const opacity1 = interpolate(frame % 60, [0, 20, 60], [0.3, 1, 0.3], {
      extrapolateRight: "clamp",
    });
    const opacity2 = interpolate(frame % 60, [10, 30, 60], [0.3, 1, 0.3], {
      extrapolateRight: "clamp",
    });
    const opacity3 = interpolate(frame % 60, [20, 40, 60], [0.3, 1, 0.3], {
      extrapolateRight: "clamp",
    });

    const size = overlay.height || 60;

    return (
      <CenteredWrapper>
        <svg width={size} height={size} viewBox="0 0 100 100">
          <circle cx="50" cy="80" r="5" fill="#2196F3" />
          <path
            d="M30 60 Q50 40, 70 60"
            fill="none"
            stroke="#2196F3"
            strokeWidth="5"
            strokeLinecap="round"
            opacity={opacity1}
          />
          <path
            d="M20 45 Q50 20, 80 45"
            fill="none"
            stroke="#2196F3"
            strokeWidth="5"
            strokeLinecap="round"
            opacity={opacity2}
          />
          <path
            d="M10 30 Q50 5, 90 30"
            fill="none"
            stroke="#2196F3"
            strokeWidth="5"
            strokeLinecap="round"
            opacity={opacity3}
          />
        </svg>
      </CenteredWrapper>
    );
  },
};

// 8. Battery Charging
const batteryCharging: StickerTemplate = {
  config: {
    id: "battery-charging",
    name: "Battery",
    category: "Default",
    isPro: false,
    defaultProps: {
      size: 60,
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const charge = interpolate(frame % 120, [0, 120], [0, 100], {
      extrapolateRight: "clamp",
    });

    const size = overlay.height || 60;

    return (
      <CenteredWrapper>
        <svg width={size} height={size * 0.6} viewBox="0 0 100 60">
          <rect
            x="5"
            y="10"
            width="80"
            height="40"
            fill="none"
            stroke="#333"
            strokeWidth="3"
            rx="5"
          />
          <rect x="85" y="25" width="10" height="10" fill="#333" />
          <rect
            x="8"
            y="13"
            width={charge * 0.74}
            height="34"
            fill={charge > 20 ? "#4CAF50" : "#F44336"}
            rx="3"
          />
        </svg>
      </CenteredWrapper>
    );
  },
};

// 9. Volume Wave
const volumeWave: StickerTemplate = {
  config: {
    id: "volume-wave",
    name: "Volume Wave",
    category: "Default",
    isPro: false,
    defaultProps: {
      size: 60,
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const size = overlay.height || 60;

    const bars = [10, 25, 15, 30, 20, 28, 12];
    return (
      <CenteredWrapper>
        <div style={{ display: "flex", gap: "3px", alignItems: "flex-end" }}>
          {bars.map((baseHeight, i) => {
            const height =
              baseHeight +
              interpolate(
                frame % (30 + i * 5),
                [0, 15 + i * 2.5, 30 + i * 5],
                [0, 15, 0],
                { extrapolateRight: "clamp" }
              );
            return (
              <div
                key={i}
                style={{
                  width: "6px",
                  height: `${height}px`,
                  backgroundColor: "#9C27B0",
                  borderRadius: "3px 3px 0 0",
                }}
              />
            );
          })}
        </div>
      </CenteredWrapper>
    );
  },
};

// 10. Radar Pulse
const radarPulse: StickerTemplate = {
  config: {
    id: "radar-pulse",
    name: "Radar",
    category: "Default",
    isPro: true,
    defaultProps: {
      size: 70,
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const rotation = interpolate(frame, [0, 120], [0, 360], {
      extrapolateRight: "clamp",
    });

    const size = overlay.height || 70;

    return (
      <CenteredWrapper>
        <svg width={size} height={size} viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#00E676"
            strokeWidth="2"
            opacity="0.3"
          />
          <circle
            cx="50"
            cy="50"
            r="30"
            fill="none"
            stroke="#00E676"
            strokeWidth="2"
            opacity="0.4"
          />
          <circle
            cx="50"
            cy="50"
            r="20"
            fill="none"
            stroke="#00E676"
            strokeWidth="2"
            opacity="0.5"
          />
          <line
            x1="50"
            y1="50"
            x2="50"
            y2="10"
            stroke="#00E676"
            strokeWidth="3"
            strokeLinecap="round"
            style={{
              transformOrigin: "50px 50px",
              transform: `rotate(${rotation}deg)`,
            }}
          />
        </svg>
      </CenteredWrapper>
    );
  },
};

// 11. Chat Bubble
const chatBubble: StickerTemplate = {
  config: {
    id: "chat-bubble",
    name: "Chat Bubble",
    category: "Default",
    isPro: false,
    defaultProps: {
      size: 60,
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const scale = interpolate(frame % 60, [0, 10, 60], [0, 1, 1], {
      extrapolateRight: "clamp",
    });

    const size = overlay.height || 60;

    return (
      <CenteredWrapper>
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          style={{ transform: `scale(${scale})` }}
        >
          <rect
            x="10"
            y="10"
            width="80"
            height="60"
            rx="10"
            fill="#2196F3"
          />
          <path d="M30 70 L20 85 L40 70 Z" fill="#2196F3" />
          <circle cx="30" cy="40" r="5" fill="white" />
          <circle cx="50" cy="40" r="5" fill="white" />
          <circle cx="70" cy="40" r="5" fill="white" />
        </svg>
      </CenteredWrapper>
    );
  },
};

// 12. Thumbs Up Animation
const thumbsUpAnim: StickerTemplate = {
  config: {
    id: "thumbs-up-anim",
    name: "Thumbs Up Animated",
    category: "Default",
    isPro: false,
    defaultProps: {
      size: 60,
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const bounce = interpolate(frame % 40, [0, 20, 40], [0, -10, 0], {
      extrapolateRight: "clamp",
    });
    const scale = interpolate(frame % 40, [0, 5, 40], [1, 1.2, 1], {
      extrapolateRight: "clamp",
    });

    const size = overlay.height || 60;

    return (
      <CenteredWrapper>
        <div
          style={{
            fontSize: `${size}px`,
            transform: `translateY(${bounce}px) scale(${scale})`,
          }}
        >
          👍
        </div>
      </CenteredWrapper>
    );
  },
};

// 13. Eye Icon
const eyeIcon: StickerTemplate = {
  config: {
    id: "eye-icon",
    name: "Eye",
    category: "Default",
    isPro: false,
    defaultProps: {
      size: 70,
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const blink = frame % 120 > 110 ? 0 : 1;

    const size = overlay.height || 70;

    return (
      <CenteredWrapper>
        <svg width={size} height={size * 0.6} viewBox="0 0 100 60">
          <ellipse
            cx="50"
            cy="30"
            rx="45"
            ry="25"
            fill="none"
            stroke="#333"
            strokeWidth="4"
          />
          <circle cx="50" cy="30" r="12" fill="#333" opacity={blink} />
        </svg>
      </CenteredWrapper>
    );
  },
};

// 14. Shopping Cart
const shoppingCart: StickerTemplate = {
  config: {
    id: "shopping-cart",
    name: "Shopping Cart",
    category: "Default",
    isPro: false,
    defaultProps: {
      size: 60,
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const wiggle = interpolate(frame % 30, [0, 15, 30], [-2, 2, -2], {
      extrapolateRight: "clamp",
    });

    const size = overlay.height || 60;

    return (
      <CenteredWrapper>
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          style={{ transform: `translateX(${wiggle}px)` }}
        >
          <path
            d="M20 20 L30 20 L40 70 L80 70"
            fill="none"
            stroke="#FF5722"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="35" y="30" width="50" height="35" fill="none" stroke="#FF5722" strokeWidth="4" />
          <circle cx="45" cy="80" r="5" fill="#FF5722" />
          <circle cx="75" cy="80" r="5" fill="#FF5722" />
        </svg>
      </CenteredWrapper>
    );
  },
};

// 15. Bookmark
const bookmarkIcon: StickerTemplate = {
  config: {
    id: "bookmark-icon",
    name: "Bookmark",
    category: "Default",
    isPro: false,
    defaultProps: {
      size: 50,
    },
  },
  Component: ({ overlay }) => {
    const size = overlay.height || 50;

    return (
      <CenteredWrapper>
        <svg width={size} height={size} viewBox="0 0 100 100">
          <path
            d="M25 10 L75 10 L75 90 L50 70 L25 90 Z"
            fill="#FFC107"
            stroke="#F57F17"
            strokeWidth="3"
          />
        </svg>
      </CenteredWrapper>
    );
  },
};

// 16. Download Icon
const downloadIcon: StickerTemplate = {
  config: {
    id: "download-icon",
    name: "Download",
    category: "Default",
    isPro: false,
    defaultProps: {
      size: 60,
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const bounce = interpolate(frame % 50, [0, 25, 50], [0, 5, 0], {
      extrapolateRight: "clamp",
    });

    const size = overlay.height || 60;

    return (
      <CenteredWrapper>
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          style={{ transform: `translateY(${bounce}px)` }}
        >
          <line
            x1="50"
            y1="20"
            x2="50"
            y2="60"
            stroke="#4CAF50"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M30 50 L50 70 L70 50"
            fill="none"
            stroke="#4CAF50"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line
            x1="20"
            y1="80"
            x2="80"
            y2="80"
            stroke="#4CAF50"
            strokeWidth="6"
            strokeLinecap="round"
          />
        </svg>
      </CenteredWrapper>
    );
  },
};

// 17. Share Icon
const shareIcon: StickerTemplate = {
  config: {
    id: "share-icon",
    name: "Share",
    category: "Default",
    isPro: false,
    defaultProps: {
      size: 60,
    },
  },
  Component: ({ overlay }) => {
    const size = overlay.height || 60;

    return (
      <CenteredWrapper>
        <svg width={size} height={size} viewBox="0 0 100 100">
          <circle cx="75" cy="25" r="15" fill="#2196F3" />
          <circle cx="25" cy="50" r="15" fill="#2196F3" />
          <circle cx="75" cy="75" r="15" fill="#2196F3" />
          <line x1="38" y1="45" x2="62" y2="30" stroke="#2196F3" strokeWidth="4" />
          <line x1="38" y1="55" x2="62" y2="70" stroke="#2196F3" strokeWidth="4" />
        </svg>
      </CenteredWrapper>
    );
  },
};

// 18. Like Heart Burst
const likeHeartBurst: StickerTemplate = {
  config: {
    id: "like-heart-burst",
    name: "Heart Burst",
    category: "Default",
    isPro: true,
    defaultProps: {
      size: 70,
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const scale = interpolate(frame % 60, [0, 10, 20, 60], [0, 1.2, 1, 1], {
      extrapolateRight: "clamp",
    });
    const particleScale = interpolate(frame % 60, [10, 30], [0, 1], {
      extrapolateRight: "clamp",
    });

    const size = overlay.height || 70;

    return (
      <CenteredWrapper>
        <svg width={size} height={size} viewBox="0 0 100 100">
          <text
            x="50"
            y="60"
            fontSize="50"
            textAnchor="middle"
            style={{ transform: `scale(${scale})`, transformOrigin: "50px 50px" }}
          >
            ❤️
          </text>
          {frame % 60 > 10 && (
            <>
              <circle cx="50" cy="20" r={3 * particleScale} fill="#FF6B9D" />
              <circle cx="80" cy="50" r={3 * particleScale} fill="#FF6B9D" />
              <circle cx="50" cy="80" r={3 * particleScale} fill="#FF6B9D" />
              <circle cx="20" cy="50" r={3 * particleScale} fill="#FF6B9D" />
            </>
          )}
        </svg>
      </CenteredWrapper>
    );
  },
};

// 19. New Badge
const newBadge: StickerTemplate = {
  config: {
    id: "new-badge",
    name: "NEW Badge",
    category: "Default",
    isPro: false,
    defaultProps: {
      size: 60,
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const pulse = interpolate(frame % 40, [0, 20, 40], [1, 1.1, 1], {
      extrapolateRight: "clamp",
    });

    const size = overlay.height || 60;

    return (
      <CenteredWrapper>
        <div
          style={{
            width: `${size}px`,
            height: `${size * 0.6}px`,
            backgroundColor: "#FF4081",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: `${size * 0.3}px`,
            fontWeight: "bold",
            transform: `scale(${pulse})`,
            boxShadow: "0 4px 10px rgba(255, 64, 129, 0.4)",
          }}
        >
          NEW
        </div>
      </CenteredWrapper>
    );
  },
};

// 20. Hot Badge
const hotBadge: StickerTemplate = {
  config: {
    id: "hot-badge",
    name: "HOT Badge",
    category: "Default",
    isPro: false,
    defaultProps: {
      size: 60,
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const wiggle = interpolate(frame % 20, [0, 5, 10, 15, 20], [0, -3, 0, 3, 0], {
      extrapolateRight: "clamp",
    });

    const size = overlay.height || 60;

    return (
      <CenteredWrapper>
        <div
          style={{
            transform: `rotate(${wiggle}deg)`,
          }}
        >
          <div
            style={{
              width: `${size}px`,
              height: `${size * 0.6}px`,
              background: "linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: `${size * 0.3}px`,
              fontWeight: "bold",
              boxShadow: "0 4px 10px rgba(255, 107, 53, 0.4)",
            }}
          >
            🔥 HOT
          </div>
        </div>
      </CenteredWrapper>
    );
  },
};

// 21. Sale Tag
const saleTag: StickerTemplate = {
  config: {
    id: "sale-tag",
    name: "SALE Tag",
    category: "Default",
    isPro: false,
    defaultProps: {
      size: 70,
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const rotate = interpolate(frame % 60, [0, 30, 60], [-5, 5, -5], {
      extrapolateRight: "clamp",
    });

    const size = overlay.height || 70;

    return (
      <CenteredWrapper>
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          style={{ transform: `rotate(${rotate}deg)` }}
        >
          <path
            d="M10 50 L50 10 L90 50 L50 90 Z"
            fill="#F44336"
            stroke="#C62828"
            strokeWidth="3"
          />
          <text
            x="50"
            y="60"
            fontSize="22"
            fill="white"
            fontWeight="bold"
            textAnchor="middle"
          >
            SALE
          </text>
        </svg>
      </CenteredWrapper>
    );
  },
};

// 22. Verified Badge
const verifiedBadge: StickerTemplate = {
  config: {
    id: "verified-badge",
    name: "Verified",
    category: "Default",
    isPro: true,
    defaultProps: {
      size: 60,
    },
  },
  Component: ({ overlay }) => {
    const size = overlay.height || 60;

    return (
      <CenteredWrapper>
        <svg width={size} height={size} viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="#1DA1F2" />
          <path
            d="M30 50 L45 65 L75 35"
            fill="none"
            stroke="white"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </CenteredWrapper>
    );
  },
};

// 23. Notification Dot
const notificationDot: StickerTemplate = {
  config: {
    id: "notification-dot",
    name: "Notification",
    category: "Default",
    isPro: false,
    defaultProps: {
      size: 40,
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const pulse = interpolate(frame % 40, [0, 20, 40], [1, 1.3, 1], {
      extrapolateRight: "clamp",
    });

    const size = overlay.height || 40;

    return (
      <CenteredWrapper>
        <div
          style={{
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: "50%",
            backgroundColor: "#F44336",
            transform: `scale(${pulse})`,
            boxShadow: "0 0 20px rgba(244, 67, 54, 0.6)",
          }}
        />
      </CenteredWrapper>
    );
  },
};

export const defaultStickers = [
  loadingSpinner,
  glowingOrb,
  typingDots,
  sparkleEffect,
  neonArrow,
  countdownTimer,
  wifiSignal,
  batteryCharging,
  volumeWave,
  radarPulse,
  chatBubble,
  thumbsUpAnim,
  eyeIcon,
  shoppingCart,
  bookmarkIcon,
  downloadIcon,
  shareIcon,
  likeHeartBurst,
  newBadge,
  hotBadge,
  saleTag,
  verifiedBadge,
  notificationDot,
];
