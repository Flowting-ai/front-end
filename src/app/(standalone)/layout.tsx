import { OrgProvider } from '@/context/org-context'
import { OnboardingGuard } from '@/components/shared/OnboardingGuard'

export default function StandaloneLayout({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingGuard>
      <OrgProvider>
        {children}
      </OrgProvider>
    </OnboardingGuard>
  )
}
