import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, BookOpen, Award, Users, BarChart3, CheckCircle2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LMS Trainee Program — Premium Remote Training" },
      { name: "description", content: "Hands-on, structured remote training programs designed with the polish of a Fortune 500 product." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-mesh opacity-80" aria-hidden />
          <div className="relative mx-auto max-w-6xl px-6 pt-24 pb-32 text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <Sparkles className="h-3 w-3 text-primary" />
              New cohort opening — Data Analytics, 1 Month Remote
            </div>
            <h1 className="mt-8 font-display text-6xl leading-[1.05] sm:text-7xl md:text-8xl">
              <span className="text-gradient">Train like a professional.</span>
              <br />
              <span className="text-foreground/90">Build like an intern.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              A premium learning environment for remote internships and structured training programs — designed with the polish of Stripe, the focus of Linear, and the warmth of Notion.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="h-12 bg-gradient-brand px-6 text-white shadow-glow hover:opacity-90">
                <Link to="/auth" search={{ mode: "signup" }}>Start free <ArrowRight className="h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-6">
                <Link to="/auth">Sign in</Link>
              </Button>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">No credit card • Email verification • Certificate on completion</p>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t border-border/60 bg-surface">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <div className="max-w-2xl">
              <p className="text-sm font-medium text-primary">Built for serious learners</p>
              <h2 className="mt-2 font-display text-4xl md:text-5xl">An LMS that feels like a product, not a portal.</h2>
            </div>
            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {[
                { icon: BookOpen, t: "Structured curriculum", d: "Weeks → modules → lessons with objectives, resources, and assignments." },
                { icon: BarChart3, t: "Real progress", d: "Per-lesson completion, course progress, resume-where-you-left-off." },
                { icon: Award, t: "Verified certificates", d: "Premium printable certificates with unique serial numbers." },
                { icon: Users, t: "Cohort experience", d: "Designed to scale from a single trainee to entire programs." },
                { icon: Sparkles, t: "Polished UI", d: "Stripe-grade typography, motion, and micro-interactions." },
                { icon: CheckCircle2, t: "Migration-ready", d: "Schema mirrors Tutor LMS — bring your WordPress courses later." },
              ].map(({ icon: Icon, t, d }) => (
                <div key={t} className="group rounded-2xl border border-border/60 bg-card p-6 shadow-sm transition hover:shadow-md">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 font-display text-2xl">{t}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Program */}
        <section id="program" className="relative overflow-hidden border-t border-border/60">
          <div className="absolute inset-0 bg-mesh opacity-60" aria-hidden />
          <div className="relative mx-auto max-w-6xl px-6 py-24 text-center">
            <h2 className="font-display text-5xl">Data Analytics — 1 Month Remote Training</h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">Four weeks. Twenty lessons. Three capstone projects. One certificate.</p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {["Analytics Foundations","SQL & Databases","Python & Statistics","Visualization & Storytelling"].map((w, i) => (
                <div key={w} className="rounded-2xl border border-border/60 bg-card/80 p-6 text-left backdrop-blur">
                  <div className="text-xs font-mono text-muted-foreground">Week 0{i+1}</div>
                  <div className="mt-2 font-display text-xl">{w}</div>
                  <div className="mt-3 text-xs text-muted-foreground">5 lessons • assignments • resources</div>
                </div>
              ))}
            </div>
            <Button asChild size="lg" className="mt-10 h-12 bg-gradient-brand px-6 text-white shadow-glow hover:opacity-90">
              <Link to="/auth" search={{ mode: "signup" }}>Enroll now <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </section>
      </main>
      <footer className="border-t border-border/60 py-10">
        <div className="mx-auto max-w-6xl px-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} LMS Trainee Program. Crafted as a premium ed-tech experience.
        </div>
      </footer>
    </div>
  );
}
