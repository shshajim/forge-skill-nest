import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const claimAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) {
      const { data: mine } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (mine) return { ok: true, alreadyAdmin: true };
      throw new Error("An admin already exists. Ask them to promote you.");
    }
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "admin" });
    if (error) throw new Error(error.message);
    return { ok: true, alreadyAdmin: false };
  });

export const promoteToInstructor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: "instructor" });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });


async function ensureAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden: admin role required");
}

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    const [{ data: pending }, { data: enrolls }, { data: publishedCourses }, { data: roles }, { data: users }] = await Promise.all([
      supabase
        .from("courses")
        .select("id, title, instructor_name, price, created_at, status, review_note")
        .eq("status", "pending_review")
        .order("created_at", { ascending: false }),
      supabase.from("enrollments").select("amount_paid, user_id"),
      supabase.from("courses").select("id", { count: "exact" }).eq("status", "published"),
      supabase.from("user_roles").select("role, user_id"),
      supabase.from("profiles").select("id, full_name, email, avatar_url, is_banned, created_at"),
    ]);

    const totalRevenue = (enrolls ?? []).reduce((a, e) => a + Number(e.amount_paid ?? 0), 0);
    const studentSet = new Set<string>();
    const instructorSet = new Set<string>();
    for (const r of roles ?? []) {
      if (r.role === "student") studentSet.add(r.user_id);
      if (r.role === "instructor") instructorSet.add(r.user_id);
    }

    const userRolesMap: Record<string, string[]> = {};
    for (const r of roles ?? []) (userRolesMap[r.user_id] ??= []).push(r.role);

    const enrollmentCount: Record<string, number> = {};
    for (const e of enrolls ?? []) enrollmentCount[e.user_id] = (enrollmentCount[e.user_id] ?? 0) + 1;

    const userRows = (users ?? []).map((u) => ({
      id: u.id,
      full_name: u.full_name,
      email: u.email,
      avatar_url: u.avatar_url,
      is_banned: u.is_banned,
      created_at: u.created_at,
      roles: userRolesMap[u.id] ?? ["student"],
      enrollments: enrollmentCount[u.id] ?? 0,
    }));

    return {
      stats: {
        totalRevenue,
        totalStudents: studentSet.size,
        totalCourses: publishedCourses?.length ?? 0,
        totalInstructors: instructorSet.size,
      },
      pending: pending ?? [],
      users: userRows,
    };
  });

export const reviewCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        courseId: z.string().uuid(),
        action: z.enum(["approve", "reject"]),
        note: z.string().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const update =
      data.action === "approve"
        ? { status: "published" as const, reviewed_by: userId, reviewed_at: new Date().toISOString(), review_note: null }
        : {
            status: "rejected" as const,
            reviewed_by: userId,
            reviewed_at: new Date().toISOString(),
            review_note: data.note ?? "Rejected by admin",
          };
    const { error } = await supabase.from("courses").update(update).eq("id", data.courseId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserBanned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid(), banned: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { error } = await supabase.from("profiles").update({ is_banned: data.banned }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
