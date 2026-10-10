import { z } from "zod";
import type { Case } from "./fixtures";

export const OutputRecord = z.object({
  catalogVersion: z.literal("souvenir-output-0.1"),
  caseId: z.enum(["diagnosis", "comparison", "approval"]),
  claim: z.object({ text: z.string().min(1), evidenceIds: z.array(z.string()).min(1) }),
  evidence: z.array(z.object({
    id: z.string().min(1), label: z.string().min(1), value: z.string().min(1),
    source: z.string().min(1), status: z.literal("synthetic")
  })).min(1),
  uncertainty: z.string().min(1),
  nextStep: z.string().min(1),
  action: z.nullable(z.object({ id: z.string().min(1), label: z.string().min(1), state: z.literal("proposal_only") }))
});
export type OutputRecord = z.infer<typeof OutputRecord>;

export function fromCase(c: Case): OutputRecord {
  return {
    catalogVersion: "souvenir-output-0.1", caseId: c.id,
    claim: { text: c.claim, evidenceIds: c.evidence.map(e => e.id) },
    evidence: c.evidence.map(e => ({ ...e, status: "synthetic" })),
    uncertainty: c.uncertainty, nextStep: c.nextStep, action: c.action
  };
}

// This comparison guard has a frozen source. Production must bind the same checks
// to authorized connector snapshots and server-side authority state.
export function validateAgainstSource(raw: unknown, source: Case) {
  const parsed = OutputRecord.safeParse(raw);
  if (!parsed.success) return { valid: false, reasons: ["schema"] };
  const actual = parsed.data;
  const expected = fromCase(source);
  const reasons: string[] = [];
  if (actual.caseId !== source.id) reasons.push("case-id");
  if (actual.claim.text !== expected.claim.text) reasons.push("claim");
  if (JSON.stringify(actual.claim.evidenceIds) !== JSON.stringify(expected.claim.evidenceIds)) reasons.push("claim-evidence-links");
  if (JSON.stringify(actual.evidence) !== JSON.stringify(expected.evidence)) reasons.push("evidence");
  if (actual.uncertainty !== expected.uncertainty) reasons.push("uncertainty");
  if (actual.nextStep !== expected.nextStep) reasons.push("next-step");
  if (JSON.stringify(actual.action) !== JSON.stringify(expected.action)) reasons.push("action-authority");
  return { valid: reasons.length === 0, reasons };
}
