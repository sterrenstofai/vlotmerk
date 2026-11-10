import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Relatieve Location: achter Netlify wijst request.url naar het branch-adres, terwijl de cookie op het bezochte adres staat.
const redirectTo = (path: string) => new NextResponse(null, { status: 307, headers: { Location: path } });

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";
  const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return redirectTo(safe);
  }
  const failed = url.searchParams.get("error_code");
  return redirectTo(`/login?error=${failed ? encodeURIComponent(failed) : "1"}`);
}
