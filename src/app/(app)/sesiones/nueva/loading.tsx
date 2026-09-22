import { Skeleton } from "@/components/ui/skeleton";

export default function NuevaSesionLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6">
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-40 w-full" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>
    </div>
  );
}
