export function StepIndicator({
  step,
  total,
  title,
}: {
  step: number;
  total: number;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Paso {step + 1} de {total}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${((step + 1) / total) * 100}%` }}
        />
      </div>
      <h2 className="font-heading text-xl font-semibold">{title}</h2>
    </div>
  );
}
