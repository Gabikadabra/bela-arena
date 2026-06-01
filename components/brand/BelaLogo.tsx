type BelaLogoProps = {
  compact?: boolean;
  className?: string;
};

export default function BelaLogo({ compact = false, className = "" }: BelaLogoProps) {
  return (
    <div className={`relative flex items-center gap-3 ${className}`}>
      <div className="relative grid h-12 w-12 place-items-center rounded-[1.15rem] border border-[#d4b06a]/35 bg-gradient-to-br from-[#f3dfad] via-[#d4b06a] to-[#8a6427] text-[#071810] shadow-[0_0_32px_rgba(212,176,106,0.24)]">
        <span className="absolute -left-1 -top-1 grid h-5 w-5 place-items-center rounded-md bg-[#071810] text-[11px] font-black text-[#f3dfad] shadow-lg">A</span>
        <span className="text-xl font-black tracking-[-0.12em]">BA</span>
        <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-md bg-[#b11f24] text-[11px] font-black text-white shadow-lg">♣</span>
      </div>

      {!compact && (
        <div className="leading-tight">
          <p className="text-lg font-black text-[#f3dfad]">Bela Arena</p>
          <p className="text-[0.65rem] font-black uppercase tracking-[0.28em] text-[#d4b06a]/70">karte · turniri · rezultati</p>
        </div>
      )}
    </div>
  );
}
