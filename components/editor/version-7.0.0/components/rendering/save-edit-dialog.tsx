import React, { useState, useEffect } from "react";
import { Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import Cookies from "js-cookie";
import { useTranslation } from "@/lib/i18n";

interface SaveEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editionData: {
    id: string;
    inputProps: any;
    aspectRatio?: string;
    editId?: string | null;
    editName?: string | null;
  };
}

/**
 * Dialog component for saving an edit with a custom name
 */
export const SaveEditDialog: React.FC<SaveEditDialogProps> = ({
  open,
  onOpenChange,
  editionData,
}) => {
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  // Load the edit name when dialog opens if editing an existing edit
  useEffect(() => {
    if (open && editionData.editName) {
      setName(editionData.editName);
    }
  }, [open, editionData.editName]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: t("renderDialog.nameRequired"),
      });
      return;
    }

    setIsSaving(true);

    try {
      const token = Cookies.get("token");
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "https://backend.reelmotion.ai";

      // Prepare the request body
      const requestBody: any = {
        name: name.trim(),
        edition_array: JSON.stringify({
          id: editionData.id,
          inputProps: editionData.inputProps,
          aspectRatio: editionData.aspectRatio,
        }),
      };

      // Include edit_id if we're updating an existing edit
      if (editionData.editId) {
        requestBody.edit_id = editionData.editId;
      }

      const response = await fetch(`${backendUrl}/editor/save-edit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.code === 200) {
        const successMessage = editionData.editId
          ? t("renderDialog.updateSuccess")
          : t("renderDialog.saveSuccess");

        toast({
          title: t("common.success"),
          description: successMessage,
          className: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
        });
        onOpenChange(false);
      } else {
        throw new Error(data.message || t("renderDialog.saveFailed"));
      }
    } catch (error) {
      console.error("Error saving edit:", error);
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: error instanceof Error ? error.message : t("renderDialog.saveFailed"),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="w-5 h-5" />
            {editionData.editId ? t("renderDialog.updateTitle") : t("renderDialog.saveTitle")}
          </DialogTitle>
          <DialogDescription>
            {editionData.editId
              ? t("renderDialog.updateDescription")
              : t("renderDialog.saveDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">{t("renderDialog.editNameLabel")}</Label>
            <Input
              id="name"
              placeholder={t("renderDialog.namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isSaving) {
                  handleSave();
                }
              }}
              disabled={isSaving}
              className="bg-white dark:bg-darkBoxSub  border-gray-200 dark:border-white/5"
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {editionData.editId ? t("renderDialog.updating") : t("renderDialog.saving")}
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {editionData.editId ? t("renderDialog.updateTitle") : t("renderDialog.saveTitle")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
