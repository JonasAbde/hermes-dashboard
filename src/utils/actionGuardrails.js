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

  // Support /api/control/gateway/restart and /api/control/services/hermes-gateway/restart
  if (action.type === 'api' && (action.target === '/api/control/gateway/restart' || action.target?.includes('hermes-gateway/restart'))) {
    return {
      severity: 'danger',
      title: 'Restart Hermes gateway?',
      description: 'The gateway will restart immediately and active webhook or transport traffic can drop for a few seconds.',
      consequence: 'Use this when the gateway is stale or unhealthy. It does not modify Hermes memory or dashboard-owned recommendation state.',
      confirmLabel: 'Restart gateway',
    }
  }

  if (action.type === 'service' && action.action === 'stop') {
    return {
      severity: 'danger',
      title: `Stop ${action.service}?`,
      description: `You are about to stop the ${action.service} service.`,
      consequence: 'This may cause immediate connectivity loss or disruption of background tasks depending on the service.',
      confirmLabel: `Stop ${action.service}`,
    }
  }

  if (action.type === 'service' && action.action === 'restart') {
    return {
      severity: 'warn',
      title: `Restart ${action.service}?`,
      description: `Restarting ${action.service} will temporarily interrupt its operations.`,
      consequence: 'Clients and dependents might experience transient errors or disconnects.',
      confirmLabel: `Restart ${action.service}`,
    }
  }

  if (action.type === 'fleet-agent' && action.action === 'stop') {
    return {
      severity: 'danger',
      title: `Stop agent ${action.agent}?`,
      description: `Stopping agent ${action.agent} will halt its execution.`,
      consequence: 'Any active work handled by this agent will be interrupted.',
      confirmLabel: `Stop agent`,
    }
  }

  if (action.type === 'cron-job' && action.action === 'delete') {
    return {
      severity: 'danger',
      title: `Delete job "${action.job}"?`,
      description: `This will permanently delete the cron job "${action.job}".`,
      consequence: 'The job will no longer be scheduled or executed. This action cannot be undone.',
      confirmLabel: `Delete job`,
    }
  }

  if (action.type === 'memory-compact') {
    return {
      severity: 'warn',
      title: 'Compact memory?',
      description: 'This will condense MEMORY.md and related context files. A backup will be saved automatically.',
      consequence: 'Running this frequently isn\'t necessary unless memory consumption is unusually high.',
      confirmLabel: 'Compact memory',
    }
  }

  if (action.type === 'memory-entry' && action.action === 'delete') {
    return {
      severity: 'danger',
      title: 'Delete memory entry?',
      description: 'Are you sure you want to remove this entry?',
      consequence: 'The agent will no longer refer to this entry for context. This cannot be undone.',
      confirmLabel: 'Delete entry',
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
