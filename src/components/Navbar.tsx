import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { GraduationCap, Sun, Moon, Menu, X, LayoutDashboard, LogOut, BookOpen, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function Navbar() {
  const { user, roles, loading } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const isInstructor = roles.includes("instructor") || roles.includes("admin");
  const isAdmin = roles.includes("admin");

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/" });
  }

  const navLinks = (
    <>
      <Link to="/" className="text-sm font-medium hover:text-primary transition-colors" activeProps={{ className: "text-primary" }}>
        Home
      </Link>
      <Link to="/courses" className="text-sm font-medium hover:text-primary transition-colors" activeProps={{ className: "text-primary" }}>
        Courses
      </Link>
    </>
  );

  return (
    <header className="sticky top-0 z-40 glass-nav">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="grid place-items-center size-9 rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="size-5" />
          </span>
          <span className="hidden sm:inline">LearnForge</span>
        </Link>

        <nav className="hidden md:flex items-center gap-7">{navLinks}</nav>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>

          {!loading && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="size-9 rounded-full bg-primary/20 border border-border grid place-items-center font-semibold text-sm cursor-pointer hover:bg-primary/30 transition-colors">
                  {(user.email ?? "?").slice(0, 1).toUpperCase()}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/dashboard"><LayoutDashboard className="size-4 mr-2" />Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/courses"><BookOpen className="size-4 mr-2" />Browse Courses</Link>
                </DropdownMenuItem>
                {isInstructor && (
                  <DropdownMenuItem asChild>
                    <Link to="/instructor"><GraduationCap className="size-4 mr-2" />Instructor</Link>
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin"><Shield className="size-4 mr-2" />Admin</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}><LogOut className="size-4 mr-2" />Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : !loading ? (
            <>
              <Button asChild variant="ghost" className="hidden sm:inline-flex"><Link to="/auth">Log in</Link></Button>
              <Button asChild><Link to="/auth" search={{ mode: "signup" }}>Sign up</Link></Button>
            </>
          ) : null}

          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen((v) => !v)} aria-label="Menu">
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-md">
          <div className="px-4 py-4 flex flex-col gap-4" onClick={() => setOpen(false)}>
            {navLinks}
          </div>
        </div>
      )}
    </header>
  );
}
