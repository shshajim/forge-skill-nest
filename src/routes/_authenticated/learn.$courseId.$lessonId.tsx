import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, Suspense } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getCoursePlayerData, setLessonComplete } from "@/lib/learner.functions";
import { toast } from "sonner";

const playerQ = (courseId: string) =>
  queryOptions({ queryKey: ["player", courseId], queryFn: () => getCoursePlayerData({ data: { courseId } }) });

export const Route = createFileRoute("/_authenticated/learn/$courseId/$lessonId")({
  head: () => ({ meta: [{ title: "Learning — LearnForge" }] }),
  component: PlayerPage,
});

function PlayerPage() {
  return (
    <SiteLayout>
      <Suspense fallback={<div className="mx-auto max-w-7xl py-12 px-4"><Loader2 className="size-6 animate-spin" /></div>}>
        <Body />
      </Suspense>
    </SiteLayout>
  );
}

function Body() {
  const { courseId, lessonId } = Route.useParams();
  const { data } = useSuspenseQuery(playerQ(courseId));
  const navigate = useNavigate();
  const qc = useQueryClient();
  const mark = useServerFn(setLessonComplete);

  const flat = useMemo(() => data.sections.flatMap((s) => s.lessons ?? []), [data.sections]);
  const idx = flat.findIndex((l) => l.id === lessonId);
  const current = flat[idx];
  const prev = flat[idx - 1];
  const next = flat[idx + 1];
  const completedSet = new Set(data.completedLessonIds);
  const completedCount = completedSet.size;
  const total = flat.length;
  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  const isDone = completedSet.has(lessonId);

  const [notes, setNotes] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem(`notes-${lessonId}`) ?? "" : "",
  );

  async function toggleComplete() {
    await mark({ data: { courseId, lessonId, completed: !isDone } });
    if (!isDone) toast.success("Lesson marked complete");
    qc.invalidateQueries({ queryKey: ["player", courseId] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  if (!current) {
    return <div className="mx-auto max-w-7xl py-12 px-4">Lesson not found</div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <div className="mb-4">
        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
          <Link to="/courses/$slug" params={{ slug: data.course?.slug ?? "" }} className="hover:text-foreground">
            ← Back to course
          </Link>
          <span>{completedCount} / {total} · {pct}% complete</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="grid lg:grid-cols-[300px_1fr] gap-6">
        <aside className="rounded-xl border bg-card overflow-hidden h-fit lg:sticky lg:top-20 max-h-[80vh] overflow-y-auto">
          <div className="p-4 border-b">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Course</div>
            <div className="font-semibold mt-1">{data.course?.title}</div>
          </div>
          <div className="p-2">
            {data.sections.map((s) => (
              <div key={s.id} className="mb-3">
                <div className="px-2 py-1.5 text-xs font-semibold uppercase text-muted-foreground">{s.title}</div>
                <ul>
                  {(s.lessons ?? []).map((l) => {
                    const done = completedSet.has(l.id);
                    const active = l.id === lessonId;
                    return (
                      <li key={l.id}>
                        <Link
                          to="/learn/$courseId/$lessonId"
                          params={{ courseId, lessonId: l.id }}
                          className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm hover:bg-accent ${active ? "bg-accent" : ""}`}
                        >
                          <span
                            className={`size-4 rounded-full grid place-items-center text-[10px] shrink-0 ${
                              done ? "bg-success text-success-foreground" : "border border-muted-foreground/40"
                            }`}
                          >
                            {done && <Check className="size-3" />}
                          </span>
                          <span className="flex-1 line-clamp-2">{l.title}</span>
                          <span className="text-xs text-muted-foreground">{l.duration_minutes}m</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        <div>
          <div className="aspect-video rounded-xl overflow-hidden border bg-black">
            {current.video_url ? (
              <iframe src={current.video_url} className="size-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
            ) : (
              <div className="size-full grid place-items-center text-muted-foreground">Video coming soon</div>
            )}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold flex-1">{current.title}</h1>
            <Button variant={isDone ? "secondary" : "default"} onClick={toggleComplete}>
              <Check className="size-4" /> {isDone ? "Completed" : "Mark as complete"}
            </Button>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <Button
              variant="outline"
              disabled={!prev}
              onClick={() => prev && navigate({ to: "/learn/$courseId/$lessonId", params: { courseId, lessonId: prev.id } })}
            >
              <ChevronLeft className="size-4" /> Previous
            </Button>
            <Button
              disabled={!next}
              onClick={() => next && navigate({ to: "/learn/$courseId/$lessonId", params: { courseId, lessonId: next.id } })}
            >
              Next <ChevronRight className="size-4" />
            </Button>
          </div>

          <Tabs defaultValue="overview" className="mt-8">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="qa">Q&amp;A</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-4 text-sm leading-relaxed text-muted-foreground">
              <p>This lesson is part of <strong className="text-foreground">{data.course?.title}</strong>. Watch the full video, then mark it complete to track your progress.</p>
            </TabsContent>
            <TabsContent value="notes" className="mt-4">
              <Textarea
                placeholder="Type your notes for this lesson — saved locally on this device."
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  if (typeof window !== "undefined") localStorage.setItem(`notes-${lessonId}`, e.target.value);
                }}
                rows={8}
              />
              <p className="text-xs text-muted-foreground mt-2">Notes are saved to this browser as you type.</p>
            </TabsContent>
            <TabsContent value="qa" className="mt-4 text-sm text-muted-foreground">
              <div className="rounded-xl border border-dashed p-8 text-center">
                <p>Q&amp;A is coming soon. Have a question? Email the instructor.</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
