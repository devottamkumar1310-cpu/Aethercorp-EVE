"use client";

import type { Session } from "@supabase/supabase-js";
import { identify, trackOncePerSession } from "@/lib/analytics";

/**
 * Auth funnel events for the OAuth path.
 *
 * A first-ever sign-in and a returning sign-in arrive through the identical
 * Supabase callback, so Google users produced neither signup_completed nor
 * login_completed — the two events the acquisition funnel is built on — while
 * Google is the primary way into the product.
 *
 * The two are told apart by the account's own timestamps rather than anything
 * stored on the device: a founder who signs up on a laptop and later signs in
 * on their phone must still count as returning. Supabase writes created_at and
 * last_sign_in_at in the same transaction when an account is provisioned, so
 * the gap is ~0 on the first sign-in and is the age of the account on every one
 * after it.
 */
const FIRST_SIGN_IN_WINDOW_MS = 60_000;

export function isFirstSignIn(session: Session): boolean {
  const user = session.user;
  const created = Date.parse(user?.created_at ?? "");
  const lastSignIn = Date.parse(user?.last_sign_in_at ?? user?.created_at ?? "");
  // Unparseable timestamps fall back to "returning": over-counting signups
  // would inflate the top of the funnel and quietly flatter the conversion rate.
  if (Number.isNaN(created) || Number.isNaN(lastSignIn)) return false;
  return lastSignIn - created < FIRST_SIGN_IN_WINDOW_MS;
}

export function authMethod(session: Session): string {
  const provider = session.user?.app_metadata?.provider;
  return typeof provider === "string" && provider ? provider : "email";
}

/**
 * Emits exactly one of signup_completed / login_completed for this sign-in, and
 * attaches the stable identity first so both land on an identified person.
 *
 * Guarded per tab session and keyed by user id, so a refresh of the landing
 * page — which founders do — cannot add a second signup to the funnel.
 */
export function trackAuthCompletion(session: Session | null | undefined): void {
  const userId = session?.user?.id;
  if (!session || !userId) return;

  identify(userId);
  const method = authMethod(session);

  if (isFirstSignIn(session)) {
    trackOncePerSession("signup_completed", userId, {
      method,
      requires_verification: false,
    });
  } else {
    trackOncePerSession("login_completed", userId, { method });
  }
}
