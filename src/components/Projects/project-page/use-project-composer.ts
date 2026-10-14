'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AGENT_SELECT_EVENT } from '@/components/AgentsPanel'
import type { SelectedPersonaInfo } from '@/components/chat/AddMenu'
import type { PendingAttachment } from '@/components/chat/AttachmentManager'
import { useModelSelectorContext } from '@/context/model-selector-context'
import { publishActiveChatAgent } from '@/lib/active-chat-agent-store'
import { pickDefaultModel } from '@/lib/ai-models'
import { trackFeature } from '@/lib/analytics/events'
import type { PinFolder } from '@/lib/api/pins'
import { emitProjectNewChat } from '@/hooks/use-sidebar-events'
import { PROJECT_CHAT_NEW_ROUTE } from '@/lib/routes'

/**
 * The project page's "start a new chat" composer: draft text, attachments, web search, style,
 * pin folders and the attached agent. Sending hands off to the project's new-chat route. The screen
 * is keyed by project id, so all of this starts fresh on every project.
 */
export function useProjectComposer(projectId: string) {
  const { push } = useRouter()
  const { setPersonaActive, models, selectModel } = useModelSelectorContext()
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<PendingAttachment[]>([])
  const [webSearch, setWebSearch] = useState(false)
  const [styleId, setStyleId] = useState<string | null>(null)
  const [folders, setFolders] = useState<PinFolder[]>([])
  const [persona, setPersona] = useState<SelectedPersonaInfo | null>(null)

  // An attached agent locks the model selector.
  useEffect(() => { setPersonaActive(!!persona) }, [persona, setPersonaActive])

  // This page always starts a new chat: reset the model to the default tier on arrival, as /chat
  // does, so a model picked in a previous chat does not carry over. Picks made here afterwards stay.
  useEffect(() => {
    const defaultModel = pickDefaultModel(models)
    if (defaultModel) selectModel(defaultModel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tell the Agents panel which agent is attached, so it offers "Replace agent".
  useEffect(() => { publishActiveChatAgent(persona?.id ?? null) }, [persona])
  useEffect(() => () => publishActiveChatAgent(null), [])

  // The Agents panel renders in the app shell, outside this tree, and announces a pick by event.
  useEffect(() => {
    const handler = (e: Event) => {
      const picked = (e as CustomEvent<SelectedPersonaInfo>).detail
      if (!picked) return
      setPersona(picked)
      trackFeature('project_agent_attached', { persona_id: picked.id })
    }
    window.addEventListener(AGENT_SELECT_EVENT, handler)
    return () => window.removeEventListener(AGENT_SELECT_EVENT, handler)
  }, [])

  const toggleFolder = (folder: PinFolder) =>
    setFolders(prev => prev.some(f => f.id === folder.id) ? prev.filter(f => f.id !== folder.id) : [...prev, folder])

  function send(message: string) {
    if (!message.trim() && !attachments.length) return
    if (persona) sessionStorage.setItem('project-chat-pending-persona', JSON.stringify(persona))
    else sessionStorage.removeItem('project-chat-pending-persona')
    if (attachments.length > 0) {
      ;(window as unknown as { __pendingProjectChatFiles?: File[] }).__pendingProjectChatFiles = attachments.map(a => a.file)
      setAttachments([])
    }
    const q = message.trim()
    // Alongside the push (see PROJECT_NEW_CHAT_EVENT): a mounted project chat page that believes it
    // is already on the "new" URL would otherwise ignore a push to the same URL.
    emitProjectNewChat({ projectId })
    push(PROJECT_CHAT_NEW_ROUTE(projectId) + (q ? `?q=${encodeURIComponent(q)}` : ''))
    setText('')
  }

  return {
    text, setText,
    attachments, setAttachments,
    webSearch, setWebSearch,
    styleId, setStyleId,
    folders, setFolders, toggleFolder,
    persona, setPersona,
    send,
  }
}

export type ProjectComposerState = ReturnType<typeof useProjectComposer>
