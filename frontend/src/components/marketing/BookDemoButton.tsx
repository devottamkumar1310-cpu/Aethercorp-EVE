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
 * The optional assistance path — NOT a conversion path.
 *
 * EVE is product-led. The primary journey is StartFreeTrialButton → Google →
 * demo workspace → upload → first insight; this exists for the visitor who is
 * stuck, or who wants a deeper conversation after trying the product. It
 * therefore defaults to `ghost` and should never be rendered as the highest-
 * emphasis action on a page, or above the fold competing with the trial CTA.
 *
 * Clicks are still tracked (`demo_booking_clicked`, an append-only event name)
 * so we can see how much demand for help the self-serve flow leaves behind.
 */
export function BookDemoButton({
  variant = "ghost",
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
  // someone who is asking for help to a dead URL.
  const configured = Boolean(BOOKING_URL);
  const href = configured
    ? BOOKING_URL
    : `mailto:${POSITIONING.supportEmail}?subject=${encodeURIComponent("Question about EVE")}`;

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
