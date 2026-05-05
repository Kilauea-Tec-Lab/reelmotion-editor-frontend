import React from "react";
import { TextOverlay } from "../../../types";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import ColorPicker from "react-best-gradient-color-picker";
import { useTranslation } from "@/lib/i18n";

/**
 * Available font options for text overlays
 */
const fonts = [
  { value: "font-sans", label: "Inter (Sans-serif)" },
  { value: "font-serif", label: "Merriweather (Serif)" },
  { value: "font-mono", label: "Roboto Mono (Monospace)" },
  { value: "font-retro", label: "VT323" },
  { value: "font-league-spartan", label: "League Spartan" },
  { value: "font-bungee-inline", label: "Bungee Inline" },
];

/**
 * Props for the TextStylePanel component
 * @interface TextStylePanelProps
 * @property {TextOverlay} localOverlay - The current text overlay object containing styles and content
 * @property {Function} handleInputChange - Callback function to handle changes to overlay text content
 * @property {Function} handleStyleChange - Callback function to handle style changes for the text overlay
 */
interface TextStylePanelProps {
  localOverlay: TextOverlay;
  handleInputChange: (field: keyof TextOverlay, value: string) => void;
  handleStyleChange: (field: keyof TextOverlay["styles"], value: any) => void;
}

/**
 * Panel component for managing text overlay styling options
 * Provides controls for typography settings (font family, alignment) and colors (text color, highlight)
 *
 * @component
 * @param {TextStylePanelProps} props - Component props
 * @returns {JSX.Element} A panel with text styling controls
 */
export const TextStylePanel: React.FC<TextStylePanelProps> = ({
  localOverlay,
  handleStyleChange,
}) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      {/* Typography Settings */}
      <div className="space-y-4 rounded-md dark:bg-darkBox /50 p-4 border">
        <h3 className="text-sm font-medium">{t("textStyle.typography")}</h3>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">{t("textStyle.fontFamily")}</label>
          <Select
            value={localOverlay.styles.fontFamily}
            onValueChange={(value) => handleStyleChange("fontFamily", value)}
          >
            <SelectTrigger className="w-full text-xs">
              <SelectValue placeholder={t("textStyle.selectFont")} />
            </SelectTrigger>
            <SelectContent>
              {fonts.map((font) => (
                <SelectItem
                  key={font.value}
                  value={font.value}
                  className={`${font.value} text-xs`}
                >
                  {font.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">{t("textStyle.alignment")}</label>
            <ToggleGroup
              type="single"
              className="justify-start gap-1"
              value={localOverlay.styles.textAlign}
              onValueChange={(value) => {
                if (value) handleStyleChange("textAlign", value);
              }}
            >
              <ToggleGroupItem
                value="left"
                aria-label={t("textStyle.alignLeft")}
                className="h-10 w-10"
              >
                <AlignLeft className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="center"
                aria-label={t("textStyle.alignCenter")}
                className="h-10 w-10"
              >
                <AlignCenter className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="right"
                aria-label={t("textStyle.alignRight")}
                className="h-10 w-10"
              >
                <AlignRight className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </div>

      {/* Colors */}
      <div className="space-y-4 rounded-md dark:bg-darkBox /50 p-4 border">
        <h3 className="text-sm font-medium">{t("textStyle.colors")}</h3>

        <div className="grid grid-cols-3 gap-4">
          {!localOverlay.styles.WebkitBackgroundClip ? (
            <>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">
                  {t("textStyle.textColor")}
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <div
                      className="h-8 w-8 rounded-md border cursor-pointer"
                      style={{ backgroundColor: localOverlay.styles.color }}
                    />
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[330px] dark:bg-darkBox border border-gray-700"
                    side="right"
                  >
                    <ColorPicker
                      value={localOverlay.styles.color}
                      onChange={(color) => handleStyleChange("color", color)}
                      // hideInputs
                      hideHue
                      hideControls
                      hideColorTypeBtns
                      hideAdvancedSliders
                      hideColorGuide
                      hideInputType
                      height={200}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">
                  {t("textStyle.highlight")}
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <div
                      className="h-8 w-8 rounded-md border cursor-pointer"
                      style={{
                        backgroundColor: localOverlay.styles.backgroundColor,
                      }}
                    />
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[330px] dark:bg-darkBox border border-gray-700"
                    side="right"
                  >
                    <ColorPicker
                      value={localOverlay.styles.backgroundColor}
                      onChange={(color) => {
                        handleStyleChange("backgroundColor", color);
                      }}
                      hideInputs
                      hideHue
                      hideControls
                      hideColorTypeBtns
                      hideAdvancedSliders
                      hideColorGuide
                      hideInputType
                      height={200}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </>
          ) : (
            <div className="col-span-3">
              <p className="text-xs text-muted-foreground">
                {t("textStyle.gradientNote")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
