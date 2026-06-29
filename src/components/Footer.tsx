import { Link } from "@tanstack/react-router";
import { GraduationCap, Twitter, Github, Linkedin } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border mt-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 grid gap-10 md:grid-cols-4">
        <div className="space-y-3">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg">
            <span className="grid place-items-center size-9 rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="size-5" />
            </span>
            LearnForge
          </Link>
          <p className="text-sm text-muted-foreground max-w-xs">Learn without limits. Build real skills, ship real projects.</p>
        </div>
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Platform</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/courses" className="hover:text-foreground">Courses</Link></li>
            <li><Link to="/auth" search={{ mode: "signup" }} className="hover:text-foreground">Become an Instructor</Link></li>
          </ul>
        </div>
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Company</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><a className="hover:text-foreground" href="#">About</a></li>
            <li><a className="hover:text-foreground" href="#">Careers</a></li>
            <li><a className="hover:text-foreground" href="#">Blog</a></li>
          </ul>
        </div>
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Follow</h4>
          <div className="flex gap-3 text-muted-foreground">
            <a className="hover:text-primary" href="#" aria-label="Twitter"><Twitter className="size-5" /></a>
            <a className="hover:text-primary" href="#" aria-label="GitHub"><Github className="size-5" /></a>
            <a className="hover:text-primary" href="#" aria-label="LinkedIn"><Linkedin className="size-5" /></a>
          </div>
        </div>
      </div>
      <div className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} LearnForge. Learn Without Limits.
      </div>
    </footer>
  );
}
