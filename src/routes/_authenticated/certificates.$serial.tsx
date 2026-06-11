import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Award, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/certificates/$serial")({
  head: () => ({ meta: [{ title: "Certificate — LMS Trainee Program" }] }),
  component: CertificatePage,
});

function CertificatePage() {
  const { serial } = Route.useParams();
  const { user } = Route.useRouteContext();
  const { data, isLoading } = useQuery({
    queryKey: ["cert", serial],
    queryFn: async () => {
      const { data: cert } = await supabase.from("certificates").select("*, courses(title, duration_label)").eq("serial", serial).single();
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      return { cert, profile };
    },
  });

  if (isLoading || !data?.cert) return <main className="mx-auto max-w-5xl p-10"><Skeleton className="h-96 rounded-2xl" /></main>;

  const issued = new Date(data.cert.issued_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex justify-end print:hidden">
        <Button onClick={() => window.print()} variant="outline"><Printer className="h-4 w-4" /> Print / Save PDF</Button>
      </div>
      <div className="relative aspect-[1.414/1] overflow-hidden rounded-2xl border border-border/60 bg-card shadow-lg print:border-0 print:shadow-none">
        <div className="absolute inset-0 bg-mesh opacity-40" />
        <div className="absolute inset-4 rounded-xl border-2 border-primary/30" />
        <div className="absolute inset-8 rounded-lg border border-border/50" />
        <div className="relative flex h-full flex-col items-center justify-center px-16 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-brand text-white shadow-glow">
            <Award className="h-7 w-7" />
          </div>
          <div className="mt-4 text-xs uppercase tracking-[0.3em] text-muted-foreground">Certificate of Completion</div>
          <p className="mt-6 text-sm text-muted-foreground">This is to certify that</p>
          <h1 className="mt-3 font-display text-6xl text-gradient">{data.profile?.full_name ?? "Trainee"}</h1>
          <p className="mt-4 text-sm text-muted-foreground">has successfully completed the program</p>
          <h2 className="mt-2 font-display text-3xl">{data.cert.courses.title}</h2>
          <div className="mt-10 flex w-full max-w-md items-end justify-between text-xs">
            <div className="text-left">
              <div className="font-mono text-muted-foreground">Issued</div>
              <div className="mt-1 font-medium">{issued}</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-muted-foreground">Serial</div>
              <div className="mt-1 font-medium">{data.cert.serial}</div>
            </div>
          </div>
          <div className="mt-8 text-[10px] uppercase tracking-widest text-muted-foreground">LMS Trainee Program</div>
        </div>
      </div>
    </main>
  );
}
