import { Skeleton } from "@/components/ui/skeleton";

export default function EditarIteracionLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}
