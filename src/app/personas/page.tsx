"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import chatStyles from "@/components/chat/chat-interface.module.css";
import styles from "./personas.module.css";
import { Bookmark, Circle, MoreVertical, Plus, Search, Users, Lightbulb, Palette } from "lucide-react";
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

// Temporarily empty to show empty state - replace with actual data from backend
const PERSONAS: PersonaSummary[] = [];

// Example personas for reference (not displayed):
// const PERSONAS: PersonaSummary[] = [
//   {
//     id: "1",
//     name: "Marketing Assistant",
//     description: "Helps with content creation and strategy",
//     thumbnail: "/personas/persona1.png",
//     isEditing: true,
//   },
//   {
//     id: "2",
//     name: "Product Strategist",
//     description: "Turns customer feedback into feature roadmaps",
//     thumbnail: "/personas/persona1.png",
//   },
//   {
//     id: "3",
//     name: "Support Specialist",
//     description: "Drafts empathetic responses and help center updates",
//     thumbnail: "/personas/persona1.png",
//   },
// ];

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
  const [templateCategory, setTemplateCategory] = useState<string>("all");
  const [savedTemplates, setSavedTemplates] = useState<Set<string>>(new Set());
  const [userPersonas, setUserPersonas] = useState<PersonaSummary[]>([]);

  // Load user personas from localStorage on mount
  useEffect(() => {
    const savedPersonas = sessionStorage.getItem('userPersonas');
    if (savedPersonas) {
      try {
        const personas = JSON.parse(savedPersonas);
        setUserPersonas(personas.map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.systemInstruction?.substring(0, 100) || 'No description',
          thumbnail: p.avatar || '/icons/personas/persona1.png',
        })));
      } catch (error) {
        console.error('Failed to load personas:', error);
      }
    }
  }, []);

  const filteredPersonas = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const allPersonas = [...PERSONAS, ...userPersonas];
    if (!query) return allPersonas;
    return allPersonas.filter((persona) =>
      persona.name.toLowerCase().includes(query) ||
      persona.description.toLowerCase().includes(query)
    );
  }, [searchTerm, userPersonas]);

  const filteredTemplates = useMemo(() => {
    const query = templateSearch.trim().toLowerCase();
    return TEMPLATE_LIBRARY.filter((template) => {
      const matchesQuery =
        !query ||
        template.name.toLowerCase().includes(query) ||
        template.description.toLowerCase().includes(query);
      const matchesSaved =
        filterCategory === "all" || savedTemplates.has(template.id);
      const matchesCategory =
        templateCategory === "all" || template.category === templateCategory;
      return matchesQuery && matchesSaved && matchesCategory;
    });
  }, [templateSearch, filterCategory, savedTemplates, templateCategory]);

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

  // Extract unique template categories
  const templateCategories = useMemo(() => {
    const categories = Array.from(new Set(TEMPLATE_LIBRARY.map(t => t.category)));
    return categories.sort();
  }, []);

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
        {/* Empty State - Show when user has no personas */}
        {PERSONAS.length === 0 ? (
          <>
            {/* Your Personas Section with Empty State */}
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <h1 className={styles.sectionTitle}>Your Personas</h1>
                  <p className={styles.sectionSubtitle}>Manage your custom agents.</p>
                </div>
              </div>
              
              <div className="flex flex-col items-center justify-center py-6 px-4 sm:py-8 sm:px-6">
                <div className="flex flex-col items-center gap-4 sm:gap-6">
                  {/* Avatar Stack */}
                  <div className="flex -space-x-2">
                    {[1, 2, 3].map((index) => (
                      <div
                        key={index}
                        className="relative h-10 w-10 sm:h-12 sm:w-12 rounded-full border-2 border-white shadow-md overflow-hidden"
                        style={{ zIndex: 4 - index }}
                      >
                        <img
                          src="/personas/persona1.png"
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex flex-col items-center gap-2 sm:gap-3 text-center">
                    <h2 className="text-xl sm:text-2xl font-semibold text-[#0A0A0A]">Create Your First Persona</h2>
                    <p className="text-sm text-[#666666] max-w-md px-4">
                      Start by creating a custom AI agent tailored to your specific needs and workflows
                    </p>
                  </div>
                  
                  {/* Create Persona Button */}
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
                      opacity: 1
                    }}
                    onClick={() => router.push("/personas/new")}
                  >
                    <Plus className="h-4 w-4" />
                    New persona
                  </Button>
                </div>
              </div>
            </section>

            {/* Choose from Templates Section */}
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

              {/* Template Category Filter Bar */}
              <div className={cn("mt-4 sm:mt-6 flex justify-start overflow-x-auto pb-2", styles.categoryScrollbar)}>
                <div
                  className="flex-shrink-0"
                  style={{
                    width: 'fit-content',
                    height: '35px',
                    borderRadius: '10px',
                    padding: '3px',
                    backgroundColor: '#F5F5F5',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <TabsPrimitive.Root
                    value={templateCategory}
                    onValueChange={setTemplateCategory}
                    className="w-full"
                  >
                    <TabsPrimitive.List className="flex items-center gap-1 w-full">
                      {/* All Categories Tab */}
                      <TabsPrimitive.Trigger
                        value="all"
                        className={cn(
                          "flex items-center justify-center px-2 sm:px-2.5 py-1 rounded-[10px] transition-all text-xs sm:text-sm font-medium cursor-pointer whitespace-nowrap",
                          "hover:bg-white/50",
                          templateCategory === "all"
                            ? "bg-white border border-[#E5E5E5] text-[#171717]"
                            : "bg-transparent text-[#A3A3A3]"
                        )}
                        style={{
                          height: '29px',
                          minWidth: 'fit-content'
                        }}
                      >
                        All
                      </TabsPrimitive.Trigger>

                      {/* Dynamic Category Tabs */}
                      {templateCategories.map((category) => {
                        // Count templates in this category
                        const categoryCount = TEMPLATE_LIBRARY.filter(t => t.category === category).length;

                        return (
                          <TabsPrimitive.Trigger
                            key={category}
                            value={category}
                            className={cn(
                              "flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-[10px] transition-all text-xs sm:text-sm font-medium cursor-pointer whitespace-nowrap",
                              "hover:bg-white/50",
                              templateCategory === category
                                ? "bg-white border border-[#E5E5E5] text-[#171717]"
                                : "bg-transparent text-[#A3A3A3]"
                            )}
                            style={{
                              height: '29px',
                              minWidth: 'fit-content'
                            }}
                          >
                            {category}
                            <span className="px-1 sm:px-1.5 py-0.5 rounded-sm bg-[#E5E5E5] text-[10px] sm:text-xs font-medium text-[#666666]">
                              {categoryCount}
                            </span>
                          </TabsPrimitive.Trigger>
                        );
                      })}
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
          </>
        ) : (
          /* Regular State - Show when user has personas */
          <>
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
                        onClick={() => router.push(`/personas/new/configure?personaId=${persona.id}`)}
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

          {/* Template Category Filter Bar */}
          <div className={cn("mt-4 sm:mt-6 flex justify-start overflow-x-auto pb-2", styles.categoryScrollbar)}>
            <div
              className="flex-shrink-0"
              style={{
                width: 'fit-content',
                height: '35px',
                borderRadius: '10px',
                padding: '3px',
                backgroundColor: '#F5F5F5',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <TabsPrimitive.Root
                value={templateCategory}
                onValueChange={setTemplateCategory}
                className="w-full"
              >
                <TabsPrimitive.List className="flex items-center gap-1 w-full">
                  {/* All Categories Tab */}
                  <TabsPrimitive.Trigger
                    value="all"
                    className={cn(
                      "flex items-center justify-center px-2 sm:px-2.5 py-1 rounded-[10px] transition-all text-xs sm:text-sm font-medium cursor-pointer whitespace-nowrap",
                      "hover:bg-white/50",
                      templateCategory === "all"
                        ? "bg-white border border-[#E5E5E5] text-[#171717]"
                        : "bg-transparent text-[#A3A3A3]"
                    )}
                    style={{
                      height: '29px',
                      minWidth: 'fit-content'
                    }}
                  >
                    All
                  </TabsPrimitive.Trigger>

                  {/* Dynamic Category Tabs */}
                  {templateCategories.map((category) => {
                    // Count templates in this category
                    const categoryCount = TEMPLATE_LIBRARY.filter(t => t.category === category).length;

                    return (
                      <TabsPrimitive.Trigger
                        key={category}
                        value={category}
                        className={cn(
                          "flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-[10px] transition-all text-xs sm:text-sm font-medium cursor-pointer whitespace-nowrap",
                          "hover:bg-white/50",
                          templateCategory === category
                            ? "bg-white border border-[#E5E5E5] text-[#171717]"
                            : "bg-transparent text-[#A3A3A3]"
                        )}
                        style={{
                          height: '29px',
                          minWidth: 'fit-content'
                        }}
                      >
                        {category}
                        <span className="px-1 sm:px-1.5 py-0.5 rounded-sm bg-[#E5E5E5] text-[10px] sm:text-xs font-medium text-[#666666]">
                          {categoryCount}
                        </span>
                      </TabsPrimitive.Trigger>
                    );
                  })}
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
        </>
        )}
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
