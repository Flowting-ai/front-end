"use client"

import React, { useState } from "react"
import { Check, Copy, FileText, Inbox, Paperclip, PencilLine, Send } from "lucide-react"
import { Button } from "@/components/Button"
import { Badge, type BadgeColor } from "@/components/Badge"
import { MarkdownRenderer } from "@/lib/markdown-utils"
import { parseEmailXml, splitSender } from "./XmlEmail.parse"
import { ChatWidgetShell } from "./ChatWidgetShell"
import styles from "./ChatWidget.module.css"

const STATUS = {
  draft: { label: "Draft", color: "Yellow", icon: PencilLine },
  sent: { label: "Sent", color: "Green", icon: Send },
  received: { label: "Received", color: "Neutral", icon: Inbox },
} satisfies Record<string, { label: string; color: BadgeColor; icon: typeof Inbox }>

export function XmlEmail({ xml }: { xml: string }) {
  const email = React.useMemo(() => parseEmailXml(xml), [xml])
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  if (!email) return null
  const status = STATUS[email.status]
  const Icon = status.icon
  const sender = splitSender(email.from)
  const name = sender.name || sender.address || "Unknown sender"
  const initials = name.replace(/@.*$/, "").split(/[\s._-]+/).slice(0, 2).map(word => word[0]).join("").toUpperCase()

  async function copyBody() {
    try {
      await navigator.clipboard.writeText(email!.body)
      setCopied(true)
      setCopyError(false)
    } catch {
      setCopyError(true)
    }
  }

  return (
    <ChatWidgetShell title={email.subject || "(no subject)"} eyebrow="Email" icon={<Icon size={18} />}
      actions={<><Badge label={status.label} color={status.color} />
        {email.status === "draft" && email.body && <Button type="button" variant="secondary" size="sm" onClick={copyBody} leftIcon={copied ? <Check size={14} /> : <Copy size={14} />}>{copied ? "Copied" : "Copy draft"}</Button>}</>}>
      <div className={styles.sender}>
        <span className={styles.avatar} aria-hidden="true">{initials}</span>
        <div style={{ minWidth: 0, flex: 1, overflowWrap: "anywhere" }}>
          <div className={styles.title}>{name}</div>
          {sender.name && sender.address && <div className={styles.caption}>{sender.address}</div>}
          <div className={`${styles.recipients} ${styles.caption}`}>
            {([['To', email.to], ['Cc', email.cc], ['Bcc', email.bcc]] as const).map(([label, value]) => value && <span key={label}>{label}: {value}</span>)}
          </div>
          {email.date && <div className={styles.caption} style={{ marginTop: 6 }}>{email.date}</div>}
        </div>
      </div>
      {email.body && <div className={styles.body}>
        <div style={{ maxHeight: expanded ? undefined : 260, overflow: expanded ? undefined : "auto" }} className="kaya-scrollbar"><MarkdownRenderer content={email.body} /></div>
        <Button type="button" variant="ghost" size="sm" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} style={{ marginTop: 8 }}>{expanded ? "Collapse message" : "Expand message"}</Button>
        {copyError && <p role="status" className={styles.caption}>Couldn’t copy. Select the message text to copy it manually.</p>}
      </div>}
      {email.attachments.length > 0 && <div className={styles.attachments}>
        <span className={styles.caption} style={{ width: "100%", display: "flex", gap: 6, alignItems: "center" }}><Paperclip size={14} />{email.attachments.length} {email.attachments.length === 1 ? "attachment" : "attachments"}</span>
        {email.attachments.map((attachment, index) => <span className={styles.attachment} key={`${attachment.name}-${index}`}><FileText size={16} style={{ flexShrink: 0 }} /><span>{attachment.name}</span>{attachment.size && <span className={styles.caption}>{attachment.size}</span>}</span>)}
      </div>}
    </ChatWidgetShell>
  )
}
