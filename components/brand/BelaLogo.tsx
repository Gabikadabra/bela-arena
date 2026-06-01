type BelaLogoProps = {
  compact?: boolean;
  className?: string;
};

export default function BelaLogo({ compact = false, className = "" }: BelaLogoProps) {
  return (
    <div className={`relative flex items-center gap-3 ${className}`}>
      <div className="brand-mark">
        <span className="brand-mark-corner brand-mark-corner-left">A</span>
        <span className="brand-mark-main">BA</span>
        <span className="brand-mark-corner brand-mark-corner-right">♣</span>
      </div>

      {!compact && (
        <div className="leading-tight">
          <p className="text-lg font-black text-[#f5f0e8]">Bela Arena</p>
          <p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-[#b9a78a]">turniri · rezultati</p>
        </div>
      )}
    </div>
  );
}
