export interface LeanMetrics {
  totalTokensSaved: number;
  compressionRatio: number;
  usdSaved: number;
  topCommands: Array<{cmd: string, saved: number}>;
}

export const fetchLeanMetrics = async (): Promise<LeanMetrics> => {
  // I produktion vil dette kalde /api/metrics/lean som kører 'lean-ctx gain --json'
  // For nu simulerer vi forbindelsen til motoren
  try {
    const response = await fetch('/api/metrics/lean');
    if (!response.ok) throw new Error('Failed to fetch lean metrics');
    return await response.json();
  } catch (e) {
    return {
      totalTokensSaved: 0,
      compressionRatio: 0,
      usdSaved: 0,
      topCommands: []
    };
  }
};
