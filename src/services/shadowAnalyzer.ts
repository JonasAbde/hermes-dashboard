import { LeanMetrics } from './leanStats';

export interface CodeIssue {
  id: string;
  file: string;
  line?: number;
  severity: 'low' | 'medium' | 'high';
  type: 'size' | 'duplication' | 'performance' | 'deprecated';
  description: string;
  suggestedFix?: string;
  autoFixable: boolean;
}

export const analyzeCodebase = async (): Promise<CodeIssue[]> => {
  const issues: CodeIssue[] = [];
  return issues;
};

export const getHealthScore = (issues: CodeIssue[]): number => {
  const weight = { low: 1, medium: 3, high: 5 };
  const total = issues.reduce((sum, i) => sum + weight[i.severity], 0);
  return Math.max(0, 100 - total);
};
