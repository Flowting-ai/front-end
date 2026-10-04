export type StepStatus = 'pending' | 'upcoming' | 'executing' | 'complete' | 'failed' | 'skipped'

export interface ConnectorRequirement {
  name:         string
  logoUrl?:     string
  description?: string
  isConnected:  boolean
  onConnect?:   () => void
}

export interface AgentStep {
  id:                  string
  label:               string
  handle?:             string
  imageUrl?:           string
  isCritical:          boolean
  status:              StepStatus
  /** Present when the agent stopped before producing a complete answer. */
  error?:               string
  requiresConnector?:  ConnectorRequirement
  /** What the run asked this agent for. */
  rationale?:          string
  /** Connectors the agent has reached — shown as "via X" chips once touched. */
  connectorDisclosure?: string[]
  /** Live detail shown while the agent is working. */
  streamDetail?:        string
}
