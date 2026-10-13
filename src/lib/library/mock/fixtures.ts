// Sample data for the Library mock (dev and tests only). Three people, a mix of formats and sources,
// shared and private files, a file the signed-in person cannot open (to see the locked state), and
// two files already in Trash. Dates are relative to `now` so the screens always look fresh.

import { MOCK_VIEWER_ID } from "../constants";
import type { Format, Person, Source } from "../schemas";

export { MOCK_VIEWER_ID };

export type MockPerson = Person & { role: "admin" | "member"; email: string };

export const MOCK_PEOPLE: MockPerson[] = [
  { id: MOCK_VIEWER_ID, name: "Avery Stone", email: "avery@example.com", role: "admin" },
  { id: "u_maya", name: "Maya Rios", email: "maya@example.com", role: "member" },
  { id: "u_sam", name: "Sam Okafor", email: "sam@example.com", role: "member" },
];

export type MockGrant = { id: string; who: string; by: string; at: number };

export type MockSheet = { name: string; columns: string[]; rowTotal: number; rowAt: (row: number) => string[] };

export type MockBody =
  | { kind: "pdf" }
  | { kind: "text"; pages: { label: string; text: string }[] }
  | { kind: "sheet"; sheets: MockSheet[] }
  | { kind: "image"; caption: string }
  | { kind: "audio"; durationMs: number; lines: { startMs: number; text: string }[] }
  | { kind: "none" };

export type MockProvenance = {
  kind: "chat" | "routine" | "slack" | "upload";
  label: string;
  via: "web" | "slack" | "routine";
  chatId?: string;
  routineId?: string;
  isTestRun?: boolean;
  /** Who uploaded it, when not the owner. */
  byId?: string;
  /** Whose chat it came from, when not the owner's (the viewer can open only their own chats). */
  chatOwnerId?: string;
  /** The run's label in its routine's history. */
  runLabel?: string;
};

export type MockFile = {
  id: string;
  title: string;
  extension: string;
  format: Format;
  source: Source;
  ownerId: string;
  grants: MockGrant[];
  sizeBytes: number;
  createdAt: number;
  lastActivityAt: number;
  lastActivityKind: "created" | "opened" | "modified" | "shared";
  life: "active" | "trashed";
  trashedAt?: number;
  /** Who moved the file to Trash (an Admin may trash a workspace-shared file they do not own). */
  trashedBy?: string;
  titleIsAiGenerated: boolean;
  provenance: MockProvenance;
  mimeType: string;
  body: MockBody;
  /** People who have not opened a file shared with them yet. */
  unreadFor: string[];
  /** Chats and routines that use this file (for "Used in" and the delete warning). */
  usedInChats: { id: string; title: string; ownerId: string }[];
  usedInRoutines: { id: string; title: string; ownerId: string }[];
  /** Run outputs: the file ids that run read ("Files this run used"). */
  runInputs?: string[];
};

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function sheet(name: string, columns: string[], rowTotal: number, rowAt: (row: number) => string[]): MockSheet {
  return { name, columns, rowTotal, rowAt };
}

const COLORS = ["Black", "White", "Sand", "Olive", "Navy", "Clay"];
const CATEGORIES = ["Tops", "Bottoms", "Outerwear", "Accessories", "Footwear"];

const catalogSheet = sheet("Catalog", ["SKU", "Product", "Category", "Colour", "Price", "Stock"], 1200, (row) => [
  `SKU-${String(1000 + row)}`,
  `Product ${row + 1}`,
  CATEGORIES[row % CATEGORIES.length],
  COLORS[row % COLORS.length],
  `$${(19 + (row % 40) * 3).toFixed(2)}`,
  String((row * 7) % 120),
]);

const shippingSheet = sheet("Rates", ["Region", "Method", "Days", "Cost"], 12, (row) => [
  ["US", "EU", "UK", "CA"][row % 4],
  row % 2 === 0 ? "Standard" : "Express",
  row % 2 === 0 ? "3-5" : "1-2",
  row % 2 === 0 ? "$6.00" : "$14.00",
]);

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const salesSheet = (): MockSheet =>
  sheet("Summary", ["Day", "Orders", "Revenue", "Refunds"], 7, (row) => [
    DAYS[row],
    String(40 + row * 9),
    `$${(1800 + row * 310).toFixed(2)}`,
    String(row % 3),
  ]);

export function buildFixtures(now: number): MockFile[] {
  const you = MOCK_VIEWER_ID;
  const maya = "u_maya";
  const sam = "u_sam";
  const grant = (id: string, who: string, by: string, ago: number): MockGrant => ({ id, who, by, at: now - ago });

  return [
    {
      id: "f_return_2026",
      title: "Return policy 2026",
      extension: "pdf",
      format: "pdf",
      source: "uploaded",
      ownerId: you,
      grants: [grant("g1", "workspace", you, 3 * DAY)],
      sizeBytes: 184_000,
      createdAt: now - 12 * DAY,
      lastActivityAt: now - 2 * HOUR,
      lastActivityKind: "opened",
      life: "active",
      titleIsAiGenerated: false,
      provenance: { kind: "chat", label: "Refund questions", via: "web", chatId: "c_refunds" },
      mimeType: "application/pdf",
      body: { kind: "pdf" },
      unreadFor: [maya, sam],
      usedInChats: [{ id: "c_refunds", title: "Refund questions", ownerId: you }],
      usedInRoutines: [{ id: "r_returns", title: "Weekly returns digest", ownerId: you }],
    },
    {
      id: "f_shipping_rates",
      title: "Shipping rates",
      extension: "xlsx",
      format: "sheet",
      source: "uploaded",
      ownerId: you,
      grants: [grant("g2", maya, you, 6 * DAY)],
      sizeBytes: 42_000,
      createdAt: now - 20 * DAY,
      lastActivityAt: now - 1 * DAY,
      lastActivityKind: "opened",
      life: "active",
      titleIsAiGenerated: false,
      provenance: { kind: "chat", label: "Carrier comparison", via: "web", chatId: "c_carrier" },
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      body: { kind: "sheet", sheets: [shippingSheet] },
      unreadFor: [],
      usedInChats: [{ id: "c_carrier", title: "Carrier comparison", ownerId: you }],
      usedInRoutines: [],
    },
    {
      id: "f_acme",
      title: "Supplier contract - Acme",
      extension: "pdf",
      format: "pdf",
      source: "uploaded",
      ownerId: maya,
      grants: [grant("g3", you, maya, 9 * DAY), grant("g4", sam, maya, 9 * DAY)],
      sizeBytes: 912_000,
      createdAt: now - 30 * DAY,
      lastActivityAt: now - 9 * DAY,
      lastActivityKind: "shared",
      life: "active",
      titleIsAiGenerated: false,
      provenance: { kind: "slack", label: "#ops", via: "slack" },
      mimeType: "application/pdf",
      body: { kind: "pdf" },
      unreadFor: [],
      usedInChats: [],
      usedInRoutines: [],
    },
    {
      id: "f_nova",
      title: "Supplier contract - Nova",
      extension: "pdf",
      format: "pdf",
      source: "uploaded",
      ownerId: sam,
      grants: [grant("g5", you, sam, 1 * HOUR), grant("g6", maya, sam, 1 * HOUR)],
      sizeBytes: 640_000,
      createdAt: now - 18 * DAY,
      lastActivityAt: now - 1 * HOUR,
      lastActivityKind: "shared",
      life: "active",
      titleIsAiGenerated: false,
      provenance: { kind: "chat", label: "Nova onboarding", via: "web", chatId: "c_nova", chatOwnerId: sam },
      mimeType: "application/pdf",
      body: { kind: "pdf" },
      unreadFor: [you],
      usedInChats: [],
      usedInRoutines: [],
    },
    {
      id: "f_brand",
      title: "Brand guidelines",
      extension: "pdf",
      format: "pdf",
      source: "uploaded",
      ownerId: you,
      grants: [],
      sizeBytes: 2_400_000,
      createdAt: now - 45 * DAY,
      lastActivityAt: now - 4 * DAY,
      lastActivityKind: "opened",
      life: "active",
      titleIsAiGenerated: false,
      provenance: { kind: "upload", label: "Brand setup", via: "web" },
      mimeType: "application/pdf",
      body: { kind: "pdf" },
      unreadFor: [],
      usedInChats: [],
      usedInRoutines: [],
    },
    {
      id: "f_lookbook",
      title: "Autumn lookbook",
      extension: "png",
      format: "image",
      source: "uploaded",
      ownerId: maya,
      grants: [],
      sizeBytes: 3_100_000,
      createdAt: now - 7 * DAY,
      lastActivityAt: now - 7 * DAY,
      lastActivityKind: "created",
      life: "active",
      titleIsAiGenerated: false,
      provenance: { kind: "chat", label: "Campaign ideas", via: "web", chatId: "c_campaign" },
      mimeType: "image/png",
      body: { kind: "image", caption: "Autumn lookbook cover" },
      unreadFor: [],
      usedInChats: [],
      usedInRoutines: [],
    },
    {
      id: "f_copy_v3",
      title: "Product copy v3",
      extension: "docx",
      format: "document",
      source: "generated",
      ownerId: you,
      grants: [],
      sizeBytes: 36_000,
      createdAt: now - 2 * DAY,
      lastActivityAt: now - 2 * DAY,
      lastActivityKind: "created",
      life: "active",
      titleIsAiGenerated: true,
      provenance: { kind: "chat", label: "Product descriptions", via: "web", chatId: "c_copy" },
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      body: {
        kind: "text",
        pages: [
          { label: "Page 1", text: "The Harbor jacket is built for wet weather: waxed cotton shell, taped seams and a roomy hood." },
          { label: "Page 2", text: "Care: spot clean, re-wax once a season. Returns accepted within 30 days in original condition." },
        ],
      },
      unreadFor: [],
      usedInChats: [{ id: "c_copy", title: "Product descriptions", ownerId: you }],
      usedInRoutines: [],
    },
    {
      id: "f_run_oct6",
      title: "Weekly sales report - Oct 6",
      extension: "xlsx",
      format: "sheet",
      source: "generated",
      ownerId: you,
      grants: [],
      sizeBytes: 28_000,
      createdAt: now - 3 * DAY,
      lastActivityAt: now - 3 * DAY,
      lastActivityKind: "created",
      life: "active",
      titleIsAiGenerated: true,
      provenance: { kind: "routine", label: "Weekly sales report", via: "routine", routineId: "r_sales", runLabel: "Oct 6" },
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      body: { kind: "sheet", sheets: [salesSheet()] },
      unreadFor: [],
      usedInChats: [],
      usedInRoutines: [],
      // An open file, one in Trash, one the viewer can't open, and one deleted forever.
      runInputs: ["f_catalog", "f_trash_draft", "f_lookbook", "f_deleted_forever"],
    },
    {
      id: "f_run_sep29",
      title: "Weekly sales report - Sep 29",
      extension: "xlsx",
      format: "sheet",
      source: "generated",
      ownerId: you,
      grants: [],
      sizeBytes: 27_000,
      createdAt: now - 10 * DAY,
      lastActivityAt: now - 10 * DAY,
      lastActivityKind: "created",
      life: "active",
      titleIsAiGenerated: true,
      provenance: { kind: "routine", label: "Weekly sales report", via: "routine", routineId: "r_sales", runLabel: "Sep 29" },
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      body: { kind: "sheet", sheets: [salesSheet()] },
      unreadFor: [],
      usedInChats: [],
      usedInRoutines: [],
    },
    {
      id: "f_test_run",
      title: "Test run - product copy",
      extension: "docx",
      format: "document",
      source: "generated",
      ownerId: you,
      grants: [],
      sizeBytes: 21_000,
      createdAt: now - 20 * HOUR,
      lastActivityAt: now - 20 * HOUR,
      lastActivityKind: "created",
      life: "active",
      titleIsAiGenerated: true,
      provenance: { kind: "routine", label: "Weekly product copy", via: "routine", routineId: "r_copy", isTestRun: true },
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      body: { kind: "text", pages: [{ label: "Page 1", text: "Draft copy for three new arrivals, ready for review." }] },
      unreadFor: [],
      usedInChats: [],
      usedInRoutines: [],
    },
    {
      id: "f_call_acme",
      title: "Supplier call - Acme",
      extension: "mp3",
      format: "audio",
      source: "uploaded",
      ownerId: you,
      grants: [],
      sizeBytes: 5_200_000,
      createdAt: now - 5 * DAY,
      lastActivityAt: now - 5 * DAY,
      lastActivityKind: "created",
      life: "active",
      titleIsAiGenerated: false,
      provenance: { kind: "chat", label: "Acme negotiation", via: "web", chatId: "c_acme" },
      mimeType: "audio/mpeg",
      body: {
        kind: "audio",
        durationMs: 6000,
        lines: [
          { startMs: 0, text: "Thanks for joining. Let's start with lead times." },
          { startMs: 2000, text: "We can ship within ten days for orders above five hundred units." },
          { startMs: 4000, text: "And the payment terms stay at net thirty." },
        ],
      },
      unreadFor: [],
      usedInChats: [{ id: "c_acme", title: "Acme negotiation", ownerId: you }],
      usedInRoutines: [],
    },
    {
      id: "f_catalog",
      title: "Catalog export",
      extension: "csv",
      format: "sheet",
      source: "uploaded",
      ownerId: you,
      grants: [grant("g7", "workspace", you, 15 * DAY)],
      sizeBytes: 1_100_000,
      createdAt: now - 25 * DAY,
      lastActivityAt: now - 6 * DAY,
      lastActivityKind: "modified",
      life: "active",
      titleIsAiGenerated: false,
      provenance: { kind: "chat", label: "Catalog cleanup", via: "web", chatId: "c_catalog" },
      mimeType: "text/csv",
      body: { kind: "sheet", sheets: [catalogSheet] },
      unreadFor: [],
      usedInChats: [{ id: "c_catalog", title: "Catalog cleanup", ownerId: you }],
      usedInRoutines: [{ id: "r_stock", title: "Low stock alert", ownerId: you }],
    },
    {
      id: "f_reviews",
      title: "Customer reviews Q3",
      extension: "txt",
      format: "text",
      source: "uploaded",
      ownerId: you,
      grants: [],
      sizeBytes: 78_000,
      createdAt: now - 14 * DAY,
      lastActivityAt: now - 14 * DAY,
      lastActivityKind: "created",
      life: "active",
      titleIsAiGenerated: false,
      provenance: { kind: "chat", label: "Review themes", via: "web", chatId: "c_reviews" },
      mimeType: "text/plain",
      body: {
        kind: "text",
        pages: [
          { label: "Page 1", text: "Fits true to size. Shipping was faster than expected. The hood is great in the rain." },
          { label: "Page 2", text: "Colour looked darker online. Returned one size without any problem." },
        ],
      },
      unreadFor: [],
      usedInChats: [],
      usedInRoutines: [],
    },
    {
      id: "f_ads",
      title: "Q3 ad creative",
      extension: "jpg",
      format: "image",
      source: "uploaded",
      ownerId: you,
      grants: [],
      sizeBytes: 1_700_000,
      createdAt: now - 22 * DAY,
      lastActivityAt: now - 22 * DAY,
      lastActivityKind: "created",
      life: "active",
      titleIsAiGenerated: false,
      provenance: { kind: "chat", label: "Ad review", via: "web", chatId: "c_ads" },
      mimeType: "image/jpeg",
      body: { kind: "image", caption: "Q3 ad creative" },
      unreadFor: [],
      usedInChats: [],
      usedInRoutines: [],
    },
    {
      id: "f_deck",
      title: "Launch deck",
      extension: "pptx",
      format: "slides",
      source: "uploaded",
      ownerId: you,
      grants: [grant("g8", sam, you, 4 * DAY)],
      sizeBytes: 5_600_000,
      createdAt: now - 16 * DAY,
      lastActivityAt: now - 4 * DAY,
      lastActivityKind: "shared",
      life: "active",
      titleIsAiGenerated: false,
      provenance: { kind: "slack", label: "#launch", via: "slack" },
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      body: { kind: "text", pages: [{ label: "Slide 1", text: "Autumn launch: three hero products, one campaign." }] },
      unreadFor: [sam],
      usedInChats: [],
      usedInRoutines: [],
    },
    {
      id: "f_trash_policy",
      title: "Return policy 2025",
      extension: "pdf",
      format: "pdf",
      source: "uploaded",
      ownerId: you,
      grants: [grant("g9", maya, you, 120 * DAY)],
      sizeBytes: 176_000,
      createdAt: now - 400 * DAY,
      lastActivityAt: now - 3 * DAY,
      lastActivityKind: "modified",
      life: "trashed",
      trashedAt: now - 3 * DAY,
      titleIsAiGenerated: false,
      provenance: { kind: "upload", label: "Policy archive", via: "web" },
      mimeType: "application/pdf",
      body: { kind: "pdf" },
      unreadFor: [],
      usedInChats: [],
      usedInRoutines: [],
    },
    {
      id: "f_trash_draft",
      title: "Draft banner",
      extension: "png",
      format: "image",
      source: "generated",
      ownerId: you,
      grants: [],
      sizeBytes: 820_000,
      createdAt: now - 40 * DAY,
      lastActivityAt: now - 26 * DAY,
      lastActivityKind: "modified",
      life: "trashed",
      trashedAt: now - 26 * DAY,
      titleIsAiGenerated: true,
      provenance: { kind: "chat", label: "Banner ideas", via: "web", chatId: "c_banner" },
      mimeType: "image/png",
      body: { kind: "image", caption: "Draft banner" },
      unreadFor: [],
      usedInChats: [],
      usedInRoutines: [],
    },
  ];
}

/** Extra rows for performance checks: deterministic, mixed formats and sources, owned by the viewer. */
export function buildSyntheticFiles(now: number, count: number): MockFile[] {
  const formats: { format: Format; extension: string; mime: string; body: MockBody }[] = [
    { format: "pdf", extension: "pdf", mime: "application/pdf", body: { kind: "pdf" } },
    { format: "document", extension: "docx", mime: "application/msword", body: { kind: "text", pages: [{ label: "Page 1", text: "Synthetic document." }] } },
    { format: "sheet", extension: "xlsx", mime: "application/vnd.ms-excel", body: { kind: "sheet", sheets: [shippingSheet] } },
    { format: "image", extension: "png", mime: "image/png", body: { kind: "image", caption: "Synthetic image" } },
    { format: "text", extension: "txt", mime: "text/plain", body: { kind: "text", pages: [{ label: "Page 1", text: "Synthetic text." }] } },
  ];
  const out: MockFile[] = [];
  for (let i = 0; i < count; i += 1) {
    const kind = formats[i % formats.length];
    const age = ((i * 37) % 500) * HOUR;
    out.push({
      id: `f_synth_${i}`,
      title: `Synthetic file ${String(i + 1).padStart(4, "0")}`,
      extension: kind.extension,
      format: kind.format,
      source: i % 4 === 0 ? "generated" : "uploaded",
      ownerId: MOCK_VIEWER_ID,
      grants: i % 9 === 0 ? [{ id: `gs_${i}`, who: "u_maya", by: MOCK_VIEWER_ID, at: now - age }] : [],
      sizeBytes: 10_000 + ((i * 7919) % 4_000_000),
      createdAt: now - age - DAY,
      lastActivityAt: now - age,
      lastActivityKind: "created",
      life: "active",
      titleIsAiGenerated: i % 4 === 0,
      provenance: { kind: "upload", label: "Synthetic", via: "web" },
      mimeType: kind.mime,
      body: kind.body,
      unreadFor: [],
      usedInChats: [],
      usedInRoutines: [],
    });
  }
  return out;
}
