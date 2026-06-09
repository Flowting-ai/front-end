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
import { SearchProvider } from "@/context/search-context";

export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OnboardingGuard>
      <ProjectsProvider>
        <ChatHistoryProvider>
          <PinboardProvider>
            <HighlightProvider>
              <CompareProvider>
                <ModelSelectorProvider>
                  <SearchProvider>
                    <AppLayout>{children}</AppLayout>
                    <PresetModelSelectorDialog />
                  </SearchProvider>
                </ModelSelectorProvider>
              </CompareProvider>
            </HighlightProvider>
          </PinboardProvider>
        </ChatHistoryProvider>
      </ProjectsProvider>
    </OnboardingGuard>
  );
}
