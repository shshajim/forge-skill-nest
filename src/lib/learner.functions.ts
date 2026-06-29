import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const enrollFree = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ courseId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: course, error: cErr } = await supabase
      .from("courses").select("id, price, status").eq("id", data.courseId).maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!course || course.status !== "published") throw new Error("Course not available");
    if (Number(course.price) > 0) throw new Error("This course requires payment");
    const { error } = await supabase
      .from("enrollments")
      .insert({ user_id: userId, course_id: data.courseId, amount_paid: 0 });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

export const getMyDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("full_name, email, avatar_url").eq("id", userId).maybeSingle();
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("id, enrolled_at, course:courses(id, slug, title, subtitle, thumbnail_gradient, instructor_name, category, duration_text, price, price_type)")
      .eq("user_id", userId)
      .order("enrolled_at", { ascending: false });

    const courseIds = (enrollments ?? []).map((e) => e.course?.id).filter(Boolean) as string[];

    let progressByCourse: Record<string, { completed: number; total: number; firstLessonId: string | null }> = {};
    if (courseIds.length > 0) {
      const { data: lessons } = await supabase
        .from("lessons")
        .select("id, section:sections!inner(course_id, position), position")
        .in("section.course_id", courseIds);
      const totalByCourse: Record<string, number> = {};
      const firstLessonByCourse: Record<string, string> = {};
      const allLessonIdsByCourse: Record<string, string[]> = {};
      for (const l of lessons ?? []) {
        const cid = (l as any).section.course_id as string;
        totalByCourse[cid] = (totalByCourse[cid] ?? 0) + 1;
        (allLessonIdsByCourse[cid] ??= []).push(l.id);
        if (!firstLessonByCourse[cid]) firstLessonByCourse[cid] = l.id;
      }
      const { data: prog } = await supabase
        .from("lesson_progress")
        .select("lesson_id, course_id, completed")
        .eq("user_id", userId)
        .in("course_id", courseIds)
        .eq("completed", true);
      const completedByCourse: Record<string, number> = {};
      for (const p of prog ?? []) completedByCourse[p.course_id] = (completedByCourse[p.course_id] ?? 0) + 1;
      for (const cid of courseIds) {
        progressByCourse[cid] = {
          completed: completedByCourse[cid] ?? 0,
          total: totalByCourse[cid] ?? 0,
          firstLessonId: firstLessonByCourse[cid] ?? null,
        };
      }
    }

    const { data: wishlist } = await supabase
      .from("wishlist")
      .select("course:courses(id, slug, title, thumbnail_gradient, instructor_name, category, price, price_type, rating_avg, rating_count, enrollment_count, duration_text, difficulty, subtitle, instructor_avatar_url)")
      .eq("user_id", userId);

    const { data: certificates } = await supabase
      .from("certificates")
      .select("id, issued_at, course:courses(id, title, instructor_name, duration_text)")
      .eq("user_id", userId)
      .order("issued_at", { ascending: false });

    return {
      profile,
      enrollments: enrollments ?? [],
      progressByCourse,
      wishlist: (wishlist ?? []).map((w) => w.course).filter(Boolean),
      certificates: certificates ?? [],
    };
  });

export const toggleWishlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ courseId: z.string().uuid(), add: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.add) {
      await supabase.from("wishlist").upsert({ user_id: userId, course_id: data.courseId });
    } else {
      await supabase.from("wishlist").delete().eq("user_id", userId).eq("course_id", data.courseId);
    }
    return { ok: true };
  });

export const getCoursePlayerData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ courseId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: enrollment } = await supabase
      .from("enrollments").select("id").eq("user_id", userId).eq("course_id", data.courseId).maybeSingle();
    if (!enrollment) throw new Error("You are not enrolled in this course");
    const { data: course } = await supabase.from("courses").select("id, title, slug").eq("id", data.courseId).maybeSingle();
    const { data: sections } = await supabase
      .from("sections")
      .select("id, title, position, lessons:lessons(id, title, video_url, duration_minutes, position, is_preview)")
      .eq("course_id", data.courseId)
      .order("position", { ascending: true });
    const { data: progress } = await supabase
      .from("lesson_progress").select("lesson_id, completed").eq("user_id", userId).eq("course_id", data.courseId);
    const completed = new Set((progress ?? []).filter((p) => p.completed).map((p) => p.lesson_id));
    return { course, sections: sections ?? [], completedLessonIds: Array.from(completed) };
  });

export const setLessonComplete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ courseId: z.string().uuid(), lessonId: z.string().uuid(), completed: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: enrollment } = await supabase
      .from("enrollments").select("id").eq("user_id", userId).eq("course_id", data.courseId).maybeSingle();
    if (!enrollment) throw new Error("Not enrolled");
    const { error } = await supabase
      .from("lesson_progress")
      .upsert(
        {
          user_id: userId,
          course_id: data.courseId,
          lesson_id: data.lessonId,
          completed: data.completed,
          completed_at: data.completed ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,lesson_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
