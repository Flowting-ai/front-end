import "katex/dist/katex.min.css";
import "highlight.js/styles/atom-one-light.css";
import { cookies } from "next/headers";
import { AppLayout } from "@/components/layout/AppLayout";
import { ChatHistoryProvider } from "@/context/chat-history-context";
import { PinboardProvider } from "@/context/pinboard-context";
import { HighlightProvider } from "@/context/highlight-context";
import { CompareProvider } from "@/context/compare-context";
import { ModelSelectorProvider } from "@/context/model-selector-context";
import { LazyPresetModelSelectorDialog } from "@/components/chat/LazyPresetModelSelectorDialog";
import { ProjectsProvider } from "@/context/projects-context";
import { ProjectPanelProvider } from "@/context/project-panel-context";
import { OnboardingGuard } from "@/components/shared/OnboardingGuard";
import { PlanUpgradeToast } from "@/components/shared/PlanUpgradeToast";
import { ConnectorAuthResultToast } from "@/components/shared/ConnectorAuthResultToast";
import { SearchProvider } from "@/context/search-context";
import { OrgProvider } from "@/context/org-context";
import { OrgStamps } from "@/components/Analytics/OrgStamps";
import { NotificationsProvider } from "@/context/notifications-context";
import { NavGuardProvider, NavGuardModal } from "@/context/nav-guard-context";
import { SIDEBAR_COLLAPSED_KEY, parseSidebarCollapsed } from "@/lib/storage-keys";

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read the sidebar's collapsed state from its cookie here, on the server, so
  // the server-rendered sidebar matches the client's first render (it used to
  // read localStorage during render and mismatch on hydration).
  const sidebarCollapsed = parseSidebarCollapsed((await cookies()).get(SIDEBAR_COLLAPSED_KEY)?.value);

  return (
    <OnboardingGuard>
      <NavGuardProvider>
      <NavGuardModal />
      <OrgProvider>
      <OrgStamps />
      <NotificationsProvider>
      <ProjectsProvider>
        <ChatHistoryProvider>
          <PinboardProvider>
            <HighlightProvider>
              <CompareProvider>
                <ModelSelectorProvider>
                  <SearchProvider>
                    <ProjectPanelProvider>
                      <AppLayout defaultSidebarCollapsed={sidebarCollapsed}>
                        {children}
                      </AppLayout>
                    </ProjectPanelProvider>
                    <LazyPresetModelSelectorDialog />
                    <PlanUpgradeToast />
                    <ConnectorAuthResultToast />
                  </SearchProvider>
                </ModelSelectorProvider>
              </CompareProvider>
            </HighlightProvider>
          </PinboardProvider>
        </ChatHistoryProvider>
      </ProjectsProvider>
      </NotificationsProvider>
      </OrgProvider>
      </NavGuardProvider>
    </OnboardingGuard>
  );
}
