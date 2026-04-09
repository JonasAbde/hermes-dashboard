import React from 'react';
import { HermesProvider } from './HermesProvider';

export const RootProvider = ({ children }) => {
  return <HermesProvider>{children}</HermesProvider>;
};
