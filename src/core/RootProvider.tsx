import React from 'react';
import { HermesProvider } from './HermesProvider';

export const RootProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <HermesProvider>
      {children}
    </HermesProvider>
  );
};
