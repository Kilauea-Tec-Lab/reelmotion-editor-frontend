import React from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { ClipOverlay, ImageOverlay } from "../../../types";
import { FPS } from "../../../constants";
import { useEditorContext } from "../../../contexts/editor-context";
import {
  findOutgoingNeighbor,
  TRANSITION_MAX_FRAMES,
  TRANSITION_MIN_FRAMES,
  TransitionConfig,
  TransitionDirection,
  transitionTemplates,
  transitionTypes,
} from "../../../utils/transitions";

interface TransitionSettingsProps {
  overlay: ClipOverlay | ImageOverlay;
  onChange: (transitionIn: TransitionConfig | undefined) => void;
}

const DIRECTIONS: { value: TransitionDirection; Icon: React.FC<{ className?: string }> }[] = [
  { value: "left", Icon: ArrowLeft },
  { value: "right", Icon: ArrowRight },
  { value: "up", Icon: ArrowUp },
  { value: "down", Icon: ArrowDown },
];

const chip = (selected: boolean, disabled = false) =>
  `text-xs px-2 py-1.5 rounded-md border transition-colors ${
    selected
      ? "bg-primarioLogo/20 border-primarioLogo text-gray-900 dark:text-white"
      : "bg-gray-200/50 dark:bg-gray-700/50 border-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700"
  } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`;

/**
 * "Transition from the previous clip" section of a video/image panel.
 * Only meaningful when another video/image ends where this clip starts.
 */
export const TransitionSettings: React.FC<TransitionSettingsProps> = ({ overlay, onChange }) => {
  const { t } = useTranslation();
  const { overlays } = useEditorContext();
  const neighbor = findOutgoingNeighbor(overlays, overlay);
  const current = overlay.transitionIn;
  const template = current && transitionTemplates[current.type];

  const select = (type: (typeof transitionTypes)[number] | "none") => {
    if (type === "none") return onChange(undefined);
    const tpl = transitionTemplates[type];
    onChange({
      type,
      durationInFrames: current?.durationInFrames ?? tpl.durationDefault,
      direction: tpl.directional ? current?.direction ?? "left" : undefined,
    });
  };

  return (
    <div className="space-y-3 rounded-md bg-gray-100/50 dark:bg-darkBoxSub /50 p-4 border border-gray-200 dark:border-gray-700">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {t("transition.title")}
      </h3>
      {!neighbor && (
        <p className="text-xs text-gray-500 dark:text-zinc-400">{t("transition.needsNeighbor")}</p>
      )}

      {/* ponytail: text chips instead of animated previews; add previews if users ask. */}
      <div className="grid grid-cols-3 gap-1.5">
        <button className={chip(!current)} onClick={() => select("none")}>
          {t("transition.none")}
        </button>
        {transitionTypes.map((type) => (
          <button
            key={type}
            className={chip(current?.type === type, !neighbor)}
            disabled={!neighbor}
            onClick={() => select(type)}
          >
            {t(`transition.${type}`)}
          </button>
        ))}
      </div>

      {current && template?.directional && (
        <div className="flex items-center gap-1.5">
          {DIRECTIONS.map(({ value, Icon }) => (
            <button
              key={value}
              aria-label={value}
              className={chip(current.direction === value)}
              onClick={() => onChange({ ...current, direction: value })}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>
      )}

      {current && (
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={TRANSITION_MIN_FRAMES}
            max={TRANSITION_MAX_FRAMES}
            step={1}
            value={current.durationInFrames}
            onChange={(e) => onChange({ ...current, durationInFrames: Number(e.target.value) })}
            className="flex-1 accent-primarioLogo h-1.5 rounded-full bg-gray-200 dark:bg-gray-700"
          />
          <span className="text-xs text-gray-600 dark:text-gray-400 min-w-[40px] text-right">
            {(current.durationInFrames / FPS).toFixed(1)}s
          </span>
        </div>
      )}
    </div>
  );
};
