"use client";

import { useEffect, useRef } from "react";

import { AdminActionButton, AdminActionButtons } from "./admin-ui";

export function AdminConfirmationDialog({
  open,
  title,
  description,
  confirmLabel = "تأیید",
  cancelLabel = "انصراف",
  danger = false,
  pending = false,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={dialogRef}
      className="admin-confirmation-dialog"
      aria-labelledby="admin-confirmation-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onOpenChange(false);
      }}
      onClose={() => onOpenChange(false)}
    >
      <div className="admin-confirmation-content">
        <span className="admin-dialog-kicker">نیازمند تأیید</span>
        <h2 id="admin-confirmation-title">{title}</h2>
        <p>{description}</p>
        <AdminActionButtons>
          <AdminActionButton
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {cancelLabel}
          </AdminActionButton>
          <AdminActionButton
            tone={danger ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? "در حال انجام…" : confirmLabel}
          </AdminActionButton>
        </AdminActionButtons>
      </div>
    </dialog>
  );
}
