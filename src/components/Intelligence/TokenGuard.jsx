import React, { useState, useEffect } from 'react';
import { useHermes } from '../../core/HermesProvider';
import { fetchLeanMetrics } from '../../services/leanStats';

export const TokenGuard = () => {
  const { state, setBudgetMode } = useHermes();
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    fetchLeanMetrics().then(setMetrics);
    const interval = setInterval(() => fetchLeanMetrics().then(setMetrics), 30000);
    return () => clearInterval(interval);
  }, []);

  const modes = ['ECONOMY', 'BALANCED', 'OVERCLOCK'];
  const ratio = metrics?.compressionRatio || 0;
  const ratioPct = (ratio * 100).toFixed(1);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border-b border-slate-700 text-white text-xs">
      <span className="font-bold text-slate-400 tracking-widest">HERMES</span>
      <div className="flex gap-1">
        {modes.map(mode => (
          <button
            key={mode}
            onClick={() => setBudgetMode(mode)}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
              state.budgetMode === mode
                ? 'bg-blue-600 text-white shadow-[0_0_8px_rgba(59,130,246,0.6)]'
                : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
            }`}
          >
            {mode}
          </button>
        ))}
      </div>
      {metrics && (
        <div className="flex items-center gap-2 ml-2 border-l border-slate-700 pl-2">
          <span className="text-emerald-400 font-mono font-bold">${metrics.usdSaved.toFixed(2)}</span>
          <span className="text-slate-500 text-[9px]">{ratioPct}%</span>
          <div className="w-16 h-1 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${ratioPct}%` }} />
          </div>
        </div>
      )}
      <span className="text-slate-600 text-[9px] font-mono ml-auto hidden sm:block">
        {state.lastAction}
      </span>
    </div>
  );
};
