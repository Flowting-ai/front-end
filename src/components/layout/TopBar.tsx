"use client";

import { useState, useEffect } from "react";
import Image from 'next/image';
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useModelSelectorContext } from "@/context/model-selector-context";
import { useProjects } from "@/context/projects-context";
import { LlmIcon } from "@strange-huge/icons/llm";
import { getModelLlmId } from "@/lib/model-icons";
import { Button } from "@/components/Button";
import { ArrowDownOneIcon, PenOneIcon } from "@strange-huge/icons";
import { getPersona } from "@/lib/api/personas";
import type { Persona } from "@/lib/api/personas";
import { fetchModelsWithCache } from "@/lib/ai-models";
import type { AIModel } from "@/types/ai-model";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TopBarProps {
  showCitationsToggle?: boolean;
  citationsOpen?: boolean;
  onCitationsToggle?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TopBar({ showCitationsToggle: _showCitationsToggle, citationsOpen: _citationsOpen, onCitationsToggle: _onCitationsToggle }: TopBarProps) {
  const { selectedModel, isOpen, open, museActive, museAdvanced, personaActive } =
    useModelSelectorContext();
  const { getProject, getChats } = useProjects();
  const pathname = usePathname();
  const router   = useRouter();

  // Track the real browser pathname — may differ from Next.js pathname when
  // window.history.replaceState is used (e.g. project chat new→real chatId).
  const [actualPathname,   setActualPathname]   = useState(pathname);
  // Track the AI-generated chat title directly via event, independent of
  // the projects-context getChats lookup (which can be reset by loadProjectChats).
  const [dynamicChatTitle, setDynamicChatTitle] = useState<string | null>(null);
  useEffect(() => {
    setActualPathname(window.location.pathname);
    const urlHandler = () => {
      setActualPathname(window.location.pathname);
      setDynamicChatTitle(null); // reset when a new chat is created
    };
    const titleHandler = (e: Event) => {
      setDynamicChatTitle((e as CustomEvent<{ title: string }>).detail.title);
    };
    window.addEventListener('chat-url-updated',            urlHandler);
    window.addEventListener('project:chat-title-updated',  titleHandler);
    return () => {
      window.removeEventListener('chat-url-updated',            urlHandler);
      window.removeEventListener('project:chat-title-updated',  titleHandler);
    };
  }, []);
  useEffect(() => {
    setActualPathname(pathname);
    setDynamicChatTitle(null); // reset on real Next.js navigation
  }, [pathname]);

  // Detect page type from pathname
  const projectChatMatch    = actualPathname.match(/^\/project\/([^/]+)\/chat\/([^/]+)$/);
  const isProjectChatPage   = !!projectChatMatch;
  const isProjectDetailPage = actualPathname.startsWith('/project') && !isProjectChatPage;
  const isChatsPage         = actualPathname === '/chats';
  const personaChatMatch      = actualPathname.match(/^\/agents\/([^/]+)\/chat/);
  const isPersonaChatPage     = !!personaChatMatch;
  const personaId             = personaChatMatch?.[1] ?? null;
  const isPersonaConfigurePage = actualPathname.startsWith('/agent/configure');

  // Fetch persona data + resolve full model object for the top-bar tag on persona chat pages
  const [persona,      setPersona]      = useState<Persona | null>(null);
  const [personaModel, setPersonaModel] = useState<AIModel | null>(null);
  useEffect(() => {
    if (!personaId) { setPersona(null); setPersonaModel(null); return; }
    Promise.all([getPersona(personaId), fetchModelsWithCache()])
      .then(([p, models]) => {
        setPersona(p);
        const matched = p.modelId
          ? models.find(m => String(m.modelId ?? m.id) === p.modelId) ?? null
          : null;
        setPersonaModel(matched);
      })
      .catch(console.error);
  }, [personaId]);

  const modelLlmId = museActive
    ? null
    : getModelLlmId(selectedModel?.companyName, selectedModel?.modelName);

  const label = museActive
    ? museAdvanced
      ? "Souvenir Muse (Advanced)"
      : "Souvenir Muse (Basic)"
    : selectedModel?.modelName ?? "Souvenir AI · Muse";

  const modelSelectorButton = (
    <Button
      variant="default"
      size="sm"
      rightIcon={<ArrowDownOneIcon />}
      onClick={(e) => {
        if (personaActive) {
          toast.info("Model locked to agent", {
            description:
              "This chat uses the agent's model. Remove the agent chip to unlock model selection.",
          });
          return;
        }
        open(e.currentTarget);
      }}
      aria-haspopup="listbox"
      aria-expanded={isOpen && !personaActive}
    >
      <span style={{ display: "flex", alignItems: "center", gap: "8px", color: personaActive ? "var(--button-default-text-disabled)" : undefined }}>
        {(museActive || modelLlmId) && (
          <span
            style={{
              width:          "16px",
              height:         "16px",
              borderRadius:   "4px",
              overflow:       "hidden",
              flexShrink:     0,
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
            }}
          >
            {museActive ? (
              <Image src="/icons/souvenir-logo-white.svg" width={16} height={16} alt="" unoptimized style={{ display: "block" }} />
            ) : (
              <LlmIcon
                id={modelLlmId!}
                variant={modelLlmId === 'OpenAI' ? 'color' : 'avatar'}
                size={16}
                style={modelLlmId === 'OpenAI' ? { filter: 'brightness(0) invert(1)' } : undefined}
              />
            )}
          </span>
        )}
        {label}
      </span>
    </Button>
  );

  return (
    <div
      style={{
        position:       "absolute",
        top:            -1,
        left:           -1,
        right:          -1,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        paddingTop:     "12px",
        paddingLeft:    "12px",
        paddingRight:   "12px",
        zIndex:         1,
      }}
    >
      {isProjectChatPage && projectChatMatch ? (
        <>
          {/* ── Left: model selector, then project + chat name ── */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: "1 1 0" }}>
            <div style={{ flexShrink: 0 }}>{modelSelectorButton}</div>
            <span
              style={{
                display:         "inline-flex",
                alignItems:      "center",
                gap:             "5px",
                padding:         "5px 8px",
                borderRadius:    "8px",
                backgroundColor: "var(--neutral-white, #fff)",
                boxShadow:       "inset 0 0 0 1px var(--button-outline-border)",
                pointerEvents:   "none",
                minWidth:        0,
                overflow:        "hidden",
                flexShrink:      1,
              }}
            >
              <span
                style={{
                  fontFamily:   "var(--font-body)",
                  fontWeight:   "var(--font-weight-semibold)",
                  fontSize:     "var(--font-size-body)",
                  lineHeight:   "var(--line-height-body)",
                  color:        "var(--neutral-900)",
                  whiteSpace:   "nowrap",
                  flexShrink:   0,
                }}
              >
                {getProject(projectChatMatch[1])?.name ?? ""}
              </span>
              {(() => {
                const chatName = dynamicChatTitle ?? getChats(projectChatMatch[1]).find(c => c.id === projectChatMatch[2])?.title ?? "";
                if (!chatName) return null;
                return (
                  <>
                    <span
                      style={{
                        fontFamily: "var(--font-body)",
                        fontWeight: "var(--font-weight-medium)",
                        fontSize:   "var(--font-size-body)",
                        lineHeight: "var(--line-height-body)",
                        color:      "var(--neutral-400)",
                        flexShrink: 0,
                      }}
                    >
                      ·
                    </span>
                    <span
                      style={{
                        fontFamily:   "var(--font-body)",
                        fontWeight:   "var(--font-weight-medium)",
                        fontSize:     "var(--font-size-body)",
                        lineHeight:   "var(--line-height-body)",
                        color:        "var(--button-outline-text)",
                        whiteSpace:   "nowrap",
                        overflow:     "hidden",
                        textOverflow: "ellipsis",
                        flexShrink:   1,
                        minWidth:     0,
                      }}
                    >
                      {chatName}
                    </span>
                  </>
                );
              })()}
            </span>
          </div>
        </>
      ) : isPersonaChatPage ? (
        <>
          {/* ── Persona chat: non-interactive model tag + Edit button ── */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>

            {/* Model tag — same visual as model selector button, no arrow, not interactive */}
            {(personaModel || persona?.modelId) && (() => {
              const llmId     = personaModel
                ? getModelLlmId(personaModel.companyName, personaModel.modelName)
                : getModelLlmId(null, persona!.modelId);
              const modelName = personaModel?.modelName ?? persona!.modelId;
              return (
                <Button
                  variant="default"
                  size="sm"
                  disabled
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {llmId && (
                      <span
                        style={{
                          width:          "16px",
                          height:         "16px",
                          borderRadius:   "4px",
                          overflow:       "hidden",
                          flexShrink:     0,
                          display:        "flex",
                          alignItems:     "center",
                          justifyContent: "center",
                        }}
                      >
                        <LlmIcon
                          id={llmId}
                          variant={llmId === "OpenAI" ? "color" : "avatar"}
                          size={16}
                          style={llmId === "OpenAI" ? { filter: "brightness(0) invert(1)" } : undefined}
                        />
                      </span>
                    )}
                    {modelName}
                  </span>
                </Button>
              );
            })()}

            {/* Edit button — only for owned agents, never for received/shared ones */}
            {persona && persona.sourceShareId === null && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<PenOneIcon animated />}
                onClick={() =>
                  router.push(
                    `/agent/configure/instructions?repoId=${personaId}&name=${encodeURIComponent(persona.name)}`,
                  )
                }
              >
                Edit
              </Button>
            )}
          </div>
        </>
      ) : (
        <>
          {/* ── Left: model selector (hidden on project detail / chats / persona configure pages) ── */}
          {!isProjectDetailPage && !isChatsPage && !isPersonaConfigurePage && modelSelectorButton}
        </>
      )}
    </div>
  );
}
