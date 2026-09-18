const StatsCard = ({ icon, label, value, sub, color = 'blue', loading = false }) => {
  const isRed = ['rose', 'amber', 'red'].includes(color);

  if (loading) {
    return (
      <div className="stat-card animate-pulse">
        <div className="w-10 h-10 bg-[#F0F4FC] rounded-xl mb-4" />
        <div className="h-8 w-20 bg-[#F0F4FC] rounded-lg mb-3" />
        <div className="h-3 w-28 bg-[#F0F4FC] rounded-full" />
      </div>
    );
  }

  return (
    <div className="stat-card group">
      {/* Icon */}
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 ${
        isRed
          ? 'bg-red-50 text-brand-red'
          : 'bg-[#EEF2FF] text-brand-blue'
      }`}>
        {icon}
      </div>

      {/* Value */}
      <p className={`text-4xl font-black leading-none tracking-tight mb-2 ${
        isRed ? 'text-brand-red' : 'text-brand-blue'
      }`}>
        {value ?? '—'}
      </p>

      {/* Label */}
      <p className="text-xs font-semibold text-[#8A97B0] uppercase tracking-wider">{label}</p>
      {sub && <p className="text-[11px] text-[#A0AECB] mt-1">{sub}</p>}

      {/* Bottom accent line */}
      <div className={`absolute bottom-0 left-0 h-0.5 w-0 group-hover:w-full transition-all duration-500 rounded-b-2xl ${
        isRed ? 'bg-brand-red' : 'bg-brand-blue'
      }`} />
    </div>
  );
};

export default StatsCard;
