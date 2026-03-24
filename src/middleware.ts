import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname === "/login";
  const isApiRoute = pathname.startsWith("/api");
  const isAdminRoute = pathname.startsWith("/admin");
  const isPublicAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/logo.png") ||
    pathname === "/favicon.ico";

  if (isPublicAsset || isApiRoute) return supabaseResponse;

  // Unauthenticated → login
  if (!user && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Already logged in → away from login
  if (user && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Admin routes require admin role
  if (user && isAdminRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png).*)"],
};
