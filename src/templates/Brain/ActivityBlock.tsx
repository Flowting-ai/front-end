'use client'

import React from 'react'
import { m } from 'framer-motion'
import {
  WorkflowSquareTenIcon,
  AlertCircleIcon,
  CheckmarkCircleTwoIcon,
  CancelCircleIcon,
} from '@strange-huge/icons'
import { Spinner } from '@/components/Spinner'
import { StreamingIndicator as ModelStreamingIndicator } from '@/components/StreamingIndicator'
import { getModelLlmId } from '@/lib/model-icons'
import { springs } from '@/lib/springs'
import { toConnector, type Connector } from '@/lib/connector'
import type { ActivityNode, StepStatus } from '@/lib/brain/run-view'

interface LiveStepCircleProps {
  status: StepStatus
  index:  number
}

function LiveStepCircle({ status, index }: LiveStepCircleProps) {
  const base: React.CSSProperties = {
    width:          28,
    height:         28,
    borderRadius:   '50%',
    flexShrink:     0,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
  }

  if (status === 'executing') {
    return <div style={base}><Spinner size={18} color="var(--neutral-600)" /></div>
  }
  if (status === 'complete') {
    return <div style={base}><CheckmarkCircleTwoIcon size={22} color="var(--color-tag-Green-text)" /></div>
  }
  if (status === 'failed') {
    return <div style={base}><CancelCircleIcon size={22} color="var(--color-tag-Red-text)" /></div>
  }
  if (status === 'skipped') {
    return (
      <div style={{
        ...base,
        border:     '1.5px dashed var(--neutral-200)',
        color:      'var(--neutral-300)',
        fontSize:   '12px',
        fontFamily: 'var(--font-body)',
        fontWeight: 500,
      }}>
        {'—'}
      </div>
    )
  }
  return (
    <div style={{
      ...base,
      border:     '1.5px solid var(--neutral-200)',
      color:      'var(--neutral-400)',
      fontSize:   '12px',
      fontFamily: 'var(--font-body)',
      fontWeight: 500,
    }}>
      {index + 1}
    </div>
  )
}

function ConnectorChip({ connector, used }: { connector: Connector; used: boolean }) {
  return (
    <span
      title={used ? `${connector.name} — used by this step` : `${connector.name} — available to this step`}
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        gap:             4,
        fontFamily:      'var(--font-body)',
        fontSize:        'var(--font-size-caption)',
        lineHeight:      'var(--line-height-caption)',
        color:           used ? 'var(--neutral-600)' : 'var(--neutral-400)',
        backgroundColor: used ? 'var(--neutral-100)' : 'transparent',
        border:          used ? '1px solid transparent' : '1px dashed var(--neutral-200)',
        borderRadius:    4,
        padding:         '1px 6px',
        opacity:         used ? 1 : 0.75,
        transition:      'opacity 150ms ease, background-color 150ms ease',
      }}
    >
      {connector.logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- brand asset, variable path prevents next/image static analysis
        <img
          src={connector.logo}
          alt=""
          width={12}
          height={12}
          style={{ objectFit: 'contain', display: 'block', flexShrink: 0 }}
        />
      ) : (
        <span aria-hidden style={{
          width:           12,
          height:          12,
          borderRadius:    3,
          backgroundColor: 'var(--neutral-200)',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          fontSize:        9,
          fontWeight:      600,
          color:           'var(--neutral-600)',
          textTransform:   'uppercase',
          flexShrink:      0,
        }}>
          {connector.name.charAt(0)}
        </span>
      )}
      {connector.name}
    </span>
  )
}

function NodeModelIndicator({ node }: { node: ActivityNode }) {
  const modelName = node.model?.name || 'Model'
  const llmId = getModelLlmId(node.model?.company, node.model?.name)
  const isWorking = node.status === 'executing'

  return (
    <ModelStreamingIndicator
      phase={isWorking ? 'streaming' : 'complete'}
      label={isWorking ? `${modelName} · Working…` : modelName}
      llmId={llmId ?? undefined}
      style={{ marginTop: 2 }}
    />
  )
}

function formatDuration(startedAt: string | null, completedAt: string | null): string | null {
  if (!startedAt || !completedAt) return null
  const ms = Date.parse(completedAt) - Date.parse(startedAt)
  if (!Number.isFinite(ms) || ms < 0) return null
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.round((ms % 60_000) / 1000)
  return `${minutes}m ${seconds}s`
}

const captionStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize:   'var(--font-size-caption)',
  lineHeight: 'var(--line-height-caption)',
}

interface LiveStepRowProps {
  node:   ActivityNode
  index:  number
  isLast: boolean
}

function LiveStepRow({ node, index, isLast }: LiveStepRowProps) {
  const isActive = node.status === 'executing'
  const isDone   = node.status === 'complete' || node.status === 'skipped'
  const isFailed = node.status === 'failed'
  const duration = formatDuration(node.startedAt, node.completedAt)
  const preview  = node.status === 'complete' ? node.resultPreview?.trim() : ''
  const declared = node.context.connectors
  const extraUsed = node.usedConnectors
    .filter((slug) => !declared.some((c) => c.slug === slug))
    .map((slug) => toConnector(slug))
  const chips = [...declared, ...extraUsed]

  return (
    <div style={{
      display:         'flex',
      gap:             10,
      backgroundColor: isActive ? 'var(--neutral-50)' : 'transparent',
      borderRadius:    isActive ? 12 : 0,
      padding:         isActive ? '4px 6px 4px 4px' : '0',
      margin:          isActive ? '0 -6px' : '0',
      transition:      'background-color 150ms ease',
    }}>
      <div style={{
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        flexShrink:    0,
        width:         28,
      }}>
        <LiveStepCircle status={node.status} index={index} />
        {!isLast && (
          <div style={{
            flex:            '1 0 0',
            width:           1,
            backgroundColor: isDone ? 'var(--neutral-300)' : 'var(--neutral-200)',
            marginTop:       4,
            minHeight:       12,
            transition:      'background-color 150ms ease',
          }} />
        )}
      </div>

      <div style={{
        flex:          '1 0 0',
        minWidth:      0,
        paddingTop:    4,
        paddingBottom: isLast ? 0 : 14,
        display:       'flex',
        flexDirection: 'column',
        gap:           3,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{
            fontFamily:  'var(--font-body)',
            fontSize:    'var(--font-size-body)',
            fontWeight:  isActive ? 'var(--font-weight-medium)' : 400,
            lineHeight:  'var(--line-height-body)',
            color:       isFailed
              ? 'var(--color-tag-Red-text)'
              : isDone
                ? 'var(--neutral-500)'
                : 'var(--neutral-800)',
            textDecoration: node.status === 'skipped' ? 'line-through' : 'none',
            transition:  'color 150ms ease',
          }}>
            {node.label}
          </span>
          {node.isCritical && isFailed && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <AlertCircleIcon size={12} color="var(--color-tag-Red-text)" />
              <span style={{ ...captionStyle, color: 'var(--color-tag-Red-text)' }}>Critical</span>
            </span>
          )}
          {duration && (
            <span style={{ ...captionStyle, color: 'var(--neutral-400)', marginLeft: 'auto' }}>
              {duration}
            </span>
          )}
        </div>

        {isActive && node.streamDetail && (
          <span style={{
            ...captionStyle,
            color:     'var(--neutral-400)',
            fontStyle: 'italic',
          }}>
            {node.streamDetail}
          </span>
        )}

        {node.model && <NodeModelIndicator node={node} />}

        {chips.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
            {chips.map((connector) => (
              <ConnectorChip
                key={connector.slug}
                connector={connector}
                used={node.usedConnectors.includes(connector.slug)}
              />
            ))}
          </div>
        )}

        {preview && (
          <span style={{
            ...captionStyle,
            color:             'var(--neutral-500)',
            display:           '-webkit-box',
            WebkitLineClamp:   2,
            WebkitBoxOrient:   'vertical',
            overflow:          'hidden',
            whiteSpace:        'pre-wrap',
            wordBreak:         'break-word',
          }}>
            {preview}
          </span>
        )}

        {isFailed && node.error && (
          <span style={{
            ...captionStyle,
            color:      'var(--color-tag-Red-text)',
            whiteSpace: 'pre-wrap',
            wordBreak:  'break-word',
          }}>
            {node.error}
          </span>
        )}
      </div>
    </div>
  )
}

export interface ActivityBlockProps {
  nodes:           ActivityNode[]
  interpretation?: string
}

export function ActivityBlock({ nodes, interpretation }: ActivityBlockProps) {
  const doneCount = nodes.filter((n) => n.status === 'complete' || n.status === 'skipped').length

  return (
    <m.div
      initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={springs.moderate}
      style={{
        display:       'flex',
        flexDirection: 'column',
        gap:           12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <WorkflowSquareTenIcon size={14} color="var(--neutral-400)" />
        <span style={{
          ...captionStyle,
          fontWeight: 'var(--font-weight-medium)',
          color:      'var(--neutral-600)',
        }}>
          Running
        </span>
        <span style={{ ...captionStyle, color: 'var(--neutral-500)', marginLeft: 'auto' }}>
          {doneCount} / {nodes.length}
        </span>
      </div>

      {interpretation && (
        <p style={{
          margin:     0,
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-body)',
          fontStyle:  'italic',
          color:      'var(--neutral-500)',
          lineHeight: 'var(--line-height-body)',
        }}>
          {interpretation}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {nodes.map((node, i) => (
          <LiveStepRow
            key={node.id}
            node={node}
            index={i}
            isLast={i === nodes.length - 1}
          />
        ))}
      </div>
    </m.div>
  )
}

ActivityBlock.displayName = 'ActivityBlock'
