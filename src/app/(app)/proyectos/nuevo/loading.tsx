import { Skeleton } from "@/components/ui/skeleton";

export default function NuevoProyectoLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}
