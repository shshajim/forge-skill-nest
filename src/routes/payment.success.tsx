import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/payment/success")({
  validateSearch: z.object({ course: z.string().optional() }),
  head: () => ({ meta: [{ title: "Payment successful — LearnForge" }] }),
  component: SuccessPage,
});

function SuccessPage() {
  return (
    <SiteLayout>
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="mx-auto size-16 rounded-full bg-success/15 text-success grid place-items-center mb-6">
          <CheckCircle2 className="size-9" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold">You're enrolled!</h1>
        <p className="text-muted-foreground mt-3">Your purchase is confirmed. A receipt is on its way to your inbox.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg"><Link to="/dashboard">Go to dashboard <ArrowRight className="size-4" /></Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/courses">Browse more</Link></Button>
        </div>
      </div>
    </SiteLayout>
  );
}
