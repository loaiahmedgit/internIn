/** Supabase's shared transaction pooler is intended for serverless runtimes. */
export function runtimeDatabaseUrl(url: string, vercel: boolean) {
  if (!vercel) return url;
  const parsed = new URL(url);
  if (parsed.hostname.endsWith(".pooler.supabase.com") && parsed.port === "5432") {
    parsed.port = "6543";
    return parsed.toString();
  }
  return url;
}
