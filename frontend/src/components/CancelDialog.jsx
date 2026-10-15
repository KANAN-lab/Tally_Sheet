import { useState } from "react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { api, errMsg } from "@/lib/api";

export default function CancelDialog({ sheet, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const confirm = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/tally-sheets/${sheet.id}/cancel`, { reason });
      toast.success(`Tally sheet ${sheet.doc_no} dibatalkan`);
      setReason("");
      onDone?.();
      onClose();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AlertDialog open={!!sheet} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent data-testid="cancel-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Batalkan Tally Sheet {sheet?.doc_no}?</AlertDialogTitle>
          <AlertDialogDescription>
            Dokumen akan berstatus Cancelled dan tetap tersimpan sebagai histori. Tindakan ini tidak dapat dikembalikan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea placeholder="Alasan pembatalan (opsional)" value={reason} onChange={(e) => setReason(e.target.value)} data-testid="cancel-dialog-reason" />
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="cancel-dialog-back">Kembali</AlertDialogCancel>
          <AlertDialogAction onClick={confirm} disabled={busy} className="bg-rose-600 hover:bg-rose-700" data-testid="cancel-dialog-confirm">
            Ya, Batalkan
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
