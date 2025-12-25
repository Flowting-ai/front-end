"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import chatStyles from "@/components/chat/chat-interface.module.css";
import styles from "./personas.module.css";
import { Bookmark, Circle, MoreVertical, Plus, Search } from "lucide-react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

interface PersonaSummary {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  isEditing?: boolean;
}

interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  category: string;
  author: string;
}

const resolveImage = (id: string, fallback: string) => {
  const match = PlaceHolderImages.find((item) => item.id === id);
  return match?.imageUrl ?? fallback;
};

const PERSONAS: PersonaSummary[] = [
  {
    id: "1",
    name: "Marketing Assistant",
    description: "Helps with content creation and strategy",
    thumbnail: "/personas/persona1.png",
    isEditing: true,
  },
  {
    id: "2",
    name: "Product Strategist",
    description: "Turns customer feedback into feature roadmaps",
    thumbnail: "/personas/persona1.png",
  },
  {
    id: "3",
    name: "Support Specialist",
    description: "Drafts empathetic responses and help center updates",
    thumbnail: "/personas/persona1.png",
  },
];

const TEMPLATE_LIBRARY: TemplateSummary[] = [
  {
    id: "t1",
    name: "Research Assistant",
    description: "Synthesizes sources into evidence-backed briefs",
    thumbnail: "/personas/persona1.png",
    category: "Assistant",
    author: "More D.",
  },
  {
    id: "t2",
    name: "Code Reviewer",
    description: "Highlights risky changes and missing tests",
    thumbnail: "/personas/persona1.png",
    category: "Assistant",
    author: "More D.",
  },
  {
    id: "t3",
    name: "Data Analyst",
    description: "Turns spreadsheets into actionable dashboards",
    thumbnail: "/personas/persona1.png",
    category: "Researcher",
    author: "More D.",
  },
  {
    id: "t4",
    name: "Content Writer",
    description: "Drafts copy in your brand voice across channels",
    thumbnail: "/personas/persona1.png",
    category: "Creator",
    author: "More D.",
  },
];

function PersonasPageContent() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [templateSearch, setTemplateSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<"all" | "saved">("all");
  const [savedTemplates, setSavedTemplates] = useState<Set<string>>(new Set());

  const filteredPersonas = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return PERSONAS;
    return PERSONAS.filter((persona) =>
      persona.name.toLowerCase().includes(query) ||
      persona.description.toLowerCase().includes(query)
    );
  }, [searchTerm]);

  const filteredTemplates = useMemo(() => {
    const query = templateSearch.trim().toLowerCase();
    return TEMPLATE_LIBRARY.filter((template) => {
      const matchesQuery =
        !query ||
        template.name.toLowerCase().includes(query) ||
        template.description.toLowerCase().includes(query);
      const matchesSaved =
        filterCategory === "all" || savedTemplates.has(template.id);
      return matchesQuery && matchesSaved;
    });
  }, [templateSearch, filterCategory, savedTemplates]);

  const groupedTemplates = useMemo(() => {
    return filteredTemplates.reduce<Record<string, TemplateSummary[]>>(
      (acc, template) => {
        const key = template.category ?? "Other";
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(template);
        return acc;
      },
      {}
    );
  }, [filteredTemplates]);

  const handleToggleSaved = (templateId: string) => {
    setSavedTemplates((prev) => {
      const next = new Set(prev);
      if (next.has(templateId)) {
        next.delete(templateId);
      } else {
        next.add(templateId);
      }
      return next;
    });
  };

  return (
    <div className={styles.personasShell}>
      <div className={cn(styles.scrollContainer, chatStyles.customScrollbar)}>
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h1 className={styles.sectionTitle}>Your Personas</h1>
              <p className={styles.sectionSubtitle}>Manage your custom agents.</p>
            </div>
          </div>
          <div className={styles.actionsRow}>
            <div className={styles.searchField}>
              <Search className={styles.searchIcon} />
              <Input
                type="search"
                placeholder="Search your persona"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className={cn(
                  styles.searchInput,
                  "border-[#E5E5E5] text-sm text-[#1E1E1E] placeholder:text-[#9F9F9F]"
                )}
              />
            </div>
            <Button
              className="flex items-center justify-center text-sm font-medium bg-[#171717] text-white hover:bg-black ml-auto"
              style={{
                width: '140.25px',
                height: '36px',
                minHeight: '36px',
                borderRadius: '8px',
                paddingTop: '7.5px',
                paddingRight: '4px',
                paddingBottom: '7.5px',
                paddingLeft: '4px',
                gap: '8px',
                opacity: 1
              }}
              onClick={() => router.push("/personas/new")}
            >
              <Plus className="h-4 w-4" />
              New persona
            </Button>
          </div>

          <div className={styles.cardsGrid}>
            {filteredPersonas.length > 0 ? (
              filteredPersonas.map((persona) => (
                <div key={persona.id} className={styles.personaCard}>
                  <img
                    src={persona.thumbnail}
                    alt=""
                    className={styles.personaImage}
                  />
                  <div className={styles.personaContent}>
                    <div className={styles.personaCardHeader}>
                      <div className={styles.cardBody}>
                        <h3 className={styles.cardTitle}>{persona.name}</h3>
                        <p className={styles.cardDescription}>{persona.description}</p>
                      </div>
                      <button
                        type="button"
                        className={styles.iconButton}
                        aria-label={`Open actions for ${persona.name}`}
                      >
                        <MoreVertical className="h-4 w-4 text-[#666666]" />
                      </button>
                    </div>
                    {persona.isEditing ? (
                      <Button
                        className="flex items-center justify-center text-sm font-medium bg-[#171717] text-white hover:bg-black"
                        style={{
                          width: '140.25px',
                          height: '36px',
                          minHeight: '36px',
                          borderRadius: '8px',
                          paddingTop: '7.5px',
                          paddingRight: '4px',
                          paddingBottom: '7.5px',
                          paddingLeft: '4px',
                          gap: '8px',
                          opacity: 1,
                          alignSelf: 'flex-start'
                        }}
                      >
                        Continue building
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.emptyState}>No personas found.</div>
            )}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Choose from templates</h2>
              <p className={styles.sectionSubtitle}>
                Jumpstart your Persona with a pre-made expert.
              </p>
            </div>
          </div>

          <div className={styles.actionsRow}>
            <div className={styles.searchField}>
              <Search className={styles.searchIcon} />
              <Input
                type="search"
                placeholder="Search for a template"
                value={templateSearch}
                onChange={(event) => setTemplateSearch(event.target.value)}
                className={cn(
                  styles.searchInput,
                  "border-[#E5E5E5] text-sm text-[#1E1E1E] placeholder:text-[#9F9F9F]"
                )}
              />
            </div>
            <div className={styles.actionsSpacer} />
            <div className={styles.filterTabs}>
              <TabsPrimitive.Root
                value={filterCategory}
                onValueChange={(value) => setFilterCategory(value as "all" | "saved")}
              >
                <TabsPrimitive.List className={styles.filterList}>
                  <TabsPrimitive.Trigger
                    value="all"
                    className={cn(
                      styles.filterButton,
                      filterCategory === "all" && styles.filterButtonActive
                    )}
                  >
                    <Circle className={styles.filterIcon} />
                    All
                  </TabsPrimitive.Trigger>
                  <TabsPrimitive.Trigger
                    value="saved"
                    className={cn(
                      styles.filterButton,
                      filterCategory === "saved" && styles.filterButtonActive
                    )}
                  >
                    <Bookmark className={styles.filterIcon} />
                    Saved
                  </TabsPrimitive.Trigger>
                </TabsPrimitive.List>
              </TabsPrimitive.Root>
            </div>
          </div>

          {Object.entries(groupedTemplates).length > 0 ? (
            Object.entries(groupedTemplates).map(([category, templates]) => (
              <div key={category} className={styles.categoryBlock}>
                <h3 className={styles.categoryTitle}>{category}</h3>
                <div className={styles.cardsGrid}>
                  {templates.map((template) => {
                    const isSaved = savedTemplates.has(template.id);
                    return (
                      <div key={template.id} className={styles.templateCard}>
                        <img
                          src={template.thumbnail}
                          alt=""
                          className={styles.templateImage}
                        />
                        <div className={styles.templateContent}>
                          <div className={styles.templateCardHeader}>
                            <div className={styles.cardBody}>
                              <h4 className={styles.cardTitle}>{template.name}</h4>
                              <p className={styles.cardDescription}>{template.description}</p>
                            </div>
                          </div>
                          <div className={styles.templateFooter}>
                            <div className={styles.authorTag}>
                              <div className={styles.authorAvatar} aria-hidden />
                              <span className={styles.authorName}>{template.author}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleSaved(template.id)}
                              className={styles.iconButton}
                              aria-label={
                                isSaved ? `Remove ${template.name} from saved` : `Save ${template.name}`
                              }
                            >
                              <Bookmark
                                className={cn(
                                  "h-4 w-4",
                                  isSaved
                                    ? "fill-[#171717] text-[#171717]"
                                    : "text-[#666666]"
                                )}
                              />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className={styles.emptyState}>No templates match your filters.</div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function PersonasPage() {
  return (
    <AppLayout>
      <PersonasPageContent />
    </AppLayout>
  );
}
