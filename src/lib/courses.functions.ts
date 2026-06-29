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
    const { data: reviews } = await sb
      .from("reviews")
      .select("id, rating, body, created_at, user_id, profiles:profiles(full_name, avatar_url)")
      .eq("course_id", course.id)
      .order("created_at", { ascending: false })
      .limit(10);
    return { course, sections: sections ?? [], reviews: reviews ?? [] };
  });
