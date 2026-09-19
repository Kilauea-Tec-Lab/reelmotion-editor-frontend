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
import { Coins } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

const BUY_TOKENS_URL = "https://reelmotion.ai/buy-tokens";

interface InsufficientTokensModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InsufficientTokensModal({ open, onOpenChange }: InsufficientTokensModalProps) {
  const { t } = useTranslation();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-yellow-500" />
            {t("tokens.insufficient.title")}
          </AlertDialogTitle>
          <AlertDialogDescription>{t("tokens.insufficient.description")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={() => window.open(BUY_TOKENS_URL, "_blank")}>{t("tokens.insufficient.buy")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
