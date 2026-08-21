"use client";

import { apiFetch, apiFetchJson } from "./client";
import {
  PERSONAS_ENDPOINT,
  PERSONA_ACTIVE_ENDPOINT,
  PERSONA_DETAIL_ENDPOINT,
  PERSONA_PAUSE_ENDPOINT,
  PERSONA_PUBLISH_ENDPOINT,
  PERSONA_VERSIONS_ENDPOINT,
  PERSONA_VISIBILITY_ENDPOINT,
} from "@/lib/config";
import {
  PERSONAS_CACHE_TTL,
  bustPersonasCache,
  onPersonasInvalidated,
} from "./persona-cache";
import {
  personaRepoSchema,
  personaVersionListItemSchema,
  type PersonaDocumentResponse,
  type PersonaRepoResponse,
  type PersonaVersionListItem,
  type PersonaVersionResponse,
} from "./persona-schemas";
import { resolveConnectors } from "./connectors";
import { trackBrowserEvent } from "@/lib/analytics/events";
import type { Connector } from "@/lib/connector";
import type { Persona, PersonaStatus } from "./personas";

export const MAX_VERSIONS_PER_REPO = 5;

/** One version of an agent, camelCase. `active_version` on the wire is the
 *  WORKING draft; `published_version` is what's live — never conflate them. */
export class PersonaVersion {
  readonly id: string;
  readonly repoId: string;
  readonly name: string;
  readonly handle: string;
  readonly prompt: string;
  readonly description: string;
  readonly modelId: string | null;
  readonly imageUrl: string | null;
  readonly temperature: number | null;
  readonly tags: string[];
  readonly versionTags: string[];
  readonly connectorSlugs: string[];
  readonly blockedConnectorSlugs: string[];
  readonly documents: PersonaDocumentResponse[];
  readonly links: PersonaDocumentResponse[];
  readonly sourceShareId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;

  constructor(wire: PersonaVersionResponse) {
    this.id = wire.id;
    this.repoId = wire.persona_repo_id;
    this.name = wire.name;
    this.handle = wire.handler ? `@${wire.handler}` : "";
    this.prompt = wire.prompt;
    this.description = wire.description ?? "";
    this.modelId = wire.model_id;
    this.imageUrl = wire.image_url;
    this.temperature = wire.temperature;
    this.tags = wire.persona_tags;
    this.versionTags = wire.version_tags;
    this.connectorSlugs = wire.connectors;
    this.blockedConnectorSlugs = wire.blocked_connectors;
    this.documents = wire.documents;
    this.links = wire.links;
    this.sourceShareId = wire.source_share_id;
    this.createdAt = wire.created_at;
    this.updatedAt = wire.updated_at;
  }

  get connectors(): Connector[] {
    return resolveConnectors(this.connectorSlugs);
  }

  get blockedConnectors(): Connector[] {
    return resolveConnectors(this.blockedConnectorSlugs);
  }

  get hasSystemInstructions(): boolean {
    return !!this.prompt.trim();
  }

  get fileCount(): number {
    return this.documents.length;
  }

  get linkCount(): number {
    return this.links.length;
  }
}

/**
 * An agent as the FE thinks about it: the repo plus its two version pointers,
 * with the mutations that move them. Read through the collection
 * (fetchPersonaRepos / usePersonaRepos) so every consumer shares one cache;
 * every mutation here busts it, which re-renders the sidebar and /agents.
 */
export class PersonaRepo {
  readonly id: string;
  readonly name: string;
  readonly visibility: 'private' | 'team';
  readonly organizationId: string | null;
  readonly isActive: boolean;
  readonly liveVersion: PersonaVersion | null;
  readonly workingVersion: PersonaVersion | null;
  readonly liveVersionId: string | null;
  readonly workingVersionId: string | null;
  readonly publishedAt: string | null;
  readonly versionCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;

  constructor(wire: PersonaRepoResponse) {
    this.id = wire.id;
    this.name = wire.name;
    this.visibility = wire.visibility;
    this.organizationId = wire.organization_id;
    this.isActive = wire.is_active;
    this.liveVersion = wire.published_version ? new PersonaVersion(wire.published_version) : null;
    this.workingVersion = wire.active_version ? new PersonaVersion(wire.active_version) : null;
    this.liveVersionId = wire.published_version_id;
    this.workingVersionId = wire.active_version_id;
    this.publishedAt = wire.published_at;
    this.versionCount = wire.version_count;
    this.createdAt = wire.created_at;
    this.updatedAt = wire.updated_at;
  }

  /** The version chat and the library run: the live one, else the draft. */
  get currentVersion(): PersonaVersion | null {
    return this.liveVersion ?? this.workingVersion;
  }

  get isPublished(): boolean {
    return this.liveVersionId !== null;
  }

  get isPaused(): boolean {
    return !this.isActive;
  }

  get status(): PersonaStatus {
    if (!this.isActive) return "paused";
    return this.isPublished ? "active" : "draft";
  }

  get handle(): string {
    return this.currentVersion?.handle
      || `@${this.name.toLowerCase().replace(/\s+/g, "_")}`;
  }

  get imageUrl(): string | null {
    return this.currentVersion?.imageUrl ?? null;
  }

  get description(): string {
    return this.currentVersion?.description ?? "";
  }

  get tags(): string[] {
    return this.currentVersion?.tags ?? [];
  }

  get connectors(): Connector[] {
    return this.currentVersion?.connectors ?? [];
  }

  get canAddVersion(): boolean {
    return this.versionCount < MAX_VERSIONS_PER_REPO;
  }

  async listVersions(): Promise<PersonaVersionListItem[]> {
    const raw = await apiFetchJson<unknown>(PERSONA_VERSIONS_ENDPOINT(this.id));
    return personaVersionListItemSchema.array().parse(raw);
  }

  /** PATCH the working (draft) pointer — NOT what chat runs. */
  async setWorkingVersion(versionId: string): Promise<PersonaRepo> {
    const wire = personaRepoSchema.parse(await apiFetchJson<unknown>(PERSONA_ACTIVE_ENDPOINT(this.id), {
      method: 'PATCH',
      body: JSON.stringify({ persona_id: versionId }),
    }));
    bustPersonasCache();
    return new PersonaRepo(wire);
  }

  async publish(versionId: string): Promise<PersonaRepo> {
    const wire = personaRepoSchema.parse(await apiFetchJson<unknown>(PERSONA_PUBLISH_ENDPOINT(this.id), {
      method: 'POST',
      body: JSON.stringify({ persona_id: versionId }),
    }));
    trackBrowserEvent("agent_published");
    bustPersonasCache();
    return new PersonaRepo(wire);
  }

  async pause(): Promise<void> {
    const res = await apiFetch(PERSONA_PAUSE_ENDPOINT(this.id), { method: 'PATCH' });
    if (!res.ok) throw new Error(`Failed to toggle pause (status ${res.status})`);
    bustPersonasCache();
  }

  async setVisibility(visibility: 'private' | 'team', teamIds?: string[]): Promise<void> {
    const body: Record<string, unknown> = { visibility };
    if (visibility === 'team' && teamIds?.length) body.teamIds = teamIds;
    await apiFetch(PERSONA_VISIBILITY_ENDPOINT(this.id), { method: 'PATCH', body: JSON.stringify(body) });
    bustPersonasCache();
  }

  async delete(): Promise<void> {
    const res = await apiFetch(PERSONA_DETAIL_ENDPOINT(this.id), { method: 'DELETE' });
    if (!res.ok && res.status !== 204) throw new Error(`Failed to delete persona (status ${res.status})`);
    bustPersonasCache();
  }

  /** Flat projection used by list cards and pickers. */
  toPersona(): Persona {
    const v = this.currentVersion;
    return {
      id: this.id,
      name: this.name,
      handle: this.handle,
      description: this.description,
      imageUrl: this.imageUrl,
      modelId: v?.modelId ?? null,
      tags: this.tags,
      temperature: v?.temperature ?? null,
      isActive: this.isActive,
      isPaused: this.isPaused,
      status: this.status,
      activeVersionId: this.liveVersionId,
      workingVersionId: this.workingVersionId,
      publishedAt: this.publishedAt,
      versionCount: this.versionCount,
      visibility: this.visibility,
      connectorSlugs: v?.connectorSlugs ?? [],
      blockedConnectorSlugs: v?.blockedConnectorSlugs ?? [],
      hasSystemInstructions: v !== null ? v.hasSystemInstructions : this.isPublished,
      sourceShareId: v?.sourceShareId ?? null,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

/** The agents this viewer can see, as one queryable set. */
export class PersonaRepoCollection {
  private readonly byId: Map<string, PersonaRepo>;
  readonly repos: PersonaRepo[];

  constructor(repos: PersonaRepo[]) {
    this.repos = repos;
    this.byId = new Map(repos.map(repo => [repo.id, repo]));
  }

  get size(): number {
    return this.repos.length;
  }

  all(): PersonaRepo[] {
    return this.repos;
  }

  get(repoId: string): PersonaRepo | null {
    return this.byId.get(repoId) ?? null;
  }

  published(): PersonaRepo[] {
    return this.repos.filter(repo => repo.isPublished);
  }

  drafts(): PersonaRepo[] {
    return this.repos.filter(repo => repo.status === "draft");
  }

  /** Agents deployed to one team. `sharedRepoIds` comes from
   *  fetchTeamSharedRepoIds — personas carry no team field of their own, so an
   *  unknown deploy set scopes to nothing rather than to everything. */
  forTeam(teamId: string | null | undefined, sharedRepoIds: Set<string> | null | undefined): PersonaRepo[] {
    if (!teamId) return this.repos;
    if (!sharedRepoIds) return [];
    return this.repos.filter(repo => repo.visibility === 'team' && sharedRepoIds.has(repo.id));
  }

  toPersonas(): Persona[] {
    return this.repos.map(repo => repo.toPersona());
  }
}

// ── The shared collection ─────────────────────────────────────────────────────

let _cache: { data: PersonaRepoCollection; time: number } | null = null
let _inFlight: Promise<PersonaRepoCollection> | null = null

onPersonasInvalidated(() => {
  _cache = null
  _inFlight = null
})

/** GET /persona — one request, one cache, shared by every consumer. */
export function fetchPersonaRepos(): Promise<PersonaRepoCollection> {
  if (_cache && Date.now() - _cache.time < PERSONAS_CACHE_TTL) return Promise.resolve(_cache.data)
  if (_inFlight) return _inFlight
  _inFlight = apiFetchJson<unknown>(PERSONAS_ENDPOINT)
    .then(raw => {
      const collection = new PersonaRepoCollection(
        personaRepoSchema.array().parse(raw).map(wire => new PersonaRepo(wire)),
      )
      _cache = { data: collection, time: Date.now() }
      return collection
    })
    .finally(() => { _inFlight = null })
  return _inFlight
}

/** GET /persona/{repo_id} */
export async function fetchPersonaRepo(repoId: string): Promise<PersonaRepo> {
  const raw = await apiFetchJson<unknown>(PERSONA_DETAIL_ENDPOINT(repoId))
  return new PersonaRepo(personaRepoSchema.parse(raw))
}
