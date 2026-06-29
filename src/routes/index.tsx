import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { ArrowRight, Sparkles, Star, Users, BookOpen, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SiteLayout } from "@/components/SiteLayout";
import { CourseCard, CourseCardSkeleton } from "@/components/CourseCard";
import { listPublishedCourses } from "@/lib/courses.functions";
import { CATEGORIES, type Category } from "@/lib/categories";

const coursesQ = queryOptions({
  queryKey: ["courses", "published"],
  queryFn: () => listPublishedCourses(),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LearnForge — Learn Without Limits" },
      { name: "description", content: "Master in-demand skills with expert-led courses. 10,000+ students, 4.8 avg rating, 200+ courses." },
      { property: "og:title", content: "LearnForge — Learn Without Limits" },
      { property: "og:description", content: "Expert-led courses in development, design, AI, business and marketing." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(coursesQ),
  component: HomePage,
});

function HomePage() {
  return (
    <SiteLayout>
      <Hero />
      <Suspense fallback={<FeaturedSkeleton />}>
        <Featured />
      </Suspense>
      <Testimonials />
    </SiteLayout>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 opacity-50">
        <div className="absolute top-0 left-1/4 size-96 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute top-20 right-1/4 size-96 rounded-full bg-purple-500/20 blur-3xl" />
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20 sm:py-28 text-center">
        <Badge variant="outline" className="mb-6 border-primary/40 text-primary">
          <Sparkles className="size-3 mr-1.5" /> 200+ courses across 5 tracks
        </Badge>
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.05]">
          Master <span className="text-gradient-primary">In-Demand</span><br />Skills
        </h1>
        <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
          Learn from world-class instructors. Build real projects. Ship a portfolio. From your first line of code to senior-level chops.
        </p>
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <Button asChild size="lg" className="text-base"><Link to="/courses">Browse Courses <ArrowRight className="size-4" /></Link></Button>
          <Button asChild size="lg" variant="outline" className="text-base"><Link to="/auth" search={{ mode: "signup" }}>Start Free</Link></Button>
        </div>
        <div className="mt-12 grid grid-cols-3 max-w-2xl mx-auto gap-4">
          <Stat icon={<Users className="size-5" />} label="Students" value="10,000+" />
          <Stat icon={<Star className="size-5" />} label="Avg Rating" value="4.8" />
          <Stat icon={<BookOpen className="size-5" />} label="Courses" value="200+" />
        </div>
      </div>
    </section>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card/50 backdrop-blur-sm p-5">
      <div className="flex items-center justify-center text-primary mb-2">{icon}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Featured() {
  const { data: courses } = useSuspenseQuery(coursesQ);
  const [cat, setCat] = useState<Category>("All");
  const filtered = cat === "All" ? courses.slice(0, 6) : courses.filter((c) => c.category === cat).slice(0, 6);

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl sm:text-4xl font-bold">Featured Courses</h2>
          <p className="text-muted-foreground mt-2">Handpicked by our team of instructors.</p>
        </div>
        <Button asChild variant="ghost"><Link to="/courses">View all <ArrowRight className="size-4" /></Link></Button>
      </div>
      <div className="flex flex-wrap gap-2 mb-8">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors cursor-pointer ${
              cat === c ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">No courses in this category yet.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((c) => <CourseCard key={c.id} course={c} />)}
        </div>
      )}
    </section>
  );
}

function FeaturedSkeleton() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => <CourseCardSkeleton key={i} />)}
      </div>
    </section>
  );
}

const TESTIMONIALS = [
  { name: "Maya Lin", role: "Frontend Engineer @ Stripe", quote: "The Next.js Masterclass got me job-ready in 6 weeks. The projects are real and the instructor is sharp.", rating: 5 },
  { name: "Diego Romero", role: "Indie Hacker", quote: "I shipped my first SaaS using LearnForge courses. The pace and quality are unmatched.", rating: 5 },
  { name: "Aisha Khan", role: "Product Designer @ Linear", quote: "The UI/UX track turned me from 'okay at design' into someone who ships polished work. Worth every dollar.", rating: 5 },
];

function Testimonials() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
      <div className="text-center mb-12">
        <h2 className="text-3xl sm:text-4xl font-bold">Loved by 10,000+ learners</h2>
        <p className="text-muted-foreground mt-2">Don't take our word for it.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        {TESTIMONIALS.map((t) => (
          <div key={t.name} className="rounded-xl border bg-card p-6 card-hover">
            <div className="flex gap-1 text-warning mb-3">
              {Array.from({ length: t.rating }).map((_, i) => <Star key={i} className="size-4 fill-current" />)}
            </div>
            <p className="text-sm leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
            <div className="mt-5 flex items-center gap-3">
              <div className="size-10 rounded-full bg-gradient-to-br from-primary to-purple-500 grid place-items-center text-sm font-bold text-white">
                {t.name.slice(0, 1)}
              </div>
              <div>
                <div className="text-sm font-semibold">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-16 rounded-2xl border bg-gradient-to-br from-primary/10 to-purple-500/10 p-10 text-center">
        <Award className="size-10 text-primary mx-auto mb-4" />
        <h3 className="text-2xl sm:text-3xl font-bold mb-3">Earn shareable certificates</h3>
        <p className="text-muted-foreground max-w-xl mx-auto mb-6">Finish a course to unlock a downloadable PDF certificate you can post on LinkedIn.</p>
        <Button asChild size="lg"><Link to="/courses">Pick a course</Link></Button>
      </div>
    </section>
  );
}
