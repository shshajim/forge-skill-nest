import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, Loader2 } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createCourse } from "@/lib/instructor.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/instructor/create")({
  head: () => ({ meta: [{ title: "New course — LearnForge" }] }),
  component: WizardPage,
});

const CATS = ["Development", "Design", "AI & ML", "Business", "Marketing"];

interface LessonDraft { title: string; videoUrl: string; durationMinutes: number }
interface SectionDraft { title: string; lessons: LessonDraft[] }

function WizardPage() {
  const navigate = useNavigate();
  const createFn = useServerFn(createCourse);
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [category, setCategory] = useState(CATS[0]);
  const [difficulty, setDifficulty] = useState<"Beginner" | "Intermediate" | "Advanced">("Beginner");
  const [language, setLanguage] = useState("English");
  const [description, setDescription] = useState("");
  const [whatYouLearn, setWhatYouLearn] = useState<string[]>([""]);
  const [requirements, setRequirements] = useState<string[]>([""]);
  const [sections, setSections] = useState<SectionDraft[]>([{ title: "Introduction", lessons: [{ title: "Welcome", videoUrl: "", durationMinutes: 5 }] }]);
  const [priceType, setPriceType] = useState<"free" | "one_time" | "subscription">("one_time");
  const [price, setPrice] = useState(29);
  const [submitting, setSubmitting] = useState(false);

  const steps = ["Basics", "Details", "Curriculum", "Pricing", "Publish"];

  async function publish() {
    if (!title.trim()) return toast.error("Title is required");
    setSubmitting(true);
    try {
      const res = await createFn({
        data: {
          title,
          subtitle: subtitle || undefined,
          category,
          difficulty,
          language,
          description: description || undefined,
          whatYouLearn: whatYouLearn.filter((s) => s.trim()),
          requirements: requirements.filter((s) => s.trim()),
          price: priceType === "free" ? 0 : Number(price),
          priceType,
          sections: sections
            .filter((s) => s.title.trim())
            .map((s) => ({
              title: s.title,
              lessons: s.lessons.filter((l) => l.title.trim()),
            })),
        },
      });
      toast.success("Course submitted for review!");
      navigate({ to: "/instructor" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
        <h1 className="text-3xl font-bold">Create a course</h1>
        <p className="text-muted-foreground mt-1">Five quick steps. Submit for review when ready.</p>

        <div className="mt-6 mb-8">
          <div className="flex justify-between">
            {steps.map((s, i) => (
              <div key={s} className="flex-1 text-center">
                <div className={`mx-auto size-8 rounded-full grid place-items-center text-xs font-bold border ${i + 1 <= step ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground"}`}>
                  {i + 1}
                </div>
                <div className="text-xs mt-1 hidden sm:block">{s}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${(step / steps.length) * 100}%` }} />
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-6 space-y-5">
          {step === 1 && (
            <>
              <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. React Performance Masterclass" /></Field>
              <Field label="Subtitle"><Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="One sentence about your course" /></Field>
              <div className="grid sm:grid-cols-3 gap-4">
                <Field label="Category">
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm w-full">
                    {CATS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Difficulty">
                  <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as any)} className="h-9 rounded-md border bg-background px-3 text-sm w-full">
                    {["Beginner", "Intermediate", "Advanced"].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Language"><Input value={language} onChange={(e) => setLanguage(e.target.value)} /></Field>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <Field label="Description">
                <Textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell students what they'll get out of this course." />
              </Field>
              <ListEditor label="What you'll learn" items={whatYouLearn} setItems={setWhatYouLearn} placeholder="Build production React apps" />
              <ListEditor label="Requirements" items={requirements} setItems={setRequirements} placeholder="Basic JavaScript knowledge" />
            </>
          )}

          {step === 3 && (
            <div className="space-y-4">
              {sections.map((s, si) => (
                <div key={si} className="rounded-lg border p-4 space-y-3">
                  <div className="flex gap-2">
                    <Input
                      value={s.title}
                      onChange={(e) => {
                        const c = [...sections]; c[si].title = e.target.value; setSections(c);
                      }}
                      placeholder="Section title"
                    />
                    <Button variant="ghost" size="icon" onClick={() => setSections(sections.filter((_, i) => i !== si))}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  {s.lessons.map((l, li) => (
                    <div key={li} className="grid grid-cols-[1fr_140px_80px_auto] gap-2 items-center">
                      <Input
                        value={l.title}
                        placeholder="Lesson title"
                        onChange={(e) => { const c = [...sections]; c[si].lessons[li].title = e.target.value; setSections(c); }}
                      />
                      <Input
                        value={l.videoUrl}
                        placeholder="Video URL"
                        onChange={(e) => { const c = [...sections]; c[si].lessons[li].videoUrl = e.target.value; setSections(c); }}
                      />
                      <Input
                        type="number"
                        value={l.durationMinutes}
                        onChange={(e) => { const c = [...sections]; c[si].lessons[li].durationMinutes = Number(e.target.value); setSections(c); }}
                      />
                      <Button variant="ghost" size="icon" onClick={() => { const c = [...sections]; c[si].lessons.splice(li,1); setSections(c); }}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => { const c = [...sections]; c[si].lessons.push({ title: "", videoUrl: "", durationMinutes: 10 }); setSections(c); }}>
                    <Plus className="size-4" /> Add lesson
                  </Button>
                </div>
              ))}
              <Button variant="outline" onClick={() => setSections([...sections, { title: "", lessons: [] }])}>
                <Plus className="size-4" /> Add section
              </Button>
            </div>
          )}

          {step === 4 && (
            <>
              <Field label="Price type">
                <div className="grid grid-cols-3 gap-2">
                  {(["free", "one_time", "subscription"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setPriceType(t)}
                      className={`p-3 rounded-lg border text-sm font-medium cursor-pointer ${priceType === t ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
                    >
                      {t === "free" ? "Free" : t === "one_time" ? "One-time" : "Subscription"}
                    </button>
                  ))}
                </div>
              </Field>
              {priceType !== "free" && (
                <Field label={priceType === "subscription" ? "Price (per month, USD)" : "Price (USD)"}>
                  <Input type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
                </Field>
              )}
            </>
          )}

          {step === 5 && (
            <div className="space-y-3 text-sm">
              <h3 className="font-semibold">Review</h3>
              <Row label="Title" value={title} />
              <Row label="Category" value={`${category} · ${difficulty}`} />
              <Row label="Sections" value={`${sections.length} sections · ${sections.reduce((a, s) => a + s.lessons.length, 0)} lessons`} />
              <Row label="Price" value={priceType === "free" ? "Free" : `$${price}${priceType === "subscription" ? "/mo" : ""}`} />
              <p className="text-xs text-muted-foreground pt-2">Submitting sends your course to admin for review. You'll be notified once it's published.</p>
            </div>
          )}

          <div className="flex justify-between pt-4 border-t">
            <Button variant="outline" disabled={step === 1} onClick={() => setStep((s) => s - 1)}><ChevronLeft className="size-4" /> Back</Button>
            {step < 5 ? (
              <Button onClick={() => setStep((s) => s + 1)}>Next <ChevronRight className="size-4" /></Button>
            ) : (
              <Button onClick={publish} disabled={submitting}>
                {submitting && <Loader2 className="size-4 animate-spin" />} Submit for review
              </Button>
            )}
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4"><span className="text-muted-foreground">{label}</span><span className="font-medium text-right">{value}</span></div>;
}

function ListEditor({ label, items, setItems, placeholder }: { label: string; items: string[]; setItems: (v: string[]) => void; placeholder: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {items.map((it, i) => (
        <div key={i} className="flex gap-2">
          <Input value={it} placeholder={placeholder} onChange={(e) => { const c = [...items]; c[i] = e.target.value; setItems(c); }} />
          <Button variant="ghost" size="icon" onClick={() => setItems(items.filter((_, idx) => idx !== i))}><Trash2 className="size-4" /></Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => setItems([...items, ""])}><Plus className="size-4" /> Add</Button>
    </div>
  );
}
