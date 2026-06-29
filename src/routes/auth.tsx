import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { GraduationCap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";

const searchSchema = z.object({
  mode: z.enum(["login", "signup"]).optional(),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Sign in — LearnForge" }] }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"login" | "signup">(search.mode ?? "login");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: (search.redirect as "/dashboard") ?? "/dashboard" });
    });
  }, [navigate, search.redirect]);

  return (
    <div className="min-h-screen grid place-items-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 font-bold text-lg mb-8">
          <span className="grid place-items-center size-10 rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="size-5" />
          </span>
          LearnForge
        </Link>
        <div className="rounded-2xl border bg-card p-6 sm:p-8 shadow-card">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "signup")}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="login">Log in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>
            <TabsContent value="login" className="mt-6">
              <LoginForm />
            </TabsContent>
            <TabsContent value="signup" className="mt-6">
              <SignupForm />
            </TabsContent>
          </Tabs>
          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
          </div>
          <GoogleButton />
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back!");
    navigate({ to: "/dashboard" });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading && <Loader2 className="size-4 animate-spin" />} Log in
      </Button>
    </form>
  );
}

function SignupForm() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"student" | "instructor">("student");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        data: { full_name: name, role },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created — welcome to LearnForge!");
    navigate({ to: role === "instructor" ? "/instructor" : "/dashboard" });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="su-email">Email</Label>
        <Input id="su-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="su-password">Password (min 6 chars)</Label>
        <Input id="su-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>I want to</Label>
        <RadioGroup value={role} onValueChange={(v) => setRole(v as "student" | "instructor")} className="grid grid-cols-2 gap-3">
          <label className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer ${role === "student" ? "border-primary bg-primary/10" : "border-border"}`}>
            <RadioGroupItem value="student" /> Learn
          </label>
          <label className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer ${role === "instructor" ? "border-primary bg-primary/10" : "border-border"}`}>
            <RadioGroupItem value="instructor" /> Teach
          </label>
        </RadioGroup>
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading && <Loader2 className="size-4 animate-spin" />} Create account
      </Button>
    </form>
  );
}

function GoogleButton() {
  const [loading, setLoading] = useState(false);
  async function handle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: typeof window !== "undefined" ? window.location.origin : undefined,
    });
    if (result.error) {
      setLoading(false);
      toast.error(result.error.message ?? "Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    setLoading(false);
    window.location.href = "/dashboard";
  }
  return (
    <Button type="button" variant="outline" onClick={handle} disabled={loading} className="w-full">
      {loading ? <Loader2 className="size-4 animate-spin" /> : <GoogleIcon />} Continue with Google
    </Button>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4">
      <path fill="#EA4335" d="M12 5c1.6 0 3.1.6 4.2 1.6l3.1-3.1A11 11 0 0 0 1.3 8l3.6 2.8C5.8 7.5 8.7 5 12 5z" />
      <path fill="#4285F4" d="M23 12.3c0-.8-.1-1.5-.2-2.3H12v4.5h6.2c-.3 1.5-1.1 2.7-2.4 3.5l3.5 2.7c2.1-1.9 3.7-4.8 3.7-8.4z" />
      <path fill="#FBBC05" d="M4.9 14.2A6.6 6.6 0 0 1 4.6 12c0-.8.1-1.5.3-2.2L1.3 7A11 11 0 0 0 0 12c0 1.8.4 3.5 1.3 5l3.6-2.8z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7L15.8 17.6c-1 .7-2.3 1.1-3.8 1.1-3.3 0-6.2-2.5-7.2-5.5L1.2 16A11 11 0 0 0 12 23z" />
    </svg>
  );
}
