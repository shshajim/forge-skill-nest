import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { Star, Users, Clock, Check, Award, Heart, PlayCircle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SiteLayout } from "@/components/SiteLayout";
import { getCourseBySlug } from "@/lib/courses.functions";
import { formatPrice, formatCount } from "@/lib/format";

const courseQ = (slug: string) =>
  queryOptions({ queryKey: ["course", slug], queryFn: () => getCourseBySlug({ data: { slug } }) });

export const Route = createFileRoute("/courses/$slug")({
  head: ({ loaderData }) => ({
    meta: loaderData?.course
      ? [
          { title: `${loaderData.course.title} — LearnForge` },
          { name: "description", content: loaderData.course.subtitle ?? loaderData.course.description ?? "" },
          { property: "og:title", content: loaderData.course.title },
          { property: "og:description", content: loaderData.course.subtitle ?? "" },
        ]
      : [{ title: "Course — LearnForge" }],
  }),
  loader: async ({ params, context }) => {
    const data = await context.queryClient.ensureQueryData(courseQ(params.slug));
    if (!data) throw notFound();
    return data;
  },
  notFoundComponent: () => (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-4xl font-bold">Course not found</h1>
        <p className="text-muted-foreground mt-2">Try browsing all courses.</p>
        <Button asChild className="mt-6"><Link to="/courses">All courses</Link></Button>
      </div>
    </SiteLayout>
  ),
  errorComponent: ({ error }) => (
    <SiteLayout><div className="mx-auto max-w-3xl px-4 py-24 text-center"><p className="text-destructive">{String(error.message)}</p></div></SiteLayout>
  ),
  component: CourseDetail,
});

function CourseDetail() {
  return (
    <SiteLayout>
      <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-12 animate-pulse"><div className="h-80 bg-muted rounded-xl" /></div>}>
        <Body />
      </Suspense>
    </SiteLayout>
  );
}

function Body() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(courseQ(slug));
  if (!data) return null;
  const { course, sections } = data;
  const totalLessons = sections.reduce((a, s) => a + (s.lessons?.length ?? 0), 0);
  const firstLesson = sections[0]?.lessons?.[0];

  return (
    <>
      <div className={`bg-gradient-to-br ${course.thumbnail_gradient ?? "from-blue-900 to-purple-700"} pt-12 pb-32`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 text-white">
          <div className="max-w-3xl">
            <Badge className="bg-white/15 text-white border-0 backdrop-blur-sm">{course.category}</Badge>
            <h1 className="mt-4 text-3xl sm:text-5xl font-bold leading-tight">{course.title}</h1>
            <p className="mt-3 text-lg text-white/90">{course.subtitle}</p>
            <div className="mt-5 flex flex-wrap items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-warning">
                <Star className="size-4 fill-current" />
                <span className="font-semibold text-white">{Number(course.rating_avg).toFixed(1)}</span>
                <span className="text-white/80">({formatCount(course.rating_count)} reviews)</span>
              </span>
              <span className="flex items-center gap-1.5"><Users className="size-4" /> {formatCount(course.enrollment_count)} students</span>
              <span className="flex items-center gap-1.5"><Clock className="size-4" /> {course.duration_text}</span>
              <span>· {course.language}</span>
              <span>· {course.difficulty}</span>
            </div>
            <p className="mt-4 text-white/80 text-sm">Taught by <span className="font-semibold text-white">{course.instructor_name}</span></p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 -mt-24 grid lg:grid-cols-[1fr_360px] gap-8">
        <div className="space-y-10 order-2 lg:order-1">
          <Section title="What you'll learn">
            <div className="grid sm:grid-cols-2 gap-3">
              {((course.what_you_learn ?? []) as string[]).map((w) => (
                <div key={w} className="flex gap-2 text-sm"><Check className="size-4 text-success shrink-0 mt-0.5" /><span>{w}</span></div>
              ))}
            </div>
          </Section>

          <Section title={`Course curriculum · ${sections.length} sections · ${totalLessons} lessons`}>
            <Accordion type="multiple" defaultValue={sections.slice(0, 1).map((s) => s.id)} className="rounded-xl border bg-card">
              {sections.map((s) => (
                <AccordionItem key={s.id} value={s.id} className="px-4">
                  <AccordionTrigger className="text-left">
                    <span className="font-semibold">{s.title}</span>
                    <span className="text-xs text-muted-foreground ml-auto pr-4">{s.lessons?.length ?? 0} lessons</span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-2">
                      {(s.lessons ?? []).map((l) => (
                        <li key={l.id} className="flex items-center gap-3 text-sm py-1.5">
                          {l.is_preview ? <PlayCircle className="size-4 text-primary" /> : <Lock className="size-4 text-muted-foreground" />}
                          <span className="flex-1">{l.title}</span>
                          <span className="text-xs text-muted-foreground">{l.duration_minutes} min</span>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Section>

          {(course.requirements as string[])?.length > 0 && (
            <Section title="Requirements">
              <ul className="list-disc list-inside space-y-1 text-sm">
                {(course.requirements as string[]).map((r) => <li key={r}>{r}</li>)}
              </ul>
            </Section>
          )}

          <Section title="About the instructor">
            <div className="rounded-xl border bg-card p-6 flex items-start gap-4">
              <div className="size-16 rounded-full bg-gradient-to-br from-primary to-purple-500 grid place-items-center text-xl font-bold text-white shrink-0">
                {course.instructor_name.slice(0, 1)}
              </div>
              <div>
                <div className="font-semibold">{course.instructor_name}</div>
                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3">
                  <span className="flex items-center gap-1"><Star className="size-3 text-warning fill-current" /> {Number(course.rating_avg).toFixed(1)} instructor rating</span>
                  <span>· {formatCount(course.enrollment_count)} students</span>
                </div>
                <p className="text-sm mt-3 text-muted-foreground">{course.instructor_bio}</p>
              </div>
            </div>
          </Section>
        </div>

        <aside className="order-1 lg:order-2">
          <div className="lg:sticky lg:top-24 rounded-2xl border bg-card overflow-hidden shadow-card">
            <div className={`aspect-video bg-gradient-to-br ${course.thumbnail_gradient ?? "from-blue-900 to-purple-700"} grid place-items-center`}>
              <PlayCircle className="size-14 text-white/90" />
            </div>
            <div className="p-6 space-y-4">
              <div className="text-3xl font-bold text-primary">{formatPrice(Number(course.price), course.price_type)}</div>
              {Number(course.price) > 0 ? (
                <Button asChild className="w-full" size="lg">
                  <Link to="/checkout/$courseId" params={{ courseId: course.id }}>Enroll Now</Link>
                </Button>
              ) : (
                <Button asChild className="w-full" size="lg">
                  <Link to="/checkout/$courseId" params={{ courseId: course.id }}>Enroll Free</Link>
                </Button>
              )}
              <Button variant="outline" className="w-full"><Heart className="size-4" /> Add to wishlist</Button>
              {firstLesson && (
                <p className="text-xs text-muted-foreground text-center">
                  Preview the first lesson before enrolling
                </p>
              )}
              <div className="flex items-center gap-2 text-sm text-success">
                <Award className="size-4" /> 30-day money-back guarantee
              </div>
              <div className="pt-2 border-t">
                <p className="text-sm font-semibold mb-2">This course includes:</p>
                <ul className="text-sm text-muted-foreground space-y-1.5">
                  <li className="flex items-center gap-2"><Clock className="size-4" /> {course.duration_text} of on-demand video</li>
                  <li className="flex items-center gap-2"><Award className="size-4" /> Certificate of completion</li>
                  <li className="flex items-center gap-2"><Check className="size-4" /> Full lifetime access</li>
                  <li className="flex items-center gap-2"><Check className="size-4" /> Access on mobile and desktop</li>
                </ul>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl sm:text-2xl font-bold mb-4">{title}</h2>
      {children}
    </section>
  );
}
