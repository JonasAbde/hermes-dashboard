// API Stats Field Mapping Configuration
// Centralized mapping of Python API response fields to frontend components
// with their appropriate fallback values and display types

export const STATS_FIELD_MAPPINGS = {
  // Stats Header fields
  sessions_today: {
    displayName: 'Sessions i dag',
    fallback: 0,
    type: 'integer',
    component: 'StatCard'
  },
  sessions_week: {
    displayName: 'Sessions denne uge',
    fallback: 0,
    type: 'integer',
    component: 'StatCard'
  },
  tokens_today: {
    displayName: 'Tokens i dag',
    fallback: null,
    type: 'number',
    component: 'StatCard'
  },
  cache_pct: {
    displayName: 'Cache-percent',
    fallback: '—',
    type: 'percentage',
    component: 'StatCard'
  },
  cache_read_tokens: {
    displayName: 'Cache read tokens',
    fallback: 0,
    type: 'integer',
    component: 'StatCard'
  },
  io_tokens: {
    displayName: 'IO tokens',
    fallback: 0,
    type: 'integer',
    component: 'StatCard'
  },
  cost_month: {
    displayName: 'Cost måneden',
    fallback: null,
    type: 'currency',
    component: 'StatCard'
  },
  budget: {
    displayName: 'Budget',
    fallback: '25.00',
    type: 'currency',
    component: 'StatCard'
  },

  // Session fields
  actual_cost_usd: {
    displayName: 'Actual cost USD',
    fallback: 0,
    type: 'currency',
    component: 'SessionTableRow'
  },
  estimated_cost_usd: {
    displayName: 'Estimated cost USD',
    fallback: 0,
    type: 'currency',
    component: 'SessionTableRow'
  },
  total_cost: {
    displayName: 'Total cost',
    fallback: 0,
    type: 'currency',
    component: 'SessionTableRow'
  },

  // Memory fields
  memory_pct: {
    displayName: 'Memory-percent',
    fallback: '—',
    type: 'percentage',
    component: 'StatCard'
  },
  memory_kb: {
    displayName: 'Memory KB',
    fallback: 0,
    type: 'integer',
    component: 'StatCard'
  },

  // Latency fields
  avg_latency_s: {
    displayName: 'Average latency (s)',
    fallback: null,
    type: 'duration',
    component: 'StatCard'
  },
  avg_latency_ms: {
    displayName: 'Average latency (ms)',
    fallback: null,
    type: 'duration',
    component: 'EkGChart'
  },
  p95_latency_ms: {
    displayName: 'P95 latency (ms)',
    fallback: null,
    type: 'duration',
    component: 'EkGChart'
  },

  // Array fields
  recent_sessions: {
    displayName: 'Recent sessions',
    fallback: [],
    type: 'array',
    component: 'SessionTableRow'
  },
  daily_costs: {
    displayName: 'Daily costs',
    fallback: [],
    type: 'array',
    component: 'CostChart'
  },
  points: {
    displayName: 'EKG points',
    fallback: [],
    type: 'array',
    component: 'EkGChart'
  },
  recent_latencies: {
    displayName: 'Recent latencies',
    fallback: [],
    type: 'array',
    component: 'EkGChart'
  },

  // Other fields
  grid: {
    displayName: 'Heatmap grid',
    fallback: null,
    type: 'matrix',
    component: 'Heatmap'
  },
  last_beat: {
    displayName: 'Last beat timestamp',
    fallback: null,
    type: 'timestamp',
    component: 'EkGChart'
  }
};

/**
 * Get the default value for a stats field
 * @param {string} field - The field name
 * @returns {*} The fallback value
 */
export const getStatsFieldFallback = (field) => {
  return STATS_FIELD_MAPPINGS[field]?.fallback;
};

/**
 * Get the display name for a stats field
 * @param {string} field - The field name
 * @returns {string} The display name
 */
export const getStatsFieldDisplayName = (field) => {
  return STATS_FIELD_MAPPINGS[field]?.displayName || field;
};

/**
 * Get the type for a stats field
 * @param {string} field - The field name
 * @returns {string} The field type
 */
export const getStatsFieldType = (field) => {
  return STATS_FIELD_MAPPINGS[field]?.type || 'unknown';
};

/**
 * Validate that all required fields exist in the stats object
 * @param {Object} stats - The stats object to validate
 * @returns {Object} Validation result
 */
export const validateStatsFields = (stats) => {
  const requiredFields = ['sessions_today', 'sessions_week', 'tokens_today', 'cost_month'];
  const missingFields = requiredFields.filter(field => !(field in stats));

  return {
    isValid: missingFields.length === 0,
    hasData: Object.values(stats).some(
      v => v !== null && v !== undefined && v !== ''
    ),
    missingFields,
    stats
  };
};

/**
 * Safe access to stats with fallback
 * @param {Object} stats - The stats object
 * @param {string} field - The field name
 * @param {*} defaultValue - The default value (defaults to field's configured fallback)
 * @returns {*} The field value or default
 */
export const safeStatsAccess = (stats, field, defaultValue) => {
  const fallback = defaultValue !== undefined
    ? defaultValue
    : getStatsFieldFallback(field);

  if (!stats) {
    return fallback;
  }

  const value = stats[field];
  return value !== null && value !== undefined && value !== ''
    ? value
    : fallback;
};

/**
 * Format a stats value according to its type
 * @param {*} value - The value to format
 * @param {string} type - The value type (integer, number, currency, percentage, duration, etc.)
 * @returns {string} Formatted value
 */
export const formatStatsValue = (value, type) => {
  if (value === null || value === undefined || value === '') {
    return getStatsFieldFallback('placeholder') || '—';
  }

  switch (type) {
    case 'currency':
      return typeof value === 'number'
        ? `$${value.toFixed(2)}`
        : typeof value === 'string'
          ? value
          : '—';

    case 'percentage':
      return typeof value === 'number'
        ? `${value}%`
        : typeof value === 'string'
          ? value
          : '—';

    case 'duration':
      return typeof value === 'number'
        ? `${value.toFixed(1)}s`
        : typeof value === 'string'
          ? value
          : '—';

    case 'integer':
      return typeof value === 'number'
        ? value.toString()
        : typeof value === 'string'
          ? value
          : '—';

    case 'number':
      return typeof value === 'number'
        ? (value / 1000).toFixed(1) + 'k'
        : typeof value === 'string'
          ? value
          : '—';

    default:
      return String(value);
  }
};

/**
 * Get all known stats field names
 * @returns {string[]} Array of field names
 */
export const getAllStatsFields = () => {
  return Object.keys(STATS_FIELD_MAPPINGS);
};
