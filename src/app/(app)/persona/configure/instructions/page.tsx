'use client'

import React, { useState, Suspense } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeftOneIcon,
  MoreVerticalIcon,
  QuillWriteOneIcon,
  ArrowUpRightOneIcon,
  AtomOneIcon,
  ArrowDownOneIcon,
  StarIcon,
  PlusSignIcon,
  CancelOneIcon,
  ExpandIcon,
} from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { ChatInput } from '@/components/ChatInput'
import { EnhancePromptField } from '@/components/EnhancePromptField'

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = ['Instructions', 'Profile', 'Knowledge base', 'Connectors', 'Sharing'] as const
type Tab = (typeof TABS)[number]

// Tabs with muted colour (not yet configured / lower priority)
const MUTED_TABS = new Set<Tab>(['Knowledge base', 'Connectors', 'Sharing'])

function getTemperatureLabel(v: number): string {
  if (v <= 0.12) return 'Very Precise'
  if (v <= 0.37) return 'Precise'
  if (v <= 0.62) return 'Balanced'
  if (v <= 0.87) return 'Creative'
  return 'Very Creative'
}

// ── Floating menu ─────────────────────────────────────────────────────────────

function FloatingMenu({
  testChatOpen,
  onToggleTestChat,
}: {
  testChatOpen: boolean
  onToggleTestChat: () => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        backgroundColor: 'var(--neutral-white)',
        borderRadius: 12,
        padding: '4px 4px 6px',
        boxShadow:
          '0px 1.091px 1.091px 0px rgba(59,54,50,0.05), 0px 1.455px 3.127px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-200)',
        position: 'relative',
      }}
    >
      {/* Inner bottom edge shadow */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          boxShadow: 'inset 0px -2.182px 0.364px 0px var(--neutral-100)',
          pointerEvents: 'none',
        }}
      />

      {/* Icon 1 — toggles test chat panel */}
      <button
        onClick={onToggleTestChat}
        title={testChatOpen ? 'Close test chat' : 'Open test chat'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 6,
          borderRadius: 8,
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          backgroundColor: testChatOpen ? 'rgba(237,225,215,0.6)' : 'transparent',
          boxShadow: testChatOpen
            ? '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(182,172,164,0.4)'
            : 'none',
          transition: 'background-color 150ms, box-shadow 150ms',
        }}
      >
        {testChatOpen && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 'inherit',
              boxShadow:
                'inset 0px 1px 0px 0px rgba(247,242,237,0.61), inset 0px -1px 0px 0px rgba(106,98,93,0.05)',
              pointerEvents: 'none',
            }}
          />
        )}
        <AtomOneIcon size={20} color="var(--neutral-700)" />
      </button>

      {/* Icon 2 */}
      <button
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 6,
          borderRadius: 8,
          border: 'none',
          cursor: 'pointer',
          backgroundColor: 'transparent',
        }}
      >
        <MoreVerticalIcon size={20} color="var(--neutral-700)" />
      </button>

      {/* Icon 3 — dimmed */}
      <button
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 6,
          borderRadius: 8,
          border: 'none',
          cursor: 'pointer',
          backgroundColor: 'transparent',
          opacity: 0.7,
        }}
      >
        <StarIcon size={20} color="var(--neutral-700)" />
      </button>
    </div>
  )
}

// ── Main page content ─────────────────────────────────────────────────────────

function PersonaConfigureInstructionsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const personaName = searchParams.get('name') ?? ''
  const [activeTab, setActiveTab] = useState<Tab>('Instructions')
  const [instruction, setInstruction] = useState('')
  const [temperature, setTemperature] = useState(0)
  const [testChatOpen, setTestChatOpen] = useState(false)

  const hasContent = instruction.trim().length > 0

  return (
    <div
      style={{
        display: 'flex',
        gap: 7,
        alignItems: 'stretch',
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
    >
      {/* ── Left configure panel ─────────────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: 'rgba(255,255,255,0.2)',
          border: '1px solid var(--neutral-200)',
          borderRadius: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          overflow: 'hidden',
          paddingBottom: 12,
          paddingTop: 10,
          paddingLeft: 12,
          paddingRight: 12,
          height: '100%',
          flex: '1 0 0',
          minWidth: 0,
        }}
      >
        {/* ── Top navigation bar ────────────────────────────────────────────── */}
        <div style={{ flexShrink: 0, width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: 36,
            }}
          >
            {/* Back arrow */}
            <div style={{ flexShrink: 0 }}>
              <IconButton
                variant="ghost"
                size="md"
                icon={<ArrowLeftOneIcon size={20} />}
                aria-label="Go back"
                onClick={() => router.back()}
              />
            </div>

            {/* Tabs */}
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'flex-start', flexShrink: 0 }}>
              {/* Beige pill background */}
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 10,
                  backgroundColor: 'rgba(247,242,237,0.5)',
                  boxShadow:
                    'inset 0px -1px 0px 0px rgba(255,255,255,0.9), inset 0px 1px 0px 0px var(--neutral-100), inset 0px 0px 4px 0px rgba(209,198,189,0.5)',
                }}
              />
              <div style={{ position: 'relative', display: 'flex', gap: 4, alignItems: 'center' }}>
                {TABS.map(tab => {
                  const isActive = activeTab === tab
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '7px 8px',
                        borderRadius: 10,
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: isActive ? 'var(--neutral-white)' : 'transparent',
                        boxShadow: isActive
                          ? '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100), inset 0px -1px 0px 0px rgba(38,33,30,0.1)'
                          : 'none',
                        fontFamily: 'var(--font-body)',
                        fontWeight: 500,
                        fontSize: 14,
                        lineHeight: '22px',
                        color: isActive
                          ? 'var(--blue-600)'
                          : MUTED_TABS.has(tab)
                          ? 'var(--neutral-500)'
                          : 'var(--neutral-700)',
                        whiteSpace: 'nowrap',
                        transition: 'background-color 150ms, box-shadow 150ms, color 150ms',
                        position: 'relative',
                      }}
                    >
                      {isActive && (
                        <div
                          aria-hidden
                          style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: 'inherit',
                            boxShadow: 'inset 0px -1px 0px 0px rgba(38,33,30,0.1)',
                            pointerEvents: 'none',
                          }}
                        />
                      )}
                      {tab}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
              <IconButton
                variant="outline"
                size="md"
                icon={<MoreVerticalIcon size={20} />}
                aria-label="More options"
              />
              {testChatOpen ? (
                <IconButton
                  variant="outline"
                  size="md"
                  icon={<QuillWriteOneIcon size={20} />}
                  aria-label="Save version"
                />
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<QuillWriteOneIcon size={16} />}
                >
                  Save version
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                disabled={!hasContent}
                rightIcon={<ArrowUpRightOneIcon size={16} />}
              >
                Publish
              </Button>
            </div>
          </div>

          {/* Spacer below nav */}
          <div style={{ height: 32, flexShrink: 0 }} />
        </div>

        {/* ── Scrollable content area ────────────────────────────────────────── */}
        <div
          className="kaya-scrollbar"
          style={{
            flex: '1 0 0',
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
              width: '100%',
              maxWidth: 714,
            }}
          >
            {/* ── Persona header ─────────────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              {/* Avatar placeholder */}
              <div
                style={{
                  width: 65,
                  height: 65,
                  borderRadius: 8,
                  flexShrink: 0,
                  backgroundColor: 'var(--neutral-100)',
                  boxShadow:
                    '0px 1.091px 1.09px 0px rgba(59,54,50,0.05), 0px 1.455px 1px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100)',
                  overflow: 'hidden',
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p
                  style={{
                    fontFamily: 'var(--font-title)',
                    fontWeight: 400,
                    fontSize: 24,
                    lineHeight: '32px',
                    color: 'var(--neutral-900)',
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 220,
                  }}
                >
                  {personaName || 'Persona Name'}
                </p>
                {/* Private badge */}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2px',
                    borderRadius: 6,
                    alignSelf: 'flex-start',
                    backgroundColor: 'var(--neutral-100)',
                    boxShadow:
                      '0px 1px 1.5px 0px rgba(18,12,8,0.2), 0px 0px 0px 1px rgba(106,98,93,0.5)',
                    position: 'relative',
                  }}
                >
                  <div
                    aria-hidden
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: 'inherit',
                      boxShadow:
                        'inset 0px 1px 0px 0px rgba(247,242,237,0.7), inset 0px -1px 0px 0px rgba(106,98,93,0.1)',
                      pointerEvents: 'none',
                    }}
                  />
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontWeight: 500,
                      fontSize: 11,
                      lineHeight: '16px',
                      color: 'var(--neutral-700)',
                      padding: '0 2px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Private
                  </span>
                </div>
              </div>
            </div>

            {/* ── Model dropdown ─────────────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  fontSize: 14,
                  lineHeight: '22px',
                  color: '#0a0a0a',
                }}
              >
                Model
              </span>
              <button
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  border: '1px solid var(--neutral-200)',
                  borderRadius: 6,
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: '1 0 0', minWidth: 0 }}>
                  <AtomOneIcon size={20} color="var(--neutral-700)" />
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontWeight: 500,
                      fontSize: 14,
                      lineHeight: '22px',
                      color: 'var(--neutral-700)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    OpenAI: Gpt 5
                  </span>
                </div>
                <ArrowDownOneIcon size={20} color="var(--neutral-700)" />
              </button>
            </div>

            {/* ── System instruction ─────────────────────────────────────────── */}
            <EnhancePromptField
              value={instruction}
              onChange={setInstruction}
            />

            {/* ── Temperature slider ─────────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 400,
                    fontSize: 14,
                    lineHeight: '22px',
                    color: '#0a0a0a',
                  }}
                >
                  Creativity level (Temperature)
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 500,
                    fontSize: 14,
                    lineHeight: '22px',
                    color: '#0a0a0a',
                  }}
                >
                  {getTemperatureLabel(temperature)}
                </span>
              </div>

              {/* Custom slider — blue fill, small thumb to match Figma */}
              <div
                style={{
                  position: 'relative',
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: 'white',
                  cursor: 'pointer',
                }}
              >
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: 0,
                    width: `${temperature * 100}%`,
                    backgroundColor: 'var(--blue-600)',
                    borderRadius: 2,
                    pointerEvents: 'none',
                  }}
                />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={temperature}
                  onChange={e => setTemperature(parseFloat(e.target.value))}
                  aria-label="Creativity level"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer',
                    margin: 0,
                  }}
                />
                {/* Thumb indicator */}
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: `${temperature * 100}%`,
                    transform: 'translate(-50%, -50%)',
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: 'var(--blue-600)',
                    pointerEvents: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 500,
                    fontSize: 11,
                    lineHeight: '16px',
                    color: 'var(--neutral-800)',
                  }}
                >
                  0 (Precise &amp; consistent)
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 400,
                    fontSize: 11,
                    lineHeight: '16px',
                    color: 'var(--neutral-700)',
                  }}
                >
                  (Creative &amp; varied) 1
                </span>
              </div>
            </div>

            {/* ── Example conversations ──────────────────────────────────────── */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 12,
                height: 56,
                border: '1px dashed var(--neutral-300)',
                borderRadius: 16,
                backgroundColor: 'var(--neutral-50)',
                boxShadow:
                  '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  fontSize: 14,
                  lineHeight: '22px',
                  color: '#0a0a0a',
                }}
              >
                Example conversations (optional)
              </span>
              <IconButton
                variant="outline"
                size="sm"
                icon={<PlusSignIcon size={20} />}
                aria-label="Add example conversation"
              />
            </div>

            {/* Bottom breathing room */}
            <div style={{ height: 24, flexShrink: 0 }} />
          </div>
        </div>
      </div>

      {/* ── Test chat panel (slides in from right) ─────────────────────────── */}
      <AnimatePresence>
        {testChatOpen && (
          <motion.div
            key="test-chat"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34, mass: 0.9 }}
            style={{
              flex: '1 0 0',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              height: '100%',
              backgroundColor: 'var(--neutral-white)',
              border: '1px solid var(--neutral-200)',
              borderRadius: 22,
              padding: 12,
              overflow: 'hidden',
            }}
          >
            {/* Chat panel header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    flexShrink: 0,
                    backgroundColor: 'var(--neutral-100)',
                    boxShadow: '0px 0px 0px 1px rgba(59,54,50,0.3)',
                    overflow: 'hidden',
                  }}
                />
                <p
                  style={{
                    fontFamily: 'var(--font-title)',
                    fontWeight: 400,
                    fontSize: 24,
                    lineHeight: '32px',
                    color: '#1a1916',
                    margin: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Name
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <div style={{ opacity: 0.7 }}>
                  <Button
                    variant="outline"
                    size="sm"
                    rightIcon={<ArrowDownOneIcon size={16} />}
                  >
                    Mock connector
                  </Button>
                </div>
                <IconButton
                  variant="outline"
                  size="md"
                  icon={<ExpandIcon size={20} />}
                  aria-label="Expand test chat"
                />
                <IconButton
                  variant="outline"
                  size="md"
                  icon={<CancelOneIcon size={20} />}
                  aria-label="Close test chat"
                  onClick={() => setTestChatOpen(false)}
                />
              </div>
            </div>

            {/* Messages area */}
            <div
              className="kaya-scrollbar"
              style={{
                flex: '1 0 0',
                minHeight: 0,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 400,
                  fontSize: 16,
                  lineHeight: '22px',
                  color: 'var(--neutral-600)',
                  margin: 0,
                }}
              >
                Hi! I&apos;m your persona. Test me here while you configure.
              </p>
            </div>

            {/* Chat input */}
            <div style={{ flexShrink: 0 }}>
              <ChatInput
                placeholder="Test your persona..."
                textareaLabel="Test message"
                modelName="Souvenir"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floating vertical menu ────────────────────────────────────────────
           When chat is closed: absolutely positioned on right edge.
           When chat is open: inline between the two panels.            ── */}
      {testChatOpen ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <FloatingMenu testChatOpen={testChatOpen} onToggleTestChat={() => setTestChatOpen(v => !v)} />
        </div>
      ) : (
        <div
          style={{
            position: 'absolute',
            right: 22,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 10,
          }}
        >
          <FloatingMenu testChatOpen={testChatOpen} onToggleTestChat={() => setTestChatOpen(v => !v)} />
        </div>
      )}
    </div>
  )
}

// ── Page export ───────────────────────────────────────────────────────────────

export default function PersonaConfigureInstructionsPage() {
  return (
    <Suspense>
      <PersonaConfigureInstructionsContent />
    </Suspense>
  )
}
