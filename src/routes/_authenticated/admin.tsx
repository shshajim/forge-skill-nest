import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Suspense, useMemo, useState } from "react";
import { DollarSign, Users, BookOpen, GraduationCap, Search, Ban, CheckCircle2 } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getAdminOverview, reviewCourse, setUserBanned } from "@/lib/admin.functions";
import { toast } from "sonner";

const adminQ = queryOptions({ queryKey: ["admin-overview"], queryFn: () => getAdminOverview() });

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — LearnForge" }] }),
  component: AdminPage,
  errorComponent: ({ error }) => (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Admin only</h1>
        <p className="text-muted-foreground mt-2">{String(error.message)}</p>
        <Button asChild className="mt-6"><Link to="/">Go home</Link></Button>
      </div>
    </SiteLayout>
  ),
});

function AdminPage() {
  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
        <h1 className="text-3xl sm:text-4xl font-bold">Admin</h1>
        <p className="text-muted-foreground mt-1">Approve courses, manage users, monitor the platform.</p>
        <Suspense fallback={<div className="h-48 bg-muted/40 rounded-xl mt-8 animate-pulse" />}>
          <Body />
        </Suspense>
      </div>
    </SiteLayout>
  );
}

function Body() {
  const { data } = useSuspenseQuery(adminQ);
  const qc = useQueryClient();
  const review = useServerFn(reviewCourse);
  const ban = useServerFn(setUserBanned);

  async function approve(id: string) {
    await review({ data: { courseId: id, action: "approve" } });
    toast.success("Course published");
    qc.invalidateQueries({ queryKey: ["admin-overview"] });
  }

  return (
    <>
      <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={<DollarSign className="size-5" />} label="Platform revenue" value={`$${data.stats.totalRevenue.toFixed(0)}`} />
        <Stat icon={<Users className="size-5" />} label="Total students" value={data.stats.totalStudents} />
        <Stat icon={<BookOpen className="size-5" />} label="Published courses" value={data.stats.totalCourses} />
        <Stat icon={<GraduationCap className="size-5" />} label="Instructors" value={data.stats.totalInstructors} />
      </div>

      <section className="mt-10 rounded-xl border bg-card overflow-hidden">
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="font-semibold">Pending course reviews</h2>
          <Badge className="bg-warning/20 text-warning border-0">{data.pending.length} pending</Badge>
        </div>
        {data.pending.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">No courses awaiting review.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Instructor</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.pending.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium max-w-sm truncate">{c.title}</TableCell>
                  <TableCell>{c.instructor_name}</TableCell>
                  <TableCell className="text-right">${Number(c.price).toFixed(0)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" onClick={() => approve(c.id)}><CheckCircle2 className="size-4" /> Approve</Button>
                      <RejectButton onReject={async (note) => {
                        await review({ data: { courseId: c.id, action: "reject", note } });
                        toast.success("Course rejected");
                        qc.invalidateQueries({ queryKey: ["admin-overview"] });
                      }} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <UsersSection users={data.users} onBan={async (id, isBanned) => {
        await ban({ data: { userId: id, banned: !isBanned } });
        toast.success(isBanned ? "User unbanned" : "User banned");
        qc.invalidateQueries({ queryKey: ["admin-overview"] });
      }} />
    </>
  );
}

function UsersSection({ users, onBan }: { users: any[]; onBan: (id: string, current: boolean) => Promise<void> }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () => users.filter((u) => `${u.full_name ?? ""} ${u.email ?? ""}`.toLowerCase().includes(q.toLowerCase())),
    [users, q],
  );
  return (
    <section className="mt-10 rounded-xl border bg-card overflow-hidden">
      <div className="p-5 border-b flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-semibold">Users</h2>
        <div className="relative w-72 max-w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Roles</TableHead>
            <TableHead className="text-right">Enrollments</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-medium">{u.full_name ?? "—"}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {u.roles.map((r: string) => (
                    <Badge key={r} className={r === "admin" ? "bg-destructive/20 text-destructive border-0" : r === "instructor" ? "bg-primary/20 text-primary border-0" : "bg-secondary text-secondary-foreground border-0"}>
                      {r}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell className="text-right">{u.enrollments}</TableCell>
              <TableCell>{u.is_banned ? <Badge className="bg-destructive/20 text-destructive border-0">Banned</Badge> : <Badge className="bg-success/20 text-success border-0">Active</Badge>}</TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant={u.is_banned ? "outline" : "destructive"} onClick={() => onBan(u.id, u.is_banned)}>
                  <Ban className="size-4" /> {u.is_banned ? "Unban" : "Ban"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

function RejectButton({ onReject }: { onReject: (note: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Reject</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Reject course</DialogTitle></DialogHeader>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (shared with the instructor)" rows={4} />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="destructive" onClick={async () => { await onReject(note); setOpen(false); setNote(""); }}>Reject</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
