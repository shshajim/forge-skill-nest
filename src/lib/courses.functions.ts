import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export const listPublishedCourses = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data, error } = await sb
    .from("courses")
    .select(
      "id, slug, title, subtitle, category, difficulty, price, price_type, duration_text, thumbnail_gradient, instructor_name, instructor_avatar_url, rating_avg, rating_count, enrollment_count, created_at",
    )
    .eq("status", "published")
    .order("enrollment_count", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getCourseBySlug = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: course, error } = await sb
      .from("courses")
      .select("*")
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!course) return null;
    const { data: sections } = await sb
      .from("sections")
      .select("id, title, position, lessons:lessons(id, title, duration_minutes, position, is_preview, video_url)")
      .eq("course_id", course.id)
      .order("position", { ascending: true });
    const { data: reviewRows } = await sb
      .from("reviews")
      .select("id, rating, body, created_at, user_id")
      .eq("course_id", course.id)
      .order("created_at", { ascending: false })
      .limit(10);
    let reviews: Array<{ id: string; rating: number; body: string | null; created_at: string; user_id: string; profiles: { full_name: string | null; avatar_url: string | null } | null }> = [];
    if (reviewRows && reviewRows.length > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const userIds = Array.from(new Set(reviewRows.map((r) => r.user_id)));
      const { data: authors } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);
      const byId = new Map((authors ?? []).map((a) => [a.id, a]));
      reviews = reviewRows.map((r) => ({
        ...r,
        profiles: byId.get(r.user_id) ? { full_name: byId.get(r.user_id)!.full_name, avatar_url: byId.get(r.user_id)!.avatar_url } : null,
      }));
    }
    return { course, sections: sections ?? [], reviews };
  });

