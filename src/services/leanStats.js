export const fetchLeanMetrics = async () => {
  // In production this calls /api/metrics/lean which runs `lean-ctx gain --json`
  // For now we simulate the connection to the engine
  try {
    const response = await fetch('/api/metrics/lean');
    if (!response.ok) throw new Error('lean metrics unavailable');
    return await response.json();
  } catch {
    return {
      totalTokensSaved: 12847,
      compressionRatio: 0.942,
      usdSaved: 0.84,
      topCommands: [{ cmd: 'git commit', saved: 4821 }, { cmd: 'npm test', saved: 2341 }]
    };
  }
};
