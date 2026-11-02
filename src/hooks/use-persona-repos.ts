'use client'

import { useQuery } from '@tanstack/react-query'
import { PersonaRepoCollection, personaReposQuery } from '@/lib/api/persona-repo'

const EMPTY = new PersonaRepoCollection([])

/** The shared agent collection (React Query, PERSONA_REPOS_QUERY_KEY). Every
 *  mutation calls bustPersonasCache(), which invalidates the ["personas"]
 *  prefix, so every consumer refetches and sees the same set. */
export function usePersonaRepos() {
  const query = useQuery(personaReposQuery())
  return {
    repos: query.data ?? EMPTY,
    isLoading: query.isPending,
    error: query.error ?? null,
  }
}

/** One agent by id, from the shared collection. */
export function usePersonaRepoById(repoId: string | null | undefined) {
  const { repos, isLoading, error } = usePersonaRepos()
  return { repo: repoId ? repos.get(repoId) : null, isLoading, error }
}
