"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, Building2, Loader2, Trash2 } from "lucide-react";

export type DemoImportChoice = "create_workspace" | "replace_demo";

/**
 * Shown when a merchant tries to import a real catalogue into a workspace that
 * still holds seeded demo data.
 *
 * Importing would upsert their SKUs alongside the demo brand's, producing an
 * inventory valuation, dead-stock total and revenue-at-risk figure that are
 * part real and part fiction — with nothing on screen to say which is which.
 * That is worse than either dataset alone, so the merge is never the default:
 * both offered paths end with the merchant's data standing on its own.
 */
export function DemoImportGuardDialog({
  open,
  fileName,
  demoWorkspaceName,
  busy,
  error,
  onChoose,
  onCancel,
}: {
  open: boolean;
  fileName: string | null;
  demoWorkspaceName: string;
  /** Which action is mid-flight, so the dialog can show progress in place. */
  busy: DemoImportChoice | null;
  error: string | null;
  onChoose: (choice: DemoImportChoice, brandName: string) => void;
  onCancel: () => void;
}) {
  const [brandName, setBrandName] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) firstFieldRef.current?.focus();
  }, [open]);

  // Escape cancels — but never mid-request, which would strand a running
  // import with no UI attached to it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const trimmedBrand = brandName.trim();
  const anyBusy = busy !== null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-import-title"
      aria-describedby="demo-import-desc"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl p-6 sm:p-7 space-y-5 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <AlertTriangle size={20} aria-hidden />
          </div>
          <div className="space-y-1.5">
            <h2 id="demo-import-title" className="text-lg font-extrabold tracking-tight text-foreground">
              You&apos;re exploring a demo workspace
            </h2>
            <p id="demo-import-desc" className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">{demoWorkspaceName}</strong> is sample data we
              created so you could look around. Importing
              {fileName ? <> <strong className="text-foreground">{fileName}</strong></> : " your file"}{" "}
              here would mix your real products in with it, and every number —
              inventory value, dead stock, revenue at risk — would be part yours and
              part ours.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs rounded-xl flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
            <span>{error}</span>
          </div>
        )}

        {/* Recommended path */}
        <div className="rounded-xl border border-[color:var(--eve-accent)]/40 bg-[color:var(--eve-accent)]/[0.04] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Building2 size={15} className="text-[color:var(--eve-accent)]" aria-hidden />
            <span className="text-xs font-bold text-foreground">Create a workspace for my brand</span>
            <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-[color:var(--eve-accent)]">
              Recommended
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your catalogue gets its own clean workspace. The demo stays where it is, so
            you can still refer back to it.
          </p>
          <div>
            <label htmlFor="demo-import-brand" className="block text-xs font-semibold text-foreground mb-1.5">
              Brand name
            </label>
            <input
              ref={firstFieldRef}
              id="demo-import-brand"
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              disabled={anyBusy}
              placeholder="Acme Studios"
              className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[color:var(--eve-accent)]/20 focus:border-[color:var(--eve-accent)] transition-all disabled:opacity-60"
            />
          </div>
          <button
            type="button"
            onClick={() => onChoose("create_workspace", trimmedBrand)}
            disabled={anyBusy || !trimmedBrand}
            className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy === "create_workspace" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Creating workspace and importing…
              </>
            ) : (
              <>
                Create my workspace and import
                <ArrowRight size={14} aria-hidden />
              </>
            )}
          </button>
        </div>

        {/* Destructive path */}
        <div className="rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Trash2 size={15} className="text-muted-foreground" aria-hidden />
            <span className="text-xs font-bold text-foreground">Replace the demo data</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Clears <strong className="text-foreground">{demoWorkspaceName}</strong> completely —
            sample products, sales history and recommendations — then imports your file
            into it. This workspace becomes yours. The demo data cannot be recovered.
          </p>
          <button
            type="button"
            onClick={() => onChoose("replace_demo", trimmedBrand)}
            disabled={anyBusy}
            className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-secondary text-secondary-foreground hover:bg-secondary/70 border border-border transition-all cursor-pointer disabled:opacity-50"
          >
            {busy === "replace_demo" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Replacing demo data…
              </>
            ) : (
              "Replace demo data with my import"
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={onCancel}
          disabled={anyBusy}
          className="w-full min-h-[44px] py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
