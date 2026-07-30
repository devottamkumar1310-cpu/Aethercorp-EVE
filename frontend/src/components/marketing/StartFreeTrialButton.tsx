"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/analytics";

type Variant = "primary" | "secondary";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
  secondary:
    "bg-secondary text-secondary-foreground hover:bg-secondary/70 border border-border hover:border-[color:var(--eve-accent)]/40",
};

/**
 * The primary conversion path for a product-led product.
 *
 * The journey is landing → free trial → Google sign-in → demo workspace →
 * upload CSV → first insight. This button removes the /signup page from that
 * chain: a form asking for a name, an email and a password before the visitor
 * has seen anything is the single biggest drop-off between "interested" and
 * "activated". /signup still exists — the microcopy beside this button links
 * to it for anyone who wants an email + password account.
 *
 * /onboarding is idempotent: it creates the demo workspace for new users and
 * forwards returning users straight to their dashboard.
 */
export function StartFreeTrialButton({
  variant = "primary",
  label = "Start free trial",
  signedInLabel = "Open your workspace",
  location,
  className = "",
}: {
  variant?: Variant;
  label?: string;
  /** Shown once we know the visitor already has a session. */
  signedInLabel?: string;
  /** Where on the site the click happened — hero, bottom CTA, pricing. */
  location: string;
  className?: string;
}) {
  const [signedIn, setSignedIn] = useState(false);
  const [starting, setStarting] = useState(false);
  const router = useRouter();

  // Label only. The authoritative check happens on click, so the button is
  // never disabled while this resolves — a dead primary CTA on first paint
  // costs more than an occasional stale label.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await createClient().auth.getSession();
      if (!cancelled) setSignedIn(Boolean(data.session));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const start = async () => {
    setStarting(true);
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();

    if (data.session) {
      router.push("/onboarding");
      return;
    }

    track("signup_started", { method: "google", source: location });

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/onboarding")}`,
      },
    });

    // Never strand the highest-intent click in the funnel on an error screen.
    if (error) router.push("/signup");
  };

  return (
    <button
      type="button"
      onClick={start}
      disabled={starting}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-all cursor-pointer disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
    >
      {starting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Opening…
        </>
      ) : (
        <>
          {signedIn ? signedInLabel : label}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </>
      )}
    </button>
  );
}
