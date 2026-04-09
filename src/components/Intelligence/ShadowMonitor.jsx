import React, { useState } from 'react';
import { getHealthScore } from '../../services/shadowAnalyzer';

export const ShadowMonitor = () => {
  const [issues] = useState([]);
  const [scanning] = useState(false);
  const score = getHealthScore(issues);
  const color = score > 80 ? 'text-emerald-400' : score > 50 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="fixed bottom-4 right-4 z-[9999] backdrop-blur-md bg-slate-900/80">
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-2xl w-56">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${scanning ? 'bg-yellow-400 animate-pulse' : 'bg-emerald-400'}`} />
            SHADOW ENGINE
          </span>
          <span className={`text-sm font-mono font-bold ${color}`}>{score}%</span>
        </div>
        <div className="text-[9px] text-slate-600 space-y-0.5">
          <div>ISSUES QUEUED: <span className="text-slate-400 font-mono">{issues.length}</span></div>
          <div className="text-emerald-600">AUTO-FIX: ARMED</div>
        </div>
      </div>
    </div>
  );
};
