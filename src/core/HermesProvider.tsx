import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchLeanMetrics, LeanMetrics } from '../services/leanStats';

export type BudgetMode = 'ECONOMY' | 'BALANCED' | 'OVERCLOCK';

interface HermesState {
  budgetMode: BudgetMode;
  tokensSaved: number;
  lastAction: string;
}

const HermesContext = createContext<{
  state: HermesState;
  setBudgetMode: (mode: BudgetMode) => void;
} | undefined>(undefined);

export const HermesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<HermesState>({
    budgetMode: 'BALANCED',
    tokensSaved: 0,
    lastAction: 'Hermes OS Initialized',
    metrics: null as LeanMetrics | null,
  });

  const setBudgetMode = (mode: BudgetMode) => {
    setState(s => ({ ...s, budgetMode: mode, lastAction: `Mode changed to ${mode}` }));
  };

  return (
    <HermesContext.Provider value={{ state, setBudgetMode }}>
      {children}
    </HermesContext.Provider>
  );
};

export const useHermes = () => {
  const context = useContext(HermesContext);
  if (!context) throw new Error('useHermes must be used within a HermesProvider');
  return context;
};
