import React, { useState, useEffect } from "react";
import { FolderOpen, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import Cookies from "js-cookie";
import { formatDistanceToNow } from "date-fns";
import { useTranslation } from "@/lib/i18n";

interface Edit {
  id: string;
  name: string;
  edition_array: string;
  created_at?: string;
}

interface LoadEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoadEdit: (editionData: any) => void;
}

/**
 * Dialog component for loading saved edits from the backend
 */
export const LoadEditDialog: React.FC<LoadEditDialogProps> = ({
  open,
  onOpenChange,
  onLoadEdit,
}) => {
  const [edits, setEdits] = useState<Edit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEditId, setSelectedEditId] = useState<string | null>(null);
  const [editToDelete, setEditToDelete] = useState<Edit | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  // Fetch edits when dialog opens
  useEffect(() => {
    if (open) {
      fetchEdits();
    }
  }, [open]);

  const fetchEdits = async () => {
    setIsLoading(true);
    try {
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

      const data = await response.json();

      if (data.code === 200 && data.edits) {
        setEdits(data.edits);
      } else {
        throw new Error(data.message || t("renderDialog.fetchEditsFailed"));
      }
    } catch (error) {
      console.error("Error fetching edits:", error);
      toast({
        variant: "destructive",
        title: t("common.error"),
        description:
          error instanceof Error
            ? error.message
            : t("renderDialog.fetchEditsFailed"),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadEdit = (edit: Edit) => {
    try {
      // Parse the edition_array JSON string
      const editionData = JSON.parse(edit.edition_array);
      
      // Call the onLoadEdit callback with the parsed data plus edit metadata
      onLoadEdit({
        ...editionData,
        id: edit.id,
        name: edit.name,
        editionData: editionData, // Keep the original data structure
      });
      
      toast({
        title: t("common.success"),
        description: t("renderDialog.loadEditSuccess", { name: edit.name }),
        className:
          "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Error loading edit:", error);
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: t("renderDialog.loadEditFailed"),
      });
    }
  };

  const handleDeleteEdit = async () => {
    if (!editToDelete) return;

    setIsDeleting(true);

    try {
      const token = Cookies.get("token");
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "https://backend.reelmotion.ai";

      const response = await fetch(`${backendUrl}/editor/delete-creation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({
          id: editToDelete.id,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.code === 200) {
        // Remove the deleted edit from the list
        setEdits((prevEdits) => prevEdits.filter((e) => e.id !== editToDelete.id));
        
        toast({
          title: t("common.success"),
          description: t("renderDialog.deleteSuccess", { name: editToDelete.name }),
          className:
            "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
        });

        setEditToDelete(null);
      } else {
        throw new Error(data.message || t("renderDialog.deleteFailed"));
      }
    } catch (error) {
      console.error("Error deleting edit:", error);
      toast({
        variant: "destructive",
        title: t("common.error"),
        description:
          error instanceof Error
            ? error.message
            : t("renderDialog.deleteFailed"),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      {/* Confirmation Dialog for Delete */}
      <AlertDialog open={!!editToDelete} onOpenChange={(open) => !open && setEditToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("renderDialog.deleteEdit")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("renderDialog.deleteConfirm", { name: editToDelete?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEdit}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("renderDialog.deleting")}
                </>
              ) : (
                t("common.delete")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Load Edit Dialog */}
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            {t("renderDialog.loadTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("renderDialog.loadDescriptionShort")}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : edits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FolderOpen className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                {t("renderDialog.noEditsFound")}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {edits.map((edit) => (
                <div
                  key={edit.id}
                  className={`w-full p-3 rounded-lg border transition-all ${
                    selectedEditId === edit.id
                      ? "border-primary bg-accent"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      onClick={() => handleLoadEdit(edit)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <h4 className="text-sm font-medium truncate">
                        {edit.name}
                      </h4>
                      {edit.created_at && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t("renderDialog.createdRelative", {
                            relative: formatDistanceToNow(new Date(edit.created_at), {
                              addSuffix: true,
                            }),
                          })}
                        </p>
                      )}
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleLoadEdit(edit)}
                      >
                        {t("renderDialog.loadEditButton")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditToDelete(edit);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
    </>
  );
};
