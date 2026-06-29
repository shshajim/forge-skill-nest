import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { DollarSign, Users, BookOpen, Star, Plus, Edit } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getInstructorDashboard } from "@/lib/instructor.functions";

const insQ = queryOptions({ queryKey: ["instructor-dash"], queryFn: () => getInstructorDashboard() });

export const Route = createFileRoute("/_authenticated/instructor/")({
  head: () => ({ meta: [{ title: "Instructor — LearnForge" }] }),
  component: InstructorDashboard,
  errorComponent: ({ error }) => (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Instructor access required</h1>
        <p className="text-muted-foreground mt-2">{String(error.message)}</p>
        <Button asChild className="mt-6"><Link to="/auth" search={{ mode: "signup" }}>Become an instructor</Link></Button>
      </div>
    </SiteLayout>
  ),
});

function InstructorDashboard() {
  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold">Instructor</h1>
            <p className="text-muted-foreground mt-1">Your courses, students, and earnings.</p>
          </div>
          <Button asChild><Link to="/instructor/create"><Plus className="size-4" /> New course</Link></Button>
        </div>
        <Suspense fallback={<div className="h-48 bg-muted/40 rounded-xl mt-8 animate-pulse" />}>
          <Body />
        </Suspense>
      </div>
    </SiteLayout>
  );
}

function Body() {
  const { data } = useSuspenseQuery(insQ);
  return (
    <>
      <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={<DollarSign className="size-5" />} label="Total revenue" value={`$${data.stats.totalRevenue.toFixed(0)}`} />
        <Stat icon={<Users className="size-5" />} label="Total students" value={data.stats.totalStudents} />
        <Stat icon={<BookOpen className="size-5" />} label="Active courses" value={data.stats.activeCourses} />
        <Stat icon={<Star className="size-5" />} label="Avg rating" value={data.stats.avgRating || "—"} />
      </div>

      <div className="mt-8 rounded-xl border bg-card p-5">
        <h2 className="font-semibold mb-4">Revenue by month</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
              <Line type="monotone" dataKey="revenue" stroke="var(--color-primary)" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-8 rounded-xl border bg-card overflow-hidden">
        <div className="p-5 border-b">
          <h2 className="font-semibold">My courses</h2>
        </div>
        {data.courses.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            No courses yet. <Link to="/instructor/create" className="text-primary underline">Create your first</Link>.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Students</TableHead>
                <TableHead className="text-right">Rating</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.courses.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium max-w-sm truncate">{c.title}</TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                  <TableCell className="text-right">{c.enrollment_count}</TableCell>
                  <TableCell className="text-right">{Number(c.rating_avg).toFixed(1)} ({c.rating_count})</TableCell>
                  <TableCell className="text-right">${Number(c.price).toFixed(0)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" disabled><Edit className="size-4" /> Edit</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    draft: { label: "Draft", className: "bg-muted text-muted-foreground border-0" },
    pending_review: { label: "In review", className: "bg-warning/20 text-warning border-0" },
    published: { label: "Published", className: "bg-success/20 text-success border-0" },
    rejected: { label: "Rejected", className: "bg-destructive/20 text-destructive border-0" },
  };
  const v = map[status] ?? map.draft;
  return <Badge className={v.className}>{v.label}</Badge>;
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
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
