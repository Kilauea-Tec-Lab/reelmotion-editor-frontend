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

interface SaveEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editionData: {
    id: string;
    inputProps: any;
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
        title: "Error",
        description: "Please enter a name for your edit",
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
          ? "Your edit has been updated successfully!" 
          : "Your edit has been saved successfully!";
          
        toast({
          title: "Success",
          description: successMessage,
          className: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
        });
        onOpenChange(false);
      } else {
        throw new Error(data.message || "Failed to save edit");
      }
    } catch (error) {
      console.error("Error saving edit:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save edit. Please try again.",
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
            {editionData.editId ? "Update Edit" : "Save Edit"}
          </DialogTitle>
          <DialogDescription>
            {editionData.editId 
              ? "Update the name or save changes to your edit."
              : "Give your edit a name to save it to your projects."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Edit Name</Label>
            <Input
              id="name"
              placeholder="My awesome video edit"
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
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {editionData.editId ? "Updating..." : "Saving..."}
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {editionData.editId ? "Update Edit" : "Save Edit"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
