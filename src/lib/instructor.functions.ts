import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function ensureInstructor(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "instructor" });
  if (!data) {
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden: instructor role required");
  }
}

export const getInstructorDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await ensureInstructor(supabase, userId);
    const { data: courses } = await supabase
      .from("courses")
      .select("id, title, status, price, rating_avg, rating_count, enrollment_count, created_at")
      .eq("instructor_id", userId)
      .order("created_at", { ascending: false });

    const courseIds = (courses ?? []).map((c) => c.id);
    let totalRevenue = 0;
    let totalStudents = 0;
    const monthly: Record<string, number> = {};
    if (courseIds.length > 0) {
      const { data: enrolls } = await supabase
        .from("enrollments").select("amount_paid, enrolled_at, user_id, course_id")
        .in("course_id", courseIds);
      const studs = new Set<string>();
      for (const e of enrolls ?? []) {
        totalRevenue += Number(e.amount_paid ?? 0);
        studs.add(e.user_id);
        const m = new Date(e.enrolled_at).toLocaleString("en-US", { month: "short" });
        monthly[m] = (monthly[m] ?? 0) + Number(e.amount_paid ?? 0);
      }
      totalStudents = studs.size;
    }
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const chart = months.map((m) => ({ month: m, revenue: Math.round(monthly[m] ?? 0) }));
    const ratings = (courses ?? []).filter((c) => c.rating_count > 0);
    const avgRating = ratings.length > 0
      ? ratings.reduce((a, c) => a + Number(c.rating_avg), 0) / ratings.length
      : 0;

    return {
      courses: courses ?? [],
      stats: {
        totalRevenue,
        totalStudents,
        activeCourses: (courses ?? []).filter((c) => c.status === "published").length,
        avgRating: Number(avgRating.toFixed(2)),
      },
      chart,
    };
  });

export const submitCourseForReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ courseId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("courses")
      .update({ status: "pending_review", review_note: null })
      .eq("id", data.courseId)
      .eq("instructor_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const wizardSchema = z.object({
  title: z.string().min(3).max(140),
  subtitle: z.string().max(240).optional(),
  category: z.string().min(2),
  difficulty: z.enum(["Beginner", "Intermediate", "Advanced"]),
  language: z.string().min(2).default("English"),
  description: z.string().max(4000).optional(),
  whatYouLearn: z.array(z.string().max(200)).max(20).default([]),
  requirements: z.array(z.string().max(200)).max(20).default([]),
  price: z.number().min(0).max(9999),
  priceType: z.enum(["free", "one_time", "subscription"]),
  sections: z
    .array(
      z.object({
        title: z.string().min(1).max(140),
        lessons: z
          .array(
            z.object({
              title: z.string().min(1).max(200),
              videoUrl: z.string().max(500).optional(),
              durationMinutes: z.number().min(0).max(600).default(10),
            }),
          )
          .max(50)
          .default([]),
      }),
    )
    .max(30)
    .default([]),
});

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || `course-${Date.now()}`;
}

export const createCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => wizardSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureInstructor(supabase, userId);
    const slug = `${slugify(data.title)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data: profile } = await supabase.from("profiles").select("full_name, avatar_url").eq("id", userId).maybeSingle();
    const { data: course, error } = await supabase
      .from("courses")
      .insert({
        slug,
        title: data.title,
        subtitle: data.subtitle ?? null,
        description: data.description ?? null,
        category: data.category,
        difficulty: data.difficulty,
        language: data.language,
        price: data.priceType === "free" ? 0 : data.price,
        price_type: data.priceType,
        status: "pending_review",
        instructor_id: userId,
        instructor_name: profile?.full_name ?? "Instructor",
        instructor_avatar_url: profile?.avatar_url ?? null,
        what_you_learn: data.whatYouLearn,
        requirements: data.requirements,
        thumbnail_gradient: "from-blue-900 to-purple-700",
      })
      .select("id, slug")
      .single();
    if (error) throw new Error(error.message);

    for (let i = 0; i < data.sections.length; i++) {
      const s = data.sections[i];
      const { data: section } = await supabase
        .from("sections")
        .insert({ course_id: course.id, title: s.title, position: i })
        .select("id")
        .single();
      if (section && s.lessons.length > 0) {
        await supabase.from("lessons").insert(
          s.lessons.map((l, j) => ({
            section_id: section.id,
            title: l.title,
            video_url: l.videoUrl ?? null,
            duration_minutes: l.durationMinutes,
            position: j,
            is_preview: j === 0,
          })),
        );
      }
    }
    return { id: course.id, slug: course.slug };
  });
