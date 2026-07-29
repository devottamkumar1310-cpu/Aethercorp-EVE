"use client";

import { CalendarDays } from "lucide-react";
import { BOOKING_URL, BOOKING_CTA, POSITIONING } from "@/lib/config";
import { track } from "@/lib/analytics";

type Variant = "primary" | "secondary" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg",
  secondary:
    "bg-secondary text-secondary-foreground hover:bg-secondary/70 border border-border hover:border-[color:var(--eve-accent)]/40",
  ghost:
    "text-foreground hover:text-[color:var(--eve-accent)] bg-transparent",
};

/**
 * The primary conversion event for founder-led sales. Every click is tracked
 * with attribution so we can tell which outreach channel produces calls.
 */
export function BookDemoButton({
  variant = "primary",
  label = BOOKING_CTA,
  location,
  className = "",
  showIcon = true,
}: {
  variant?: Variant;
  label?: string;
  /** Where on the site the click happened — header, hero, pricing, footer. */
  location: string;
  className?: string;
  showIcon?: boolean;
}) {
  // Without a configured booking link, fall back to email rather than sending
  // the highest-intent click in the funnel to a dead URL.
  const configured = Boolean(BOOKING_URL);
  const href = configured
    ? BOOKING_URL
    : `mailto:${POSITIONING.supportEmail}?subject=${encodeURIComponent("Inventory teardown request")}`;

  return (
    <a
      href={href}
      {...(configured ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      onClick={() => track("demo_booking_clicked", { location })}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-all ${VARIANTS[variant]} ${className}`}
    >
      {showIcon && <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />}
      {label}
    </a>
  );
}
