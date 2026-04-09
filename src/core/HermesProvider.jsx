import { createContext, useContext, useEffect, useState } from 'react';

export const HermesContext = createContext(undefined);

export const HermesProvider = ({ children }) => {
  const [state, setState] = useState({
    budgetMode: 'BALANCED',
    tokensSaved: 0,
    lastAction: 'Hermes OS v1.0 Initialized',
    metrics: null,
    thinkingStream: [],
  });

  const setBudgetMode = (mode) => {
    setState(s => ({ ...s, budgetMode: mode, lastAction: `Manual Mode: ${mode}` }));
  };

  const logThinking = (msg) => {
    setState((s) => ({
      ...s,
      thinkingStream: [...s.thinkingStream, { message: msg, timestamp: new Date().toISOString() }],
    }));
    console.log(`[Thinking]: ${msg}`);
  };

  const { budgetMode, lastAction } = state;

  // AUTO-STEERING ENGINE
  useEffect(() => {
    const action = lastAction.toLowerCase();
    let targetMode = budgetMode;

    if (action.includes('manual mode')) return; // Respekter manuelle valg

    if (action.match(/(refactor|complex|architecture|multiple files|heavy|deep)/)) {
      targetMode = 'OVERCLOCK';
    } else if (action.match(/(typo|style|minor|read signature|simple|fix)/)) {
      targetMode = 'ECONOMY';
    } else if (action.includes('initialized') || action.includes('idle')) {
      targetMode = 'BALANCED';
    }

    if (targetMode !== budgetMode) {
      setState(s => ({ ...s, budgetMode: targetMode, lastAction: `Auto-Steered to ${targetMode}` }));
    }
  }, [budgetMode, lastAction]);

  return (
    <HermesContext.Provider value={{ state, setBudgetMode, logThinking }}>
      {children}
    </HermesContext.Provider>
  );
};

export const useHermes = () => {
  const context = useContext(HermesContext);
  if (!context) throw new Error('useHermes must be used within HermesProvider');
  return context;
};

// Vi injicerer en log-funktion i state for Thinking Stream
// (Dette er en hurtig hack for at vise logikken - vi rydder op senere)
export const useThinkingStream = () => {
  const { logThinking } = useHermes();
  return { logThinking };
};
