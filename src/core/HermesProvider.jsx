import React, { createContext, useContext, useState } from 'react';

export const HermesContext = createContext(undefined);

export const HermesProvider = ({ children }) => {
  const [state, setState] = useState({
    budgetMode: 'BALANCED',
    tokensSaved: 0,
    lastAction: 'Hermes OS v1.0 Initialized',
    metrics: null,
  });

    const setBudgetMode = (mode) => {
    setState(s => ({ ...s, budgetMode: mode, lastAction: `Manual Mode: ${mode}` }));
  };

  // AUTO-STEERING ENGINE
  useEffect(() => {
    const action = state.lastAction.toLowerCase();
    let targetMode = state.budgetMode;

    if (action.includes('manual mode')) return; // Respekter manuelle valg

    if (action.match(/(refactor|complex|architecture|multiple files|heavy|deep)/)) {
      targetMode = 'OVERCLOCK';
    } else if (action.match(/(typo|style|minor|read signature|simple|fix)/)) {
      targetMode = 'ECONOMY';
    } else if (action.includes('initialized') || action.includes('idle')) {
      targetMode = 'BALANCED';
    }

    if (targetMode !== state.budgetMode) {
      setState(s => ({ ...s, budgetMode: targetMode, lastAction: `Auto-Steered to ${targetMode}` }));
    }
  }, [state.lastAction]);

  return (
    <HermesContext.Provider value={{ state, setBudgetMode }}>
      {children}
    </HermesContext.Provider>
  );
};

export const useHermes = () => {
  const context = useContext(HermesContext);
  if (!context) throw new Error('useHermes must be used within HermesProvider');
  return context;
};
