'use client'

import React, { Suspense } from 'react'
import { PlusSignIcon, AlertTwoIcon } from '@strange-huge/icons'
import { Button } from '@/components/ui/button'
import { can } from '@/lib/agent-permissions'
import { patchableVersionId } from '@/lib/agent-model-health'
import { revokeShare } from '@/lib/api/persona-shares'
import { forgetShare } from '@/lib/share/share-queries'
import { AGENTS_NEW_ROUTE, AGENT_EDIT_ROUTE } from '@/lib/routes'
import Tabs from '@/components/Tabs'
import { EMPTY_FILTERS } from './_hooks/use-agent-filters'
import { AgentsToolbar } from './_components/AgentsToolbar'
import { AgentsGrid } from './_components/AgentsGrid'
import { DeleteAgentDialog } from './_components/DeleteAgentDialog'
import { SuperLinksTab } from './_components/SuperLinksTab'
import { AgentDetailsSidebar } from '@/components/AgentEditor/AgentDetailsSidebar'
import { SuperLinkDrawer } from '@/components/SuperLinkDrawer'
import dynamic from 'next/dynamic'

// Modals are only needed after a user action — keep them out of the list route's first chunk.
const AgentShareModal = dynamic(() => import('@/components/AgentShareModal').then(m => m.AgentShareModal), { ssr: false })
const ChangeAgentModelModal = dynamic(() => import('@/components/ChangeAgentModelModal').then(m => m.ChangeAgentModelModal), { ssr: false })
const FixAgentModelsModal = dynamic(() => import('@/components/FixAgentModelsModal').then(m => m.FixAgentModelsModal), { ssr: false })
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────────────────────

type TabId = 'my-personas' | 'super-links'

/** Reads `?tab=` — anything missing or unrecognized falls back to "My Agents". */

// ── Page ──────────────────────────────────────────────────────────────────────

import { useAgentsPage } from './_hooks/use-agents-page'

function PersonasPageInner() {
  const { push, viewer, activeTab, setActiveTab, detailsId, openDetails, closeDetails, queryClient, isLoading, personas, setPersonas, draftAvatarMap, draftTagsMap, deleteTarget, setDeleteTarget, changeModelTarget, setChangeModelTarget, fixModelsOpen, setFixModelsOpen, fixModelsMounted, selectedShareId, setSelectedShareId, shareTarget, setShareTarget, versionToPersona, shares, selectedDrawerLink, personaByRepoId, activeShareRepoIds, visibilityForPersona, createdByForPersona, resolveModelName, modelUnavailableReason, isDraftLike, visiblePersonas, unavailableAgents, personasScrollRef, dashboard, sharesLoading, dashboardRefreshing, handleRefreshDashboard, slRange, setSlRange, slDays, receivedShares, receivedLoading, search, setSearch, sort, setSort, filters, setFilters, activeFilterCount, toggleFilter, uniqueModelNames, filtered, pausingIds, handleDelete, handleCopyAndEdit, handleUseInChat, handleUseTeamSharedInChat, handleUseReceivedShareInChat, handlePauseToggle } = useAgentsPage()

  return (
    <>
      <div
        style={{
          background: 'var(--color-surface-container)',
          border: '1px solid var(--border-default)',
          borderRadius: 22,
          flex: '1 1 0',
          minHeight: 0,
          overflow: 'hidden',
          padding: 3,
        }}
      >
      <div
        ref={personasScrollRef}
        className="kaya-scrollbar"
        style={{
          height: '100%',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          paddingTop: 36,
          paddingBottom: 24,
          boxSizing: 'border-box',
        }}
      >
        {/* Horizontal padding lives here, not on the scrolling element above —
            keeps the scrollbar flush with the card's edge. */}
        <div style={{
          width: '100%',
          maxWidth: 991,
          padding: '0 12px',
          boxSizing: 'border-box',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 41,
        }}>

          {/* ── Header + Tabs + Toolbar ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Tabs — always on top */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)}>
              <Tabs.List>
                <Tabs.Trigger value="my-personas">My Agents</Tabs.Trigger>
                <Tabs.Trigger value="super-links">Super Links</Tabs.Trigger>
              </Tabs.List>
            </Tabs>

            {/* Title row — changes per tab */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h1 style={{
                fontFamily: 'var(--font-title)',
                fontWeight: 'var(--font-weight-regular)',
                fontSize: 24,
                lineHeight: '32px',
                color: 'var(--legacy-1a1916)',
                margin: 0,
              }}>
                {activeTab === 'super-links' ? 'Super Links' : 'Agents'}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Super Links' own "Generate link" trigger now lives with the
                    links list section below (where it's contextually useful),
                    instead of being duplicated here too. */}
                {activeTab === 'super-links' ? null : (
                  <>
                    {/* Only appears when something is actually broken — a
                        standing button here would read as a permanent chore. */}
                    {unavailableAgents.length > 0 && (
                      <Button
                        variant="secondary"
                        leftIcon={<AlertTwoIcon size={16} color="var(--color-tag-Yellow-text)" />}
                        onClick={() => setFixModelsOpen(true)}
                      >
                        {unavailableAgents.length === 1
                          ? 'Fix 1 agent'
                          : `Fix ${unavailableAgents.length} agents`}
                      </Button>
                    )}
                    <Button
                      variant="default"
                      leftIcon={<PlusSignIcon size={16} />}
                      onClick={() => push(AGENTS_NEW_ROUTE)}
                    >
                      New agent
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Toolbar — only shown on My Personas tab */}
            {activeTab === 'my-personas' && (
              <AgentsToolbar
                search={search}
                setSearch={setSearch}
                sort={sort}
                setSort={setSort}
                filters={filters}
                setFilters={setFilters}
                activeFilterCount={activeFilterCount}
                toggleFilter={toggleFilter}
                uniqueModelNames={uniqueModelNames}
              />
            )}
          </div>

          {/* ── Persona grid ── */}
          {activeTab === 'my-personas' && (
            <AgentsGrid
              scrollRef={personasScrollRef}
              isLoading={isLoading}
              filtered={filtered}
              search={search}
              activeFilterCount={activeFilterCount}
              onClearFilters={() => setFilters(EMPTY_FILTERS)}
              onCreateAgent={() => push(AGENTS_NEW_ROUTE)}
              viewer={viewer}
              activeShareRepoIds={activeShareRepoIds}
              visibilityForPersona={visibilityForPersona}
              createdByForPersona={createdByForPersona}
              draftAvatarMap={draftAvatarMap}
              draftTagsMap={draftTagsMap}
              isDraftLike={isDraftLike}
              modelUnavailableReason={modelUnavailableReason}
              resolveModelName={resolveModelName}
              pausingIds={pausingIds}
              handleCopyAndEdit={handleCopyAndEdit}
              handleUseTeamSharedInChat={handleUseTeamSharedInChat}
              handleUseInChat={handleUseInChat}
              handlePauseToggle={handlePauseToggle}
              onOpenDetails={openDetails}
              onEdit={(id) => push(AGENT_EDIT_ROUTE(id))}
              onShare={setShareTarget}
              onChangeModel={setChangeModelTarget}
              onDelete={setDeleteTarget}
            />
          )}

          {/* ── Recommended for you ── (hidden) */}

          {/* ── Super Links tab ── */}
          {activeTab === 'super-links' && (
            <SuperLinksTab
              dashboard={dashboard}
              sharesLoading={sharesLoading}
              dashboardRefreshing={dashboardRefreshing}
              onRefreshDashboard={handleRefreshDashboard}
              slRange={slRange}
              setSlRange={setSlRange}
              slDays={slDays}
              shares={shares}
              receivedShares={receivedShares}
              receivedLoading={receivedLoading}
              versionToPersona={versionToPersona}
              personaByRepoId={personaByRepoId}
              visiblePersonas={visiblePersonas}
              setSelectedShareId={setSelectedShareId}
              setShareTarget={setShareTarget}
              setDeleteTarget={setDeleteTarget}
              onBrowseAgents={() => setActiveTab('my-personas')}
              onUseReceivedShareInChat={handleUseReceivedShareInChat}
            />
          )}

        </div>
      </div>
      </div>

      {/* ── Agent details (right sidebar) ── */}
      <AgentDetailsSidebar
        repoId={detailsId}
        canEdit={(() => {
          const target = personas.find(p => p.id === detailsId)
          // Unknown yet (e.g. just created, list still refreshing): the panel
          // loads the agent itself, and an agent that isn't the viewer's never loads.
          return target ? can(viewer, 'edit', target) : true
        })()}
        onClose={closeDetails}
      />

      {/* ── Share modal ── */}
      {shareTarget && (
        <AgentShareModal
          open
          repoId={shareTarget.repoId}
          agentName={shareTarget.name}
          onClose={() => setShareTarget(null)}
        />
      )}

      {/* ── Super Link drawer ── */}
      <SuperLinkDrawer
        link={selectedDrawerLink}
        onClose={() => setSelectedShareId(null)}
        onStatusChange={async (next) => {
          if (next === 'revoked' && selectedShareId) {
            const id = selectedShareId
            try {
              await revokeShare(id)
              forgetShare(queryClient, id)
              setSelectedShareId(null)
              toast.success('Super Link revoked')
            } catch {
              toast.error('Failed to revoke link')
            }
          }
        }}
      />

      {/* ── Change model — single card ── */}
      {changeModelTarget && patchableVersionId(changeModelTarget) && (
        <ChangeAgentModelModal
          // Fresh instance per agent — the picker's selection is per-agent state.
          key={changeModelTarget.id}
          open
          onClose={() => setChangeModelTarget(null)}
          personaId={changeModelTarget.id}
          versionId={patchableVersionId(changeModelTarget)!}
          agentName={changeModelTarget.name}
          currentModelId={changeModelTarget.modelId}
          currentModelName={resolveModelName(changeModelTarget.modelId)}
          reason={modelUnavailableReason(changeModelTarget.modelId) ?? undefined}
          onSaved={({ modelId }) => {
            setPersonas(prev => prev.map(p => p.id === changeModelTarget.id ? { ...p, modelId } : p))
          }}
        />
      )}

      {/* ── Fix models — every affected agent at once ── */}
      {fixModelsMounted && <FixAgentModelsModal
        open={fixModelsOpen}
        onClose={() => setFixModelsOpen(false)}
        agents={unavailableAgents}
        onSaved={(updates) => {
          const byId = new Map(updates.map(u => [u.id, u.modelId]))
          setPersonas(prev => prev.map(p => byId.has(p.id) ? { ...p, modelId: byId.get(p.id)! } : p))
        }}
      />}

      <DeleteAgentDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={(p) => handleDelete(p.id, p.name)} />
    </>
  )
}

export default function PersonasPage() {
  return (
    <Suspense fallback={null}>
      <PersonasPageInner />
    </Suspense>
  )
}
