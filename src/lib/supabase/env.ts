export function supabaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) {
    throw new Error(
      "Falta NEXT_PUBLIC_SUPABASE_URL en .env.local. Revisa tu archivo .env.local."
    );
  }
  return value;
}

export function supabaseAnonKey(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!value) {
    throw new Error(
      "Falta NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.local. Revisa tu archivo .env.local."
    );
  }
  return value;
}
