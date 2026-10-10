export type Case = {
  id: "diagnosis" | "comparison" | "approval";
  question: string;
  claim: string;
  evidence: { id: string; label: string; value: string; source: string }[];
  uncertainty: string;
  nextStep: string;
  action: null | { id: string; label: string; state: "proposal_only" };
};

// Fictional, frozen inputs. Every renderer receives these exact strings.
export const cases: Case[] = [
  {
    id: "diagnosis",
    question: "Why did sales fall last week?",
    claim: "Revenue fell 12.0% last week. Fewer sessions contributed; the underlying cause is not confirmed.",
    evidence: [
      { id: "revenue", label: "Revenue", value: "$43,800 · −12.0%", source: "Synthetic Shopify snapshot" },
      { id: "sessions", label: "Sessions", value: "32,600 · −16.2%", source: "Synthetic Shopify snapshot" },
      { id: "conversion", label: "Conversion", value: "2.49% · +0.17 pp", source: "Synthetic Shopify snapshot" }
    ],
    uncertainty: "The cause of the traffic decline has not been established.",
    nextStep: "Inspect acquisition channels for the lost sessions.",
    action: null
  },
  {
    id: "comparison",
    question: "Why do Shopify and Klaviyo report different revenue?",
    claim: "The reported revenue totals differ, but they use different attribution definitions.",
    evidence: [
      { id: "shopify", label: "Shopify sales", value: "$51,200", source: "Synthetic Shopify snapshot" },
      { id: "klaviyo", label: "Klaviyo attributed revenue", value: "$18,400", source: "Synthetic Klaviyo snapshot" }
    ],
    uncertainty: "These figures cannot be reconciled until timezone and attribution windows are aligned.",
    nextStep: "Compare order IDs using one timezone and the same date range.",
    action: null
  },
  {
    id: "approval",
    question: "Should we pause the underperforming campaign?",
    claim: "Campaign spend is rising without a matching increase in attributed orders.",
    evidence: [
      { id: "spend", label: "Spend", value: "$1,240 · +22%", source: "Synthetic ad-platform snapshot" },
      { id: "orders", label: "Attributed orders", value: "19 · unchanged", source: "Synthetic ad-platform snapshot" }
    ],
    uncertainty: "Attribution lag may change the final return estimate.",
    nextStep: "Review campaign settings and attribution lag before deciding.",
    action: { id: "pause-campaign", label: "Approve campaign pause", state: "proposal_only" }
  }
];
