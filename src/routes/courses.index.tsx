import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { CourseCard, CourseCardSkeleton } from "@/components/CourseCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listPublishedCourses } from "@/lib/courses.functions";
import { CATEGORIES, DIFFICULTIES, SORTS } from "@/lib/categories";

const coursesQ = queryOptions({ queryKey: ["courses", "published"], queryFn: () => listPublishedCourses() });

export const Route = createFileRoute("/courses")({
  head: () => ({
    meta: [
      { title: "All Courses — LearnForge" },
      { name: "description", content: "Browse 200+ expert-led courses across Development, Design, AI & ML, Business, and Marketing." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(coursesQ),
  component: CoursesPage,
});

function CoursesPage() {
  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
        <h1 className="text-3xl sm:text-4xl font-bold">All courses</h1>
        <p className="text-muted-foreground mt-2">Search, filter, and find your next skill.</p>
        <Suspense fallback={<div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">{Array.from({length:6}).map((_,i)=><CourseCardSkeleton key={i}/>)}</div>}>
          <CoursesGrid />
        </Suspense>
      </div>
    </SiteLayout>
  );
}

function CoursesGrid() {
  const { data: courses } = useSuspenseQuery(coursesQ);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("All");
  const [price, setPrice] = useState<"all" | "free" | "paid">("all");
  const [diff, setDiff] = useState<string>("All");
  const [rating, setRating] = useState<"all" | "4" | "3">("all");
  const [sort, setSort] = useState<string>("popular");

  const filtered = useMemo(() => {
    let r = courses.filter((c) => {
      if (q && !`${c.title} ${c.subtitle ?? ""} ${c.instructor_name}`.toLowerCase().includes(q.toLowerCase())) return false;
      if (cat !== "All" && c.category !== cat) return false;
      if (price === "free" && c.price > 0) return false;
      if (price === "paid" && c.price === 0) return false;
      if (diff !== "All" && c.difficulty !== diff) return false;
      if (rating === "4" && Number(c.rating_avg) < 4) return false;
      if (rating === "3" && Number(c.rating_avg) < 3) return false;
      return true;
    });
    if (sort === "newest") r = [...r].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    else if (sort === "rating") r = [...r].sort((a, b) => Number(b.rating_avg) - Number(a.rating_avg));
    else if (sort === "price_asc") r = [...r].sort((a, b) => Number(a.price) - Number(b.price));
    else r = [...r].sort((a, b) => b.enrollment_count - a.enrollment_count);
    return r;
  }, [courses, q, cat, price, diff, rating, sort]);

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[260px_1fr]">
      <aside className="space-y-6">
        <FilterGroup title="Category">
          {CATEGORIES.map((c) => (
            <FilterChip key={c} active={cat === c} onClick={() => setCat(c)}>{c}</FilterChip>
          ))}
        </FilterGroup>
        <FilterGroup title="Price">
          {[
            { v: "all", l: "All" },
            { v: "free", l: "Free" },
            { v: "paid", l: "Paid" },
          ].map((o) => (
            <FilterChip key={o.v} active={price === o.v} onClick={() => setPrice(o.v as typeof price)}>{o.l}</FilterChip>
          ))}
        </FilterGroup>
        <FilterGroup title="Difficulty">
          {(["All", ...DIFFICULTIES] as const).map((d) => (
            <FilterChip key={d} active={diff === d} onClick={() => setDiff(d)}>{d}</FilterChip>
          ))}
        </FilterGroup>
        <FilterGroup title="Rating">
          {[
            { v: "all", l: "All" },
            { v: "4", l: "4★ & up" },
            { v: "3", l: "3★ & up" },
          ].map((o) => (
            <FilterChip key={o.v} active={rating === o.v} onClick={() => setRating(o.v as typeof rating)}>{o.l}</FilterChip>
          ))}
        </FilterGroup>
      </aside>
      <div>
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search courses, instructors..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="sort" className="text-sm text-muted-foreground">Sort</Label>
            <select
              id="sort"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="text-center py-16 border border-dashed rounded-xl">
            <p className="text-muted-foreground">No courses match your filters.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {filtered.map((c) => <CourseCard key={c.id} course={c} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{title}</h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${active ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}
    >
      {children}
    </button>
  );
}
