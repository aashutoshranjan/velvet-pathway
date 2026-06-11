import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateProfile } from "@/lib/lms.functions";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — LMS Trainee Program" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const updateFn = useServerFn(updateProfile);

  const { data, isLoading } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name, headline").eq("id", user.id).maybeSingle();
      return data;
    },
  });

  const [fullName, setFullName] = useState("");
  const [headline, setHeadline] = useState("");

  useEffect(() => {
    if (data) {
      setFullName(data.full_name ?? "");
      setHeadline(data.headline ?? "");
    }
  }, [data]);

  const mut = useMutation({
    mutationFn: () => updateFn({ data: { full_name: fullName, headline } }),
    onSuccess: () => {
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="font-display text-5xl">Profile</h1>
      <p className="mt-2 text-sm text-muted-foreground">Manage your account details.</p>

      <form
        onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}
        className="mt-8 space-y-5 rounded-2xl border border-border/60 bg-card p-6 shadow-sm"
      >
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={user.email ?? ""} disabled />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={isLoading} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="headline">Headline</Label>
          <Textarea id="headline" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Aspiring data analyst" rows={2} />
        </div>
        <Button type="submit" disabled={mut.isPending} className="bg-gradient-brand text-white">
          {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
        </Button>
      </form>
    </main>
  );
}
