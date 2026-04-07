export function getActionGuardrail(action) {
  if (!action) return null

  if (action.type === 'agent-status' && action.nextStopped === true) {
    return {
      severity: 'danger',
      title: 'Stop Hermes agent?',
      description: 'This pauses new automated Hermes work until you explicitly start the agent again.',
      consequence: 'Running dashboard views stay available, but operator-triggered automation and background execution will remain paused.',
      confirmLabel: 'Stop agent',
    }
  }

  if (action.type === 'api' && action.target === '/api/control/gateway/restart') {
    return {
      severity: 'danger',
      title: 'Restart Hermes gateway?',
      description: 'The gateway will restart immediately and active webhook or transport traffic can drop for a few seconds.',
      consequence: 'Use this when the gateway is stale or unhealthy. It does not modify Hermes memory or dashboard-owned recommendation state.',
      confirmLabel: 'Restart gateway',
    }
  }

  if (action.type === 'neural-shift' && action.rhythm === 'hibernation') {
    return {
      severity: 'warn',
      title: 'Shift Hermes to Hibernation?',
      description: 'Hibernation lowers activity and can make the system feel unresponsive until you switch back.',
      consequence: 'Choose this only when you intentionally want Hermes to stay quiet.',
      confirmLabel: 'Enter hibernation',
    }
  }

  if (action.type === 'neural-shift' && action.rhythm === 'high_burst') {
    return {
      severity: 'warn',
      title: 'Shift Hermes to High Burst?',
      description: 'High Burst favors speed and can increase runtime load or cost.',
      consequence: 'Use it for short periods when throughput matters more than stability or spend.',
      confirmLabel: 'Enable High Burst',
    }
  }

  return null
}
