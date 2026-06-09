import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (typeof window !== "undefined") {
    console.log("Supabase URL Exists:", !!url);
    console.log("Supabase Anon Key Exists:", !!key);
    if (key) {
      console.log(`Anon Key Starts With: ${key.substring(0, 10)}... (Length: ${key.length})`);
    }
  }

  return createBrowserClient(url!, key!);
}
