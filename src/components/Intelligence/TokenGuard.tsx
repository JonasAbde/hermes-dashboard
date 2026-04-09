import React from 'react';
import { useHermes, BudgetMode } from '../../core/HermesProvider';

export const TokenGuard: React.FC = () => {
  const { state, setBudgetMode } = useHermes();
  
  const modes: BudgetMode[] = ['ECONOMY', 'BALANCED', 'OVERCLOCK'];

  return (
    <div className="p-4 bg-slate-900 rounded-lg border border-slate-700 text-white shadow-xl">
      <h3 className="text-sm font-bold mb-3 flex items-center">
        <span className="mr-2">🛡️</span> HERMES TOKEN GUARD
      </h3>
      <div className="flex gap-2">
        {modes.map(mode => (
          <button
            key={mode}
            onClick={() => setBudgetMode(mode)}
            className={`px-3 py-1 text-xs rounded transition-all ${
              state.budgetMode === mode 
                ? 'bg-blue-600 border-blue-400 border shadow-[0_0_10px_rgba(37,99,235,0.5)]' 
                : 'bg-slate-800 border-transparent hover:bg-slate-700'
            }`}
          >
            {mode}
          </button>
        ))}
      </div>
      
      <div className="mt-4 pt-3 border-t border-slate-800">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[10px] text-slate-400">TOTAL SAVINGS</span>
          <span className="text-xs font-mono text-emerald-400 font-bold">
            ${state.metrics?.usdSaved.toFixed(2) || '0.00'}
          </span>
        </div>
        <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
          <div 
            className="bg-emerald-500 h-full transition-all duration-1000" 
            style={{ width: `${Math.min((state.metrics?.compressionRatio || 0) * 100, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-slate-500">TOKENS: {state.metrics?.totalTokensSaved.toLocaleString() || '0'}</span>
          <span className="text-[9px] text-slate-500">RATIO: {((state.metrics?.compressionRatio || 0) * 100).toFixed(1)}%</span>
        </div>
      </div>

      <div className="mt-4 text-[10px] text-slate-400 font-mono">
        STATUS: {state.lastAction}
      </div>
    </div>
  );
};
