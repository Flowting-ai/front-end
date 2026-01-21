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
import {
  Bookmark,
  Circle,
  MoreVertical,
  Plus,
  Search,
  Users,
  Lightbulb,
  Palette,
} from "lucide-react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import Image from "next/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/context/auth-context";
import {
  fetchPersonas,
  deletePersona as deletePersonaApi,
  type PersonaStatus,
} from "@/lib/api/personas";

interface PersonaSummary {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  isEditing?: boolean;
  temperature?: number;
}

interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  category: string;
  author: string;
  temperature?: number;
}

const resolveImage = (id: string, fallback: string) => {
  const match = PlaceHolderImages.find((item) => item.id === id);
  return match?.imageUrl ?? fallback;
};

// Seed with three personas to show filled state
const INITIAL_PERSONAS: PersonaSummary[] = [
  {
    id: "1",
    name: "Marketing Assistant",
    description: "Helps with content creation and strategy",
    thumbnail: "/personas/persona1.png",
    isEditing: true,
    // temperature not set yet
  },
  {
    id: "2",
    name: "Product Strategist",
    description: "Turns customer feedback into feature roadmaps",
    thumbnail: "/personas/persona1.png",
    temperature: 0.3,
  },
  {
    id: "3",
    name: "Support Specialist",
    description: "Drafts empathetic responses and help center updates",
    thumbnail: "/personas/persona1.png",
    temperature: 0.6,
  },
];

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
    author: "",
    temperature: 0.3,
  },
  {
    id: "t2",
    name: "Code Reviewer",
    description: "Highlights risky changes and missing tests",
    thumbnail: "/personas/persona1.png",
    category: "Assistant",
    author: "",
    temperature: 0.3,
  },
  {
    id: "t3",
    name: "Data Analyst",
    description: "Turns spreadsheets into actionable dashboards",
    thumbnail: "/personas/persona1.png",
    category: "Researcher",
    author: "",
    temperature: 0.3,
  },
  {
    id: "t4",
    name: "Content Writer",
    description: "Drafts copy in your brand voice across channels",
    thumbnail: "/personas/persona1.png",
    category: "Creator",
    author: "",
    temperature: 0.3,
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
  const [personas, setPersonas] = useState<PersonaSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilterValue] = useState<PersonaStatus>("test");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [personaToDelete, setPersonaToDelete] = useState<PersonaSummary | null>(null);
  const { csrfToken } = useAuth();

  // Load personas from backend
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const list = await fetchPersonas(statusFilterValue, csrfToken);
        setPersonas(
          list.map((p) => ({
            id: p.id,
            name: p.name,
            description: p.prompt?.slice(0, 140) || "No description",
            thumbnail: p.imageUrl || "/icons/personas/persona1.png",
            temperature: undefined,
          }))
        );
      } catch (error) {
        console.error("Failed to load personas:", error);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [csrfToken, statusFilterValue]);

  const filteredPersonas = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const allPersonas = [...personas, ...userPersonas];
    if (!query) return allPersonas;
    return allPersonas.filter(
      (persona) =>
        persona.name.toLowerCase().includes(query) ||
        persona.description.toLowerCase().includes(query)
    );
  }, [searchTerm, userPersonas, personas]);

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
    const categories = Array.from(
      new Set(TEMPLATE_LIBRARY.map((t) => t.category))
    );
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

  const handleDeletePersona = async (personaId: string) => {
    try {
      await deletePersonaApi(personaId, csrfToken);
      setPersonas((prev) => prev.filter((p) => p.id !== personaId));
      setUserPersonas((prev) => prev.filter((p) => p.id !== personaId));
    } catch (error) {
      console.error("Failed to delete persona:", error);
    }
  };

  return (
    <div className={styles.personasShell}>
      <div className={cn(styles.scrollContainer, chatStyles.customScrollbar)}>
        {/* Empty State - Show when user has no personas */}
        {/* PERSONAS.length === 0 */}
        {INITIAL_PERSONAS.length === 0 ? (
          <>
            {/* Your Personas Section with Empty State */}
            <section className={styles.section}>
              {/* Header */}
              <div className="flex flex-col">
                <h1 className="font-clash font-[400] leading-[140%] text-[24px] text-black">
                  Your Personas
                </h1>
                <p className="font-geist font-[400] leading-[140%] text-[13px] text-black">
                  Manage your custom agents.
                </p>
              </div>

              <div className={styles.emptyCardWrap}>
                <div className={cn(styles.emptyCard,"")}>
                  {/* Avatar Stack */}
                  <div
                    className="relative top-4 left-2 flex -space-x-2"
                    style={{ width: "126px", height: "40px" }}
                  >
                    {[
                      "/avatars/avatar3.svg",
                      "/avatars/avatar2.svg",
                      "/avatars/avatar1.svg",
                    ].map((src, index) => (
                      <div
                        key={`${src}-${index}`}
                        className="relative h-10 w-10 rounded-full border border-white overflow-hidden"
                        style={{ zIndex: 3 + index }}
                      >
                        <Image
                          src={src}
                          alt="Persona avatar"
                          width={41}
                          height={40}
                          className="h-full w-full rounded-full object-contain"
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className={cn(styles.createPersonaButton, "cursor-pointer font-geist font-medium text-[14px]")}
                    onClick={() => router.push("/personas/new")}
                  >
                    Create New Persona
                  </button>
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
                    onValueChange={(value) =>
                      setFilterCategory(value as "all" | "saved")
                    }
                  >
                    <TabsPrimitive.List className={styles.filterList}>
                      <TabsPrimitive.Trigger
                        value="all"
                        className={cn(
                          styles.filterButton,
                          styles.filterButtonAll,
                          filterCategory === "all" && styles.filterButtonActive
                        )}
                      >
                        <Circle
                          className={styles.filterIcon}
                          strokeWidth={1.5}
                        />
                        All
                      </TabsPrimitive.Trigger>
                      <TabsPrimitive.Trigger
                        value="saved"
                        className={cn(
                          styles.filterButton,
                          filterCategory === "saved" &&
                            styles.filterButtonActive
                        )}
                      >
                        <Bookmark
                          className={styles.filterIconBookmark}
                          strokeWidth={1.5}
                        />
                        Saved
                      </TabsPrimitive.Trigger>
                    </TabsPrimitive.List>
                  </TabsPrimitive.Root>
                </div>
              </div>

              {/* Template Category Filter Bar */}
              <div
                className={cn(
                  "flex justify-start overflow-x-auto",
                  styles.categoryScrollbar
                )}
              >
                <div
                  className="shrink-0"
                  style={{
                    width: "fit-content",
                    height: "35px",
                    borderRadius: "10px",
                    padding: "3px",
                    backgroundColor: "#F5F5F5",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
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
                          "flex items-center justify-center px-2 sm:px-2.5 py-1 rounded-[10px] transition-all cursor-pointer whitespace-nowrap",
                          styles.categoryTrigger,
                          "hover:bg-white/50",
                          templateCategory === "all"
                            ? "bg-white border border-[#E5E5E5] text-[#171717]"
                            : "bg-transparent text-[#171717]"
                        )}
                        style={{
                          height: "29px",
                          minWidth: "fit-content",
                        }}
                      >
                        All
                      </TabsPrimitive.Trigger>

                      {/* Dynamic Category Tabs */}
                      {templateCategories.map((category) => {
                        // Count templates in this category
                        const categoryCount = TEMPLATE_LIBRARY.filter(
                          (t) => t.category === category
                        ).length;

                        return (
                          <TabsPrimitive.Trigger
                            key={category}
                            value={category}
                            className={cn(
                              "flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-[10px] transition-all cursor-pointer whitespace-nowrap",
                              styles.categoryTrigger,
                              "hover:bg-white/50",
                              templateCategory === category
                                ? "bg-white border border-[#E5E5E5] text-[#171717]"
                                : "bg-transparent text-[#171717]"
                            )}
                            style={{
                              height: "29px",
                              minWidth: "fit-content",
                            }}
                          >
                            {category}
                            <span className={styles.countBadge}>
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
                Object.entries(groupedTemplates).map(
                  ([category, templates]) => (
                    <div key={category} className={cn(styles.categoryBlock, "")}>
                      <h3 className={cn(styles.categoryTitle, "font-clash font-medium! text-[16px]!")}>{category}</h3>
                      <div className={styles.cardsGrid}>
                        {templates.map((template) => {
                          const isSaved = savedTemplates.has(template.id);
                          return (
                            <div
                              key={template.id}
                              className={styles.templateCard}
                            >
                              <Image
                                src={template.thumbnail}
                                alt=""
                                width={148}
                                height={148}
                                className={styles.templateImage}
                              />
                              <div className={styles.templateContent}>
                                <div className={styles.templateCardHeader}>
                                  <div className={styles.cardBody}>
                                    <h4 className={styles.cardTitle}>
                                      {template.name}
                                    </h4>
                                    <p className={styles.cardDescription}>
                                      {template.description}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    className={styles.iconButton}
                                    aria-label={`Open actions for ${template.name}`}
                                  >
                                    <MoreVertical className="h-4 w-4 text-[#666666]" />
                                  </button>
                                </div>
                                <div className={styles.templateFooter}>
                                  <span
                                    className={styles.temperatureBadge}
                                    title="Persona Temperature"
                                  >
                                    {`T: ${
                                      typeof template.temperature === "number"
                                        ? template.temperature
                                        : 0.3
                                    }`}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleToggleSaved(template.id)
                                    }
                                    className={styles.iconButton}
                                    aria-label={
                                      isSaved
                                        ? `Remove ${template.name} from saved`
                                        : `Save ${template.name}`
                                    }
                                  >
                                    <Bookmark
                                      className={cn(
                                        styles.templateBookmarkIcon,
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
                  )
                )
              ) : (
                <div className={styles.emptyState}>
                  You have no saved templates yet. Please save a template to get
                  started.
                </div>
              )}
            </section>
          </>
        ) : (
          /* Regular State - Show when user has personas */
          <>
            <section className={styles.section}>
              {/* Header */}
              <div className="flex flex-col">
                <h1 className="font-clash font-[400] leading-[140%] text-[24px] text-black">
                  Your Personas
                </h1>
                <p className="font-geist font-[400] leading-[140%] text-[13px] text-black">
                  Manage your custom agents.
                </p>
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
                  className="cursor-pointer flex items-center justify-center text-sm font-medium bg-[#171717] text-white hover:bg-black ml-auto"
                  style={{
                    width: "140.25px",
                    height: "36px",
                    minHeight: "36px",
                    borderRadius: "8px",
                    paddingTop: "7.5px",
                    paddingRight: "4px",
                    paddingBottom: "7.5px",
                    paddingLeft: "4px",
                    gap: "8px",
                    opacity: 1,
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
                      <Image
                        src={persona.thumbnail}
                        alt="persona"
                        width={148}
                        height={148}
                        className={styles.personaImage}
                      />
                      <div className={styles.personaContent}>
                        <div className={styles.personaCardHeader}>
                          <div className={styles.cardBody}>
                            <h3 className={styles.cardTitle}>{persona.name}</h3>
                            <p className={styles.cardDescription}>
                              {persona.description}
                            </p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className={styles.iconButton}
                                aria-label={`Open actions for ${persona.name}`}
                              >
                                <MoreVertical className="h-4 w-4 text-[#666666]" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem onClick={() => router.push(`/personas/new/configure?personaId=${persona.id}`)}>
                                Edit configuration
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setPersonaToDelete(persona);
                                setDeleteDialogOpen(true);
                              }}>
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className={styles.templateFooter}>
                          {typeof persona.temperature === "number" ? (
                            <span
                              className={styles.temperatureBadge}
                              title="Persona Temperature"
                            >
                              {`T: ${persona.temperature}`}
                            </span>
                          ) : null}
                          {persona.isEditing ? (
                            <Button
                              className="cursor-pointer flex items-center justify-center text-sm font-medium hover:bg-zinc-100! transition-colors duration-300"
                              style={{
                                width: "140.25px",
                                height: "36px",
                                minHeight: "36px",
                                borderRadius: "8px",
                                padding: "7.5px 4px",
                                gap: "8px",
                                opacity: 1,
                                background: "#FFFFFF1A",
                                border: "1px solid #D4D4D4",
                                boxShadow: "0px 1px 2px 0px #0000000D",
                                color: "#0A0A0A",
                              }}
                              onClick={() =>
                                router.push(
                                  `/personas/new/configure?personaId=${persona.id}`
                                )
                              }
                            >
                              Continue building
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyState}>No personas found.</div>
                )}
              </div>
            </section>

            <section className={styles.section}>
              <div className="flex flex-col">
                <h1 className="font-clash font-[400] leading-[140%] text-[24px] text-black">
                  Choose from templates
                </h1>
                <p className="font-geist font-[400] leading-[140%] text-[13px] text-black">
                  Jumpstart your Persona with a pre-made expert.
                </p>
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
                    onValueChange={(value) =>
                      setFilterCategory(value as "all" | "saved")
                    }
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
                          filterCategory === "saved" &&
                            styles.filterButtonActive
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
              <div
                className={cn(
                  "flex justify-start overflow-x-auto",
                  styles.categoryScrollbar
                )}
              >
                <div
                  className="shrink-0"
                  style={{
                    width: "fit-content",
                    height: "35px",
                    borderRadius: "10px",
                    padding: "3px",
                    backgroundColor: "#F5F5F5",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
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
                            ? "bg-white border border-[#E5E5E5] text-[#0A0A0A] shadow-xs shadow-black/15"
                            : "bg-transparent text-[#0A0A0A]"
                        )}
                        style={{
                          height: "29px",
                          minWidth: "fit-content",
                        }}
                      >
                        All
                      </TabsPrimitive.Trigger>

                      {/* Dynamic Category Tabs */}
                      {templateCategories.map((category) => {
                        // Count templates in this category
                        const categoryCount = TEMPLATE_LIBRARY.filter(
                          (t) => t.category === category
                        ).length;

                        return (
                          <TabsPrimitive.Trigger
                            key={category}
                            value={category}
                            className={cn(
                              "flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-[10px] transition-all text-xs sm:text-sm font-medium cursor-pointer whitespace-nowrap",
                              "hover:bg-white/50",
                              templateCategory === category
                                ? "bg-white border border-[#E5E5E5] text-[#0A0A0A] shadow-xs shadow-black/15"
                                : "bg-transparent text-[#0A0A0A]"
                            )}
                            style={{
                              height: "29px",
                              minWidth: "fit-content",
                            }}
                          >
                            {category}
                            <span className="w-4 h-4 rounded-full bg-[#E5E5E5] text-[10px] sm:text-xs font-medium text-[#666666] flex items-center justify-center">
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
                Object.entries(groupedTemplates).map(
                  ([category, templates]) => (
                    <div key={category} className={styles.categoryBlock}>
                      <h3 className={cn(styles.categoryTitle, "font-clash font-medium! text-[16px]!")}>{category}</h3>
                      <div className={styles.cardsGrid}>
                        {templates.map((template) => {
                          const isSaved = savedTemplates.has(template.id);
                          return (
                            <div
                              key={template.id}
                              className={styles.templateCard}
                            >
                              <Image
                                src={template.thumbnail}
                                alt=""
                                width={148}
                                height={148}
                                className={styles.templateImage}
                              />
                              <div className={styles.templateContent}>
                                <div className={styles.templateCardHeader}>
                                  <div className={styles.cardBody}>
                                    <h4 className={styles.cardTitle}>
                                      {template.name}
                                    </h4>
                                    <p className={styles.cardDescription}>
                                      {template.description}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    className={styles.iconButton}
                                    aria-label={`Open actions for ${template.name}`}
                                  >
                                    <MoreVertical className="h-4 w-4 text-[#666666]" />
                                  </button>
                                </div>
                                <div className={styles.templateFooter}>
                                  <span
                                    className={styles.temperatureBadge}
                                    title="Persona Temperature"
                                  >
                                    {`T: ${
                                      typeof template.temperature === "number"
                                        ? template.temperature
                                        : 0.3
                                    }`}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleToggleSaved(template.id)
                                    }
                                    className={styles.iconButton}
                                    aria-label={
                                      isSaved
                                        ? `Remove ${template.name} from saved`
                                        : `Save ${template.name}`
                                    }
                                  >
                                    <Bookmark
                                      className={cn(
                                        styles.templateBookmarkIcon,
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
                  )
                )
              ) : (
                <div className={styles.emptyState}>
                  You have no saved templates yet. Please save a template to get
                  started.
                </div>
              )}
            </section>
          </>
        )}
      </div>
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Persona</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{personaToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (personaToDelete) {
                handleDeletePersona(personaToDelete.id);
              }
              setDeleteDialogOpen(false);
              setPersonaToDelete(null);
            }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
