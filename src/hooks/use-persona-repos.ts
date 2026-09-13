'use client'

import { useEffect, useState } from 'react'
import { PersonaRepoCollection, fetchPersonaRepos } from '@/lib/api/persona-repo'
import { PERSONAS_LIST_UPDATED_EVENT } from '@/lib/api/persona-cache'

const EMPTY = new PersonaRepoCollection([])

/** The shared agent collection. Refetches whenever any mutation busts the
 *  persona cache, so every consumer sees the same set. */
export function usePersonaRepos() {
  const [state, setState] = useState<{
    repos: PersonaRepoCollection
    isLoading: boolean
    error: unknown
  }>({ repos: EMPTY, isLoading: true, error: null })

  useEffect(() => {
    let cancelled = false

    function load() {
      fetchPersonaRepos()
        .then(repos => { if (!cancelled) setState({ repos, isLoading: false, error: null }) })
        .catch(error => { if (!cancelled) setState({ repos: EMPTY, isLoading: false, error }) })
    }

    load()
    window.addEventListener(PERSONAS_LIST_UPDATED_EVENT, load)
    return () => {
      cancelled = true
      window.removeEventListener(PERSONAS_LIST_UPDATED_EVENT, load)
    }
  }, [])

  return state
}

/** One agent by id, from the shared collection. Named ...ById because
 *  `usePersonaRepo` in lib/api/personas is the POST /use copy call, not a hook. */
export function usePersonaRepoById(repoId: string | null | undefined) {
  const { repos, isLoading, error } = usePersonaRepos()
  return { repo: repoId ? repos.get(repoId) : null, isLoading, error }
}
