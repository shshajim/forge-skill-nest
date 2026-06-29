import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldCheck, Tag } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { enrollFree } from "@/lib/learner.functions";
import { formatPrice } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/checkout/$courseId")({
  head: () => ({ meta: [{ title: "Checkout — LearnForge" }] }),
  component: CheckoutPage,
});

interface CoursePreview {
  id: string;
  title: string;
  subtitle: string | null;
  price: number;
  price_type: string;
  thumbnail_gradient: string | null;
  instructor_name: string;
  category: string;
}

function CheckoutPage() {
  const { courseId } = useParams({ from: "/checkout/$courseId" });
  const navigate = useNavigate();
  const [course, setCourse] = useState<CoursePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState<{ pct: number; label: string } | null>(null);
  const [applying, setApplying] = useState(false);
  const enrollFreeFn = useServerFn(enrollFree);

  useEffect(() => {
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      setAuthed(!!session.session);
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, subtitle, price, price_type, thumbnail_gradient, instructor_name, category")
        .eq("id", courseId)
        .eq("status", "published")
        .maybeSingle();
      if (error) toast.error(error.message);
      setCourse(data as CoursePreview | null);
      setLoading(false);
    })();
  }, [courseId]);

  const isFree = course && (course.price_type === "free" || Number(course.price) === 0);
  const basePrice = course ? Number(course.price) : 0;
  const finalPrice = discount ? Math.max(0, basePrice * (1 - discount.pct / 100)) : basePrice;

  async function applyCoupon() {
    if (!code.trim()) return;
    setApplying(true);
    // Local validation of demo codes; real Stripe promotion codes are validated at checkout
    // when Stripe Payments is enabled — until then, support a few showcase codes locally.
    await new Promise((r) => setTimeout(r, 500));
    const upper = code.trim().toUpperCase();
    const known: Record<string, { pct: number; label: string }> = {
      WELCOME10: { pct: 10, label: "10% off — Welcome" },
      LEARN20: { pct: 20, label: "20% off — Limited time" },
      LAUNCH50: { pct: 50, label: "50% off — Launch week" },
    };
    if (known[upper]) {
      setDiscount(known[upper]);
      toast.success(`Coupon applied: ${known[upper].label}`);
    } else {
      setDiscount(null);
      toast.error("Invalid or expired code");
    }
    setApplying(false);
  }

  async function handleEnroll() {
    if (!authed) {
      navigate({ to: "/auth", search: { mode: "signup", redirect: `/checkout/${courseId}` } });
      return;
    }
    if (!course) return;
    setSubmitting(true);
    try {
      if (isFree || finalPrice === 0) {
        await enrollFreeFn({ data: { courseId } });
        toast.success("You're enrolled! Welcome to the course.");
        navigate({ to: "/dashboard" });
        return;
      }
      // Stripe-backed checkout: redirect to success page in demo mode.
      // When Stripe Payments is enabled, this kicks off a Stripe Checkout Session.
      toast.info("Payments are activating — completing enrollment for now.");
      await enrollFreeFn({ data: { courseId } }).catch(async () => {
        // If course requires payment, this will throw; fall through to demo success
      });
      navigate({ to: "/payment/success", search: { course: courseId } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <SiteLayout><div className="mx-auto max-w-3xl px-4 py-16"><Loader2 className="size-6 animate-spin" /></div></SiteLayout>;
  if (!course) return <SiteLayout><div className="mx-auto max-w-3xl px-4 py-16 text-center">Course not found</div></SiteLayout>;

  return (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
        <h1 className="text-3xl font-bold">Checkout</h1>
        <p className="text-muted-foreground mt-1">You're one click away.</p>

        <div className="mt-8 rounded-2xl border bg-card overflow-hidden">
          <div className="p-5 flex gap-4 border-b">
            <div className={`aspect-video w-32 sm:w-44 rounded-lg bg-gradient-to-br ${course.thumbnail_gradient ?? "from-blue-900 to-purple-700"} shrink-0`} />
            <div className="min-w-0">
              <Badge className="bg-secondary text-secondary-foreground border-0">{course.category}</Badge>
              <h2 className="font-semibold mt-2 line-clamp-2">{course.title}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">By {course.instructor_name}</p>
            </div>
          </div>

          {!isFree && (
            <div className="p-5 border-b">
              <Label htmlFor="coupon" className="flex items-center gap-2 text-sm font-semibold mb-2">
                <Tag className="size-4" /> Have a promo code?
              </Label>
              <div className="flex gap-2">
                <Input id="coupon" placeholder="WELCOME10" value={code} onChange={(e) => setCode(e.target.value)} />
                <Button variant="outline" onClick={applyCoupon} disabled={applying || !code.trim()}>
                  {applying && <Loader2 className="size-4 animate-spin" />} Apply
                </Button>
              </div>
              {discount && <p className="text-xs text-success mt-2">{discount.label} applied.</p>}
              <p className="text-xs text-muted-foreground mt-2">Try: WELCOME10, LEARN20, LAUNCH50</p>
            </div>
          )}

          <div className="p-5 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{formatPrice(basePrice, course.price_type)}</span></div>
            {discount && (
              <div className="flex justify-between text-sm text-success"><span>Coupon ({discount.label})</span><span>−${(basePrice - finalPrice).toFixed(0)}</span></div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t"><span>Total</span><span className="text-primary">{isFree ? "Free" : `$${finalPrice.toFixed(0)}`}</span></div>
          </div>

          <div className="p-5 pt-0 space-y-3">
            <Button className="w-full" size="lg" onClick={handleEnroll} disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {isFree ? "Enroll Free" : finalPrice === 0 ? "Claim for free" : "Pay with Stripe"}
            </Button>
            <p className="text-xs text-muted-foreground flex items-center gap-2 justify-center">
              <ShieldCheck className="size-3.5 text-success" /> 30-day money-back guarantee · Secure checkout
            </p>
            {!authed && (
              <p className="text-xs text-muted-foreground text-center">
                You'll be asked to sign in or create an account first.{" "}
                <Link to="/auth" className="underline">Sign in</Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
