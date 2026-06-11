import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { GraduationCap, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function Header({ variant = "marketing" }: { variant?: "marketing" | "app" }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    router.invalidate();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-brand shadow-sm">
            <GraduationCap className="h-4 w-4 text-white" />
          </div>
          <span className="font-display text-xl">LMS Trainee Program</span>
        </Link>
        {variant === "app" ? (
          <nav className="hidden items-center gap-1 md:flex">
            <Link to="/dashboard" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition hover:text-foreground" activeProps={{ className: "text-foreground bg-secondary" }}>Dashboard</Link>
            <Link to="/courses" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition hover:text-foreground" activeProps={{ className: "text-foreground bg-secondary" }}>Programs</Link>
            <Link to="/profile" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition hover:text-foreground" activeProps={{ className: "text-foreground bg-secondary" }}>Profile</Link>
          </nav>
        ) : (
          <nav className="hidden items-center gap-6 md:flex">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Home</Link>
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground">Features</a>
            <a href="#program" className="text-sm text-muted-foreground hover:text-foreground">Program</a>
          </nav>
        )}
        <div className="flex items-center gap-2">
          {user ? (
            <>
              {variant === "marketing" && (
                <Button asChild size="sm" variant="ghost"><Link to="/dashboard">Dashboard</Link></Button>
              )}
              <Button size="sm" variant="ghost" onClick={signOut}><LogOut className="h-4 w-4" />Sign out</Button>
            </>
          ) : (
            <>
              <Button asChild size="sm" variant="ghost"><Link to="/auth">Sign in</Link></Button>
              <Button asChild size="sm" className="bg-gradient-brand text-white shadow-sm hover:opacity-90"><Link to="/auth" search={{ mode: "signup" }}>Get started</Link></Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
