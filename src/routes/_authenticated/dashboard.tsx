import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Suspense } from "react";
import { Award, BookOpen, Clock, Flame, PlayCircle, Heart, Download } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getMyDashboard, toggleWishlist } from "@/lib/learner.functions";
import { CourseCard } from "@/components/CourseCard";
import { downloadCertificatePDF } from "@/lib/certificate-pdf";
import { toast } from "sonner";

const dashQ = queryOptions({ queryKey: ["dashboard"], queryFn: () => getMyDashboard() });

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — LearnForge" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
        <Suspense fallback={<div className="h-48 bg-muted/40 rounded-xl animate-pulse" />}>
          <Body />
        </Suspense>
      </div>
    </SiteLayout>
  );
}

function Body() {
  const { data } = useSuspenseQuery(dashQ);
  const qc = useQueryClient();
  const removeWish = useServerFn(toggleWishlist);

  const totalLessonsCompleted = Object.values(data.progressByCourse).reduce((a, p) => a + p.completed, 0);
  const hoursLearned = Math.round((totalLessonsCompleted * 15) / 60);
  const certCount = data.certificates.length;
  const streak = Math.min(7, data.enrollments.length + 1);

  return (
    <>
      <h1 className="text-3xl sm:text-4xl font-bold">Welcome back, {data.profile?.full_name?.split(" ")[0] ?? "learner"}!</h1>
      <p className="text-muted-foreground mt-1">Keep the momentum going.</p>

      <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={<BookOpen className="size-5" />} label="Courses enrolled" value={data.enrollments.length} />
        <Stat icon={<Clock className="size-5" />} label="Hours learned" value={hoursLearned} />
        <Stat icon={<Award className="size-5" />} label="Certificates" value={certCount} />
        <Stat icon={<Flame className="size-5" />} label="Day streak" value={streak} />
      </div>

      <section className="mt-12">
        <h2 className="text-xl font-bold mb-4">My courses</h2>
        {data.enrollments.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="size-10" />}
            title="No enrollments yet"
            description="Browse the catalog and enroll in your first course."
            action={<Button asChild><Link to="/courses">Browse courses</Link></Button>}
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.enrollments.map((e) => {
              const c = e.course!;
              const p = data.progressByCourse[c.id] ?? { completed: 0, total: 0, firstLessonId: null };
              const pct = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
              return (
                <div key={e.id} className="rounded-xl border bg-card overflow-hidden card-hover">
                  <div className={`aspect-video bg-gradient-to-br ${c.thumbnail_gradient ?? "from-blue-900 to-purple-700"}`} />
                  <div className="p-5 space-y-3">
                    <Badge className="bg-secondary text-secondary-foreground border-0">{c.category}</Badge>
                    <h3 className="font-semibold leading-snug line-clamp-2">{c.title}</h3>
                    <p className="text-xs text-muted-foreground">By {c.instructor_name}</p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{p.completed} / {p.total} lessons</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    {p.firstLessonId ? (
                      <Button asChild size="sm" className="w-full">
                        <Link to="/learn/$courseId/$lessonId" params={{ courseId: c.id, lessonId: p.firstLessonId }}>
                          <PlayCircle className="size-4" /> {pct > 0 ? "Continue" : "Start"}
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Award className="size-5 text-gold" /> Certificates</h2>
        {data.certificates.length === 0 ? (
          <EmptyState
            icon={<Award className="size-10" />}
            title="No certificates yet"
            description="Finish 100% of a course to unlock a downloadable certificate."
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.certificates.map((cert) => (
              <div key={cert.id} className="rounded-xl border bg-gradient-to-br from-gold/10 to-primary/10 p-5 space-y-3">
                <Award className="size-8 text-gold" />
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Certificate of Completion</div>
                  <div className="font-semibold mt-1 line-clamp-2">{cert.course?.title}</div>
                </div>
                <div className="text-xs text-muted-foreground">Issued {new Date(cert.issued_at).toLocaleDateString()}</div>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() =>
                    downloadCertificatePDF({
                      studentName: data.profile?.full_name ?? data.profile?.email ?? "LearnForge Student",
                      courseTitle: cert.course?.title ?? "",
                      instructorName: cert.course?.instructor_name ?? "LearnForge Instructor",
                      issuedAt: cert.issued_at,
                      certificateId: cert.id,
                    })
                  }
                >
                  <Download className="size-4" /> Download Certificate
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Heart className="size-5 text-destructive" /> Wishlist</h2>
        {data.wishlist.length === 0 ? (
          <EmptyState icon={<Heart className="size-10" />} title="Wishlist is empty" description="Tap the heart on any course to save it here." />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.wishlist.map((c) => (
              <div key={c!.id} className="relative">
                <CourseCard course={c as any} />
                <button
                  onClick={async () => {
                    await removeWish({ data: { courseId: c!.id, add: false } });
                    toast.success("Removed from wishlist");
                    qc.invalidateQueries({ queryKey: ["dashboard"] });
                  }}
                  className="absolute top-3 right-3 size-9 rounded-full bg-black/50 backdrop-blur-sm grid place-items-center hover:bg-destructive text-white cursor-pointer"
                  aria-label="Remove from wishlist"
                >
                  <Heart className="size-4 fill-current" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-lg bg-primary/15 text-primary grid place-items-center">{icon}</div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed py-12 text-center px-4">
      <div className="mx-auto size-14 rounded-full bg-muted grid place-items-center text-muted-foreground mb-3">{icon}</div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
