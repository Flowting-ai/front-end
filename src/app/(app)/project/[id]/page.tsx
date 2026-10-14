'use client'

import { useParams } from 'next/navigation'
import { ProjectScreen } from '@/components/Projects/project-page/ProjectScreen'

// Keyed by id: switching projects in the sidebar remounts the screen, so no draft, open panel or
// dialog carries over from the previous project.
export default function ProjectPage() {
  const params = useParams<{ id: string }>()
  return <ProjectScreen key={params.id} projectId={params.id} />
}
