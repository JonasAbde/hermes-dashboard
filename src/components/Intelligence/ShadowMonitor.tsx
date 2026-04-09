import React, { useState, useEffect } from 'react';
import { analyzeCodebase, CodeIssue, getHealthScore } from '../../services/shadowAnalyzer';

export const ShadowMonitor: React.FC = () => {
  const [issues, setIssues] = useState<CodeIssue[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    const runScan = async () => {
      setIsScanning(true);
      const result = await analyzeCodebase();
      setIssues(result);
      setIsScanning(false);
    };
    runScan();
  }, []);

  const score = getHealthScore(issues);
  const color = score > 80 ? 'text-emerald-400' : score > 50 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-2xl w-64">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isScanning ? 'bg-yellow-400 animate-pulse' : 'bg-emerald-400'}`} />
            SHADOW ENGINE
          </span>
          <span className={`text-sm font-mono font-bold ${color}`}>{score}%</span>
        </div>
        <div className="text-[10px] text-slate-500 space-y-1">
          <div>ISSUES: <span className="text-slate-300">{issues.length}</span></div>
          <div className="text-emerald-500">AUTO-FIX: ACTIVE</div>
        </div>
      </div>
    </div>
  );
};
