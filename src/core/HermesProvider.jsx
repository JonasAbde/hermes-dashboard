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
    setState(s => ({ ...s, budgetMode: mode, lastAction: `Mode: ${mode}` }));
  };

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
