interface ConsensusMeterProps {
  score: number; // -1 to 1
  total?: number;
  compact?: boolean;
}

export function ConsensusMeter({ score, total, compact = false }: ConsensusMeterProps) {
  const pct = ((score + 1) / 2) * 100; // normalize -1..1 to 0..100

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${
              score > 0.5 ? "bg-emerald-500" : score < -0.3 ? "bg-red-500" : "bg-slate-400"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {total !== undefined && (
          <span className="text-xs text-slate-400">{total} papers</span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">Consensus</span>
        <span
          className={`font-semibold ${
            score > 0.5
              ? "text-emerald-600"
              : score < -0.3
              ? "text-red-600"
              : "text-slate-500"
          }`}
        >
          {score > 0.5 ? "Agrees" : score < -0.3 ? "Disagrees" : "Mixed"}
        </span>
      </div>
      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            score > 0.5 ? "bg-emerald-500" : score < -0.3 ? "bg-red-500" : "bg-slate-400"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {total !== undefined && (
        <p className="text-xs text-slate-400">{total} papers analyzed</p>
      )}
    </div>
  );
}
