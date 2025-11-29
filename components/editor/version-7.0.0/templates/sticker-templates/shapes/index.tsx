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

const pulsingCircle: StickerTemplate = {
  config: {
    id: "pulsing-circle",
    name: "Pulsing Circle",
    category: "Shapes",
    isPro: false,
    defaultProps: {
      size: 64,
      color: "#FF4081",
      pulseSpeed: "normal",
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const scale = interpolate(frame % 60, [0, 30, 60], [1, 1.2, 1], {
      extrapolateRight: "clamp",
    });

    return (
      <CenteredWrapper>
        <div
          style={{
            width: `${overlay.height || 64}px`,
            height: `${overlay.height || 64}px`,
            backgroundColor: "#FF4081",
            borderRadius: "50%",
            transform: `scale(${scale})`,
          }}
        />
      </CenteredWrapper>
    );
  },
};

const spinningSquare: StickerTemplate = {
  config: {
    id: "spinning-square",
    name: "Spinning Square",
    category: "Shapes",
    isPro: true,
    defaultProps: {
      size: 48,
      color: "#2196F3",
      borderWidth: 4,
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const rotation = interpolate(frame, [0, 60], [0, 360], {
      extrapolateRight: "clamp",
    });

    return (
      <CenteredWrapper>
        <div
          style={{
            width: `${overlay.height || 48}px`,
            height: `${overlay.height || 48}px`,
            borderWidth: "10px",
            borderStyle: "solid",
            borderColor: "#2196F3",
            borderRadius: "4px",
            transform: `rotate(${rotation}deg)`,
          }}
        />
      </CenteredWrapper>
    );
  },
};

const bouncingTriangle: StickerTemplate = {
  config: {
    id: "bouncing-triangle",
    name: "Bouncing Triangle",
    category: "Shapes",
    isPro: true,
    defaultProps: {
      size: 56,
      color: "#4CAF50",
      bounceHeight: 10,
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const translateY = interpolate(frame % 45, [0, 22.5, 45], [0, -15, 0], {
      extrapolateRight: "clamp",
    });

    return (
      <CenteredWrapper>
        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: `${(overlay.height || 56) / 2}px solid transparent`,
            borderRight: `${(overlay.height || 56) / 2}px solid transparent`,
            borderBottom: `${overlay.height || 56}px solid #4CAF50`,
            transform: `translateY(${translateY}px)`,
          }}
        />
      </CenteredWrapper>
    );
  },
};

const expandingHexagon: StickerTemplate = {
  config: {
    id: "expanding-hexagon",
    name: "Expanding Hexagon",
    category: "Shapes",
    isPro: false,
    defaultProps: {
      size: 52,
      color: "#9C27B0",
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const scale = interpolate(frame % 75, [0, 37.5, 75], [0.8, 1.1, 0.8], {
      extrapolateRight: "clamp",
    });

    const size = overlay.height || 52;
    const color = "#9C27B0";

    return (
      <CenteredWrapper>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: `${size}px`,
            height: `${size * 0.866}px`,
            backgroundColor: color,
            clipPath:
              "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
            transform: `translate(-50%, -50%) scale(${scale})`,
          }}
        />
      </CenteredWrapper>
    );
  },
};

const morphingStar: StickerTemplate = {
  config: {
    id: "morphing-star",
    name: "Star",
    category: "Shapes",
    isPro: true,
    defaultProps: {
      size: 60,
      color: "#FFC107",
    },
  },
  Component: ({ overlay }) => {
    const size = overlay.height || 60;
    const color = "#FFC107";

    return (
      <CenteredWrapper>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: `${size}px`,
            height: `${size}px`,
            backgroundColor: color,
            clipPath:
              "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
            transform: "translate(-50%, -50%)",
          }}
        />
      </CenteredWrapper>
    );
  },
};

const rotatingOctagon: StickerTemplate = {
  config: {
    id: "rotating-octagon",
    name: "Rotating Octagon",
    category: "Shapes",
    isPro: true,
    defaultProps: {
      size: 58,
      color: "#009688",
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const rotation = interpolate(frame, [0, 120], [0, 360], {
      extrapolateRight: "clamp",
    });

    const size = overlay.height || 58;
    const color = "#009688";

    return (
      <CenteredWrapper>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: `${size}px`,
            height: `${size}px`,
            backgroundColor: color,
            clipPath:
              "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
            transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          }}
        />
      </CenteredWrapper>
    );
  },
};

const zigzagDiamond: StickerTemplate = {
  config: {
    id: "zigzag-diamond",
    name: "Zigzag Diamond",
    category: "Shapes",
    isPro: false,
    defaultProps: {
      size: 54,
      color: "#673AB7",
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const skew = interpolate(frame % 45, [0, 22.5, 45], [-15, 15, -15], {
      extrapolateRight: "clamp",
    });

    const size = overlay.height || 54;
    const color = "#673AB7";

    return (
      <CenteredWrapper>
        <div
          style={{
            width: `${size}px`,
            height: `${size}px`,
            backgroundColor: color,
            clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
            transform: `skew(${skew}deg)`,
          }}
        />
      </CenteredWrapper>
    );
  },
};

const flashingPentagon: StickerTemplate = {
  config: {
    id: "flashing-pentagon",
    name: "Flashing Pentagon",
    category: "Shapes",
    isPro: false,
    defaultProps: {
      size: 56,
      color: "#E91E63",
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const opacity = interpolate(frame % 30, [0, 15, 30], [1, 0.4, 1], {
      extrapolateRight: "clamp",
    });

    const size = overlay.height || 56;
    const color = "#E91E63";

    return (
      <CenteredWrapper>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: `${size}px`,
            height: `${size}px`,
            backgroundColor: color,
            opacity: opacity,
            clipPath: "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)",
            transform: "translate(-50%, -50%)",
          }}
        />
      </CenteredWrapper>
    );
  },
};

const wavyRectangle: StickerTemplate = {
  config: {
    id: "wavy-rectangle",
    name: "Wavy Rectangle",
    category: "Shapes",
    isPro: false,
    defaultProps: {
      size: 60,
      color: "#FF5722",
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const wave = interpolate(frame % 40, [0, 20, 40], [0, 5, 0], {
      extrapolateRight: "clamp",
    });

    const size = overlay.height || 60;
    const color = "#FF5722";

    return (
      <CenteredWrapper>
        <div
          style={{
            width: `${size}px`,
            height: `${size * 0.6}px`,
            backgroundColor: color,
            borderRadius: "8px",
            transform: `perspective(500px) rotateY(${wave}deg)`,
          }}
        />
      </CenteredWrapper>
    );
  },
};

const gradientCircle: StickerTemplate = {
  config: {
    id: "gradient-circle",
    name: "Gradient Circle",
    category: "Shapes",
    isPro: false,
    defaultProps: {
      size: 64,
      color: "#00BCD4",
    },
  },
  Component: ({ overlay }) => {
    const size = overlay.height || 64;

    return (
      <CenteredWrapper>
        <div
          style={{
            width: `${size}px`,
            height: `${size}px`,
            background: "linear-gradient(135deg, #00BCD4 0%, #E91E63 100%)",
            borderRadius: "50%",
          }}
        />
      </CenteredWrapper>
    );
  },
};

const hollowHeart: StickerTemplate = {
  config: {
    id: "hollow-heart",
    name: "Hollow Heart",
    category: "Shapes",
    isPro: true,
    defaultProps: {
      size: 60,
      color: "#E91E63",
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const scale = interpolate(frame % 60, [0, 30, 60], [1, 1.15, 1], {
      extrapolateRight: "clamp",
    });

    const size = overlay.height || 60;
    const color = "#E91E63";

    return (
      <CenteredWrapper>
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          style={{ transform: `scale(${scale})` }}
        >
          <path
            d="M50 85 C20 60, 5 40, 5 25 C5 15, 12 8, 20 8 C30 8, 40 15, 50 25 C60 15, 70 8, 80 8 C88 8, 95 15, 95 25 C95 40, 80 60, 50 85 Z"
            fill="none"
            stroke={color}
            strokeWidth="6"
          />
        </svg>
      </CenteredWrapper>
    );
  },
};

const roundedTriangle: StickerTemplate = {
  config: {
    id: "rounded-triangle",
    name: "Rounded Triangle",
    category: "Shapes",
    isPro: false,
    defaultProps: {
      size: 58,
      color: "#8BC34A",
    },
  },
  Component: ({ overlay }) => {
    const size = overlay.height || 58;
    const color = "#8BC34A";

    return (
      <CenteredWrapper>
        <svg width={size} height={size} viewBox="0 0 100 100">
          <path
            d="M50 10 L90 80 L10 80 Z"
            fill={color}
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      </CenteredWrapper>
    );
  },
};

const donutShape: StickerTemplate = {
  config: {
    id: "donut-shape",
    name: "Donut",
    category: "Shapes",
    isPro: false,
    defaultProps: {
      size: 64,
      color: "#FF6F00",
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const rotation = interpolate(frame, [0, 90], [0, 360], {
      extrapolateRight: "clamp",
    });

    const size = overlay.height || 64;
    const color = "#FF6F00";

    return (
      <CenteredWrapper>
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <circle cx="50" cy="50" r="40" fill={color} />
          <circle cx="50" cy="50" r="20" fill="white" />
        </svg>
      </CenteredWrapper>
    );
  },
};

const chevronRight: StickerTemplate = {
  config: {
    id: "chevron-right",
    name: "Chevron Right",
    category: "Shapes",
    isPro: false,
    defaultProps: {
      size: 50,
      color: "#3F51B5",
    },
  },
  Component: ({ overlay }) => {
    const size = overlay.height || 50;
    const color = "#3F51B5";

    return (
      <CenteredWrapper>
        <svg width={size} height={size} viewBox="0 0 100 100">
          <path
            d="M30 10 L70 50 L30 90"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </CenteredWrapper>
    );
  },
};

const crossShape: StickerTemplate = {
  config: {
    id: "cross-shape",
    name: "Cross",
    category: "Shapes",
    isPro: false,
    defaultProps: {
      size: 60,
      color: "#795548",
    },
  },
  Component: ({ overlay }) => {
    const size = overlay.height || 60;
    const color = "#795548";

    return (
      <CenteredWrapper>
        <svg width={size} height={size} viewBox="0 0 100 100">
          <rect x="40" y="10" width="20" height="80" fill={color} />
          <rect x="10" y="40" width="80" height="20" fill={color} />
        </svg>
      </CenteredWrapper>
    );
  },
};

const arrowUp: StickerTemplate = {
  config: {
    id: "arrow-up",
    name: "Arrow Up",
    category: "Shapes",
    isPro: false,
    defaultProps: {
      size: 56,
      color: "#4CAF50",
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const translateY = interpolate(frame % 40, [0, 20, 40], [0, -8, 0], {
      extrapolateRight: "clamp",
    });

    const size = overlay.height || 56;
    const color = "#4CAF50";

    return (
      <CenteredWrapper>
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          style={{ transform: `translateY(${translateY}px)` }}
        >
          <path
            d="M50 20 L20 50 L35 50 L35 80 L65 80 L65 50 L80 50 Z"
            fill={color}
          />
        </svg>
      </CenteredWrapper>
    );
  },
};

const lightningBolt: StickerTemplate = {
  config: {
    id: "lightning-bolt",
    name: "Lightning Bolt",
    category: "Shapes",
    isPro: true,
    defaultProps: {
      size: 58,
      color: "#FFD600",
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const opacity = interpolate(frame % 20, [0, 10, 20], [1, 0.5, 1], {
      extrapolateRight: "clamp",
    });

    const size = overlay.height || 58;
    const color = "#FFD600";

    return (
      <CenteredWrapper>
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          style={{ opacity }}
        >
          <path
            d="M55 10 L30 50 L45 50 L35 90 L70 45 L55 45 Z"
            fill={color}
          />
        </svg>
      </CenteredWrapper>
    );
  },
};

const cloudShape: StickerTemplate = {
  config: {
    id: "cloud-shape",
    name: "Cloud",
    category: "Shapes",
    isPro: false,
    defaultProps: {
      size: 70,
      color: "#90CAF9",
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const translateX = interpolate(frame % 100, [0, 50, 100], [-5, 5, -5], {
      extrapolateRight: "clamp",
    });

    const size = overlay.height || 70;
    const color = "#90CAF9";

    return (
      <CenteredWrapper>
        <svg
          width={size}
          height={size * 0.7}
          viewBox="0 0 100 70"
          style={{ transform: `translateX(${translateX}px)` }}
        >
          <path
            d="M25 45 Q25 30, 35 25 Q35 15, 45 15 Q55 15, 55 25 Q70 25, 75 35 Q80 40, 75 45 Z"
            fill={color}
          />
        </svg>
      </CenteredWrapper>
    );
  },
};

const plusSign: StickerTemplate = {
  config: {
    id: "plus-sign",
    name: "Plus Sign",
    category: "Shapes",
    isPro: false,
    defaultProps: {
      size: 54,
      color: "#4CAF50",
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const rotation = interpolate(frame % 80, [0, 40, 80], [0, 90, 0], {
      extrapolateRight: "clamp",
    });

    const size = overlay.height || 54;
    const color = "#4CAF50";

    return (
      <CenteredWrapper>
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <rect x="40" y="15" width="20" height="70" rx="5" fill={color} />
          <rect x="15" y="40" width="70" height="20" rx="5" fill={color} />
        </svg>
      </CenteredWrapper>
    );
  },
};

const checkMark: StickerTemplate = {
  config: {
    id: "check-mark",
    name: "Check Mark",
    category: "Shapes",
    isPro: false,
    defaultProps: {
      size: 60,
      color: "#4CAF50",
    },
  },
  Component: ({ overlay }) => {
    const size = overlay.height || 60;
    const color = "#4CAF50";

    return (
      <CenteredWrapper>
        <svg width={size} height={size} viewBox="0 0 100 100">
          <path
            d="M20 50 L40 70 L80 30"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </CenteredWrapper>
    );
  },
};

const xMark: StickerTemplate = {
  config: {
    id: "x-mark",
    name: "X Mark",
    category: "Shapes",
    isPro: false,
    defaultProps: {
      size: 60,
      color: "#F44336",
    },
  },
  Component: ({ overlay }) => {
    const size = overlay.height || 60;
    const color = "#F44336";

    return (
      <CenteredWrapper>
        <svg width={size} height={size} viewBox="0 0 100 100">
          <path
            d="M20 20 L80 80 M80 20 L20 80"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
          />
        </svg>
      </CenteredWrapper>
    );
  },
};

const questionMark: StickerTemplate = {
  config: {
    id: "question-mark",
    name: "Question Mark",
    category: "Shapes",
    isPro: false,
    defaultProps: {
      size: 58,
      color: "#FF9800",
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const bounce = interpolate(frame % 50, [0, 25, 50], [0, -5, 0], {
      extrapolateRight: "clamp",
    });

    const size = overlay.height || 58;
    const color = "#FF9800";

    return (
      <CenteredWrapper>
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          style={{ transform: `translateY(${bounce}px)` }}
        >
          <text
            x="50"
            y="70"
            fontSize="80"
            fill={color}
            fontWeight="bold"
            textAnchor="middle"
          >
            ?
          </text>
        </svg>
      </CenteredWrapper>
    );
  },
};

const exclamationMark: StickerTemplate = {
  config: {
    id: "exclamation-mark",
    name: "Exclamation Mark",
    category: "Shapes",
    isPro: false,
    defaultProps: {
      size: 58,
      color: "#F44336",
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const scale = interpolate(frame % 30, [0, 15, 30], [1, 1.2, 1], {
      extrapolateRight: "clamp",
    });

    const size = overlay.height || 58;
    const color = "#F44336";

    return (
      <CenteredWrapper>
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          style={{ transform: `scale(${scale})` }}
        >
          <text
            x="50"
            y="70"
            fontSize="80"
            fill={color}
            fontWeight="bold"
            textAnchor="middle"
          >
            !
          </text>
        </svg>
      </CenteredWrapper>
    );
  },
};

const musicNote: StickerTemplate = {
  config: {
    id: "music-note",
    name: "Music Note",
    category: "Shapes",
    isPro: true,
    defaultProps: {
      size: 60,
      color: "#9C27B0",
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const sway = interpolate(frame % 60, [0, 30, 60], [-10, 10, -10], {
      extrapolateRight: "clamp",
    });

    const size = overlay.height || 60;
    const color = "#9C27B0";

    return (
      <CenteredWrapper>
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          style={{ transform: `rotate(${sway}deg)` }}
        >
          <path
            d="M40 80 Q30 75, 30 65 Q30 55, 40 50 L40 20 L60 15 L60 70 Q70 65, 70 75 Q70 85, 60 85 Q50 85, 50 75"
            fill={color}
          />
        </svg>
      </CenteredWrapper>
    );
  },
};

const infinitySymbol: StickerTemplate = {
  config: {
    id: "infinity-symbol",
    name: "Infinity",
    category: "Shapes",
    isPro: true,
    defaultProps: {
      size: 70,
      color: "#00BCD4",
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const flow = interpolate(frame, [0, 120], [0, 360], {
      extrapolateRight: "clamp",
    });

    const size = overlay.height || 70;
    const color = "#00BCD4";

    return (
      <CenteredWrapper>
        <svg
          width={size}
          height={size * 0.5}
          viewBox="0 0 100 50"
          style={{ transform: `rotate(${flow}deg)` }}
        >
          <path
            d="M10 25 Q10 10, 20 10 Q30 10, 35 25 Q40 40, 50 25 Q60 10, 70 10 Q80 10, 80 25 Q80 40, 70 40 Q60 40, 55 25 Q50 10, 40 25 Q30 40, 20 40 Q10 40, 10 25"
            fill={color}
          />
        </svg>
      </CenteredWrapper>
    );
  },
};

const locationPin: StickerTemplate = {
  config: {
    id: "location-pin",
    name: "Location Pin",
    category: "Shapes",
    isPro: false,
    defaultProps: {
      size: 60,
      color: "#F44336",
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const bounce = interpolate(frame % 60, [0, 30, 60], [0, 5, 0], {
      extrapolateRight: "clamp",
    });

    const size = overlay.height || 60;
    const color = "#F44336";

    return (
      <CenteredWrapper>
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          style={{ transform: `translateY(${bounce}px)` }}
        >
          <path
            d="M50 10 Q30 10, 20 25 Q10 40, 20 50 L50 85 L80 50 Q90 40, 80 25 Q70 10, 50 10 Z"
            fill={color}
          />
          <circle cx="50" cy="30" r="10" fill="white" />
        </svg>
      </CenteredWrapper>
    );
  },
};

const bellShape: StickerTemplate = {
  config: {
    id: "bell-shape",
    name: "Bell",
    category: "Shapes",
    isPro: false,
    defaultProps: {
      size: 60,
      color: "#FFC107",
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const ring = interpolate(frame % 40, [0, 10, 20, 30, 40], [0, -5, 0, -5, 0], {
      extrapolateRight: "clamp",
    });

    const size = overlay.height || 60;
    const color = "#FFC107";

    return (
      <CenteredWrapper>
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          style={{ transform: `rotate(${ring}deg)` }}
        >
          <path
            d="M50 20 L45 25 Q30 30, 25 50 Q25 65, 30 70 L70 70 Q75 65, 75 50 Q70 30, 55 25 L50 20 Z M40 75 Q40 85, 50 85 Q60 85, 60 75"
            fill={color}
          />
        </svg>
      </CenteredWrapper>
    );
  },
};

const gearShape: StickerTemplate = {
  config: {
    id: "gear-shape",
    name: "Gear",
    category: "Shapes",
    isPro: true,
    defaultProps: {
      size: 64,
      color: "#607D8B",
    },
  },
  Component: ({ overlay }) => {
    const frame = useCurrentFrame();
    const rotation = interpolate(frame, [0, 120], [0, 360], {
      extrapolateRight: "clamp",
    });

    const size = overlay.height || 64;
    const color = "#607D8B";

    return (
      <CenteredWrapper>
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <path
            d="M50 15 L55 25 L65 20 L65 30 L75 35 L70 45 L80 50 L70 55 L75 65 L65 70 L65 80 L55 75 L50 85 L45 75 L35 80 L35 70 L25 65 L30 55 L20 50 L30 45 L25 35 L35 30 L35 20 L45 25 Z"
            fill={color}
          />
          <circle cx="50" cy="50" r="15" fill="white" />
        </svg>
      </CenteredWrapper>
    );
  },
};

export const shapeStickers = [
  pulsingCircle,
  spinningSquare,
  bouncingTriangle,
  expandingHexagon,
  morphingStar,
  rotatingOctagon,
  zigzagDiamond,
  flashingPentagon,
  wavyRectangle,
  gradientCircle,
  hollowHeart,
  roundedTriangle,
  donutShape,
  chevronRight,
  crossShape,
  arrowUp,
  lightningBolt,
  cloudShape,
  plusSign,
  checkMark,
  xMark,
  questionMark,
  exclamationMark,
  musicNote,
  infinitySymbol,
  locationPin,
  bellShape,
  gearShape,
];
