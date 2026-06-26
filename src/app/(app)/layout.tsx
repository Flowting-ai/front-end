import "katex/dist/katex.min.css";
import "highlight.js/styles/atom-one-light.css";
import { AppLayout } from "@/components/layout/AppLayout";
import { ChatHistoryProvider } from "@/context/chat-history-context";
import { PinboardProvider } from "@/context/pinboard-context";
import { HighlightProvider } from "@/context/highlight-context";
import { CompareProvider } from "@/context/compare-context";
import { ModelSelectorProvider } from "@/context/model-selector-context";
import { PresetModelSelectorDialog } from "@/components/chat/PresetModelSelectorDialog";
import { ProjectsProvider } from "@/context/projects-context";
import { OnboardingGuard } from "@/components/shared/OnboardingGuard";
import { PlanUpgradeToast } from "@/components/shared/PlanUpgradeToast";
import { SearchProvider } from "@/context/search-context";
import { OrgProvider } from "@/context/org-context";

export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OnboardingGuard>
      <OrgProvider>
      <ProjectsProvider>
        <ChatHistoryProvider>
          <PinboardProvider>
            <HighlightProvider>
              <CompareProvider>
                <ModelSelectorProvider>
                  <SearchProvider>
                    <AppLayout>{children}</AppLayout>
                    <PresetModelSelectorDialog />
                    <PlanUpgradeToast />
                  </SearchProvider>
                </ModelSelectorProvider>
              </CompareProvider>
            </HighlightProvider>
          </PinboardProvider>
        </ChatHistoryProvider>
      </ProjectsProvider>
      </OrgProvider>
    </OnboardingGuard>
  );
}
