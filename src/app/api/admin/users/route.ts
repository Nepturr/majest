import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

function generateTempPassword(): string {
  const upper = "ABCDEFGHJKMNPQRSTWXYZ";
  const lower = "abcdefghjkmnpqrstwxyz";
  const digits = "23456789";
  const symbols = "!@#$";
  const all = upper + lower + digits + symbols;
  const rand = (charset: string) => charset[Math.floor(Math.random() * charset.length)];
  const core = Array.from({ length: 8 }, () => rand(all)).join("");
  return rand(upper) + rand(lower) + rand(digits) + rand(symbols) + core;
}

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return profile?.role === "admin" ? user : null;
}

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data });
}

export async function POST(req: NextRequest) {
  const adminUser = await verifyAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email, full_name, role, allowed_pages, assigned_instagram_account_ids } = await req.json();

  if (!email || !role) {
    return NextResponse.json({ error: "Email and role are required." }, { status: 400 });
  }

  const tempPassword = generateTempPassword();
  const adminClient = createAdminClient();

  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  const { error: profileError } = await adminClient.from("profiles").insert({
    id: authData.user.id,
    email,
    full_name: full_name || null,
    role,
    allowed_pages: role === "admin" ? [] : (allowed_pages ?? []),
    assigned_instagram_account_ids: role === "admin" ? [] : (assigned_instagram_account_ids ?? []),
  });

  if (profileError) {
    await adminClient.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ user: authData.user, temp_password: tempPassword });
}
