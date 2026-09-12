"use client";

import { useState, type ReactNode } from "react";

/**
 * The "add product" panel.
 *
 * This used to be a `<details>` element with a separate toolbar link pointing
 * at its anchor. The link scrolled to the panel but never opened it, so the
 * primary action of the products page did nothing on a real page. One piece of
 * state now owns both the button and the panel, so they cannot disagree.
 */
export function AdminCreatePanel({
  label,
  openLabel,
  defaultOpen = false,
  children,
}: {
  label: string;
  openLabel: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="admin-create-panel" id="new-product" data-open={open}>
      <button
        type="button"
        className="admin-action-button"
        data-tone="primary"
        aria-expanded={open}
        aria-controls="new-product-form"
        onClick={() => setOpen((current) => !current)}
      >
        {open ? openLabel : label}
      </button>
      <div id="new-product-form" hidden={!open}>
        {children}
      </div>
    </section>
  );
}
