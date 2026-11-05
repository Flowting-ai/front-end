'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/Button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import type { CustomMetric, MetricChatMessage, MetricUnit } from '@/lib/api/warehouse'
import { useDraftMetric, usePutMetric } from '@/lib/warehouse/queries'
import styles from './Dashboard.module.css'

const UNIT_LABELS: Record<MetricUnit, string> = { money: 'Money', count: 'Count', ratio: 'Percent' }

export interface MetricEditorProps {
  onClose: () => void
}

/** A one-off conversation: say what to measure, answer what Souvenir asks, add the metric it proposes. */
export function MetricEditor({ onClose }: MetricEditorProps) {
  const [messages, setMessages] = useState<MetricChatMessage[]>([])
  const [text, setText] = useState('')
  const [proposal, setProposal] = useState<CustomMetric | null>(null)
  const draft = useDraftMetric()
  const put = usePutMetric()
  const logEnd = useRef<HTMLDivElement>(null)
  const busy = draft.isPending || put.isPending

  useEffect(() => { logEnd.current?.scrollIntoView({ block: 'end' }) }, [messages, proposal])

  const send = async () => {
    const content = text.trim()
    if (content === '' || busy) return
    const next = [...messages, { role: 'user' as const, content }]
    setMessages(next)
    setText('')
    try {
      const answer = await draft.mutateAsync(next)
      setMessages([...next, { role: 'assistant', content: answer.reply }])
      setProposal(answer.metric)
    } catch (error) {
      setMessages(messages)
      setText(content)
      toast.error(error instanceof Error ? error.message : 'Souvenir did not answer')
    }
  }

  const add = async () => {
    if (proposal === null) return
    try {
      await put.mutateAsync(proposal)
      toast.success(`${proposal.label} added`)
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The warehouse refused the metric')
    }
  }

  return (
    <Dialog open onOpenChange={next => { if (!next && !busy) onClose() }}>
      <DialogContent size="md" style={{ padding: 24, gap: 20 }}>
        <div>
          <DialogTitle>Add a metric</DialogTitle>
          <DialogDescription className={styles.emptyText} style={{ margin: '8px 0 0' }}>
            Say what you want to measure. Souvenir asks when it needs to, then proposes the metric.
          </DialogDescription>
        </div>
        {(messages.length > 0 || proposal) && (
          <div className={styles.chat} role="log" aria-live="polite">
            {messages.map((message, index) => (
              <div key={index} className={styles.chatTurn} data-role={message.role}>{message.content}</div>
            ))}
            {proposal && (
              <div className={styles.proposal}>
                <div className={styles.proposalTop}>
                  <span className={styles.proposalLabel}>{proposal.label}</span>
                  <span className={styles.proposalMeta}>{UNIT_LABELS[proposal.unit]} · {proposal.name}</span>
                </div>
                <span className={styles.emptyText}>{proposal.description}</span>
                <pre className={styles.proposalValue}>{JSON.stringify(proposal.value)}</pre>
              </div>
            )}
            <div ref={logEnd} />
          </div>
        )}
        <div className={styles.composer}>
          <textarea
            className={styles.composerInput}
            value={text}
            rows={1}
            autoFocus
            placeholder={messages.length === 0 ? 'Shipping as a share of revenue' : 'Reply, or ask for a change'}
            aria-label="Describe the metric"
            disabled={busy}
            onChange={event => setText(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send() } }}
          />
          <Button variant="secondary" loading={draft.isPending} disabled={text.trim() === '' || busy} onClick={() => { void send() }}>Send</Button>
        </div>
        <div className={styles.formFooter}>
          <Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button disabled={proposal === null || busy} loading={put.isPending} onClick={() => { void add() }}>Add metric</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
