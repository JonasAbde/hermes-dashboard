export const getHealthScore = (issues) => {
  if (!issues || issues.length === 0) return 100;
  const weight = { low: 1, medium: 3, high: 5 };
  const total = issues.reduce((sum, i) => sum + (weight[i.severity] || 0), 0);
  return Math.max(0, 100 - total);
};
