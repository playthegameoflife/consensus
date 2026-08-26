interface LogoProps {
  size?: number
  withWordmark?: boolean
  className?: string
}

export function Logo({ size = 28, withWordmark = false, className = "" }: LogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className="rounded-[7px] flex items-center justify-center font-bold text-white"
        style={{
          width: size,
          height: size,
          background: "linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)",
          fontSize: size * 0.55,
          fontFamily: "Inter, sans-serif",
        }}
      >
        C
      </div>
      {withWordmark && (
        <span className="font-semibold text-[15px] text-slate-800 tracking-tight">
          Consensus
        </span>
      )}
    </div>
  )
}
