import { z } from "zod";

export const AuditOutputSchema = z.object({
  plainEnglishSummary: z
    .string()
    .describe("A short summary translating the bill and key findings into plain English."),
  decodedLineItems: z
    .array(
      z.object({
        originalDescription: z
          .string()
          .describe("Original medical description or billing code."),
        plainEnglishMeaning: z
          .string()
          .describe("Clear, everyday explanation of what was performed or provided."),
        commonBillingErrors: z
          .string()
          .describe("Common billing pitfalls for this item (e.g. upcoding, unbundling, duplicate charge)."),
      })
    )
    .describe("Decoded breakdown of all line items."),
  bundlingOpportunities: z
    .array(
      z.object({
        unbundledCodes: z
          .array(z.string())
          .describe("The separate codes or descriptions that should legally be combined/bundled."),
        recommendedBundledCode: z
          .string()
          .describe("The comprehensive single CPT/HCPCS code that encompasses these services."),
        explanation: z
          .string()
          .describe("Why billing these codes separately violates NCCI or standard bundling rules."),
        estimatedSavings: z
          .number()
          .describe("Estimated excess billed amount or patient savings if bundled."),
      })
    )
    .describe(
      "Detected instances of improper unbundling where multiple codes should be combined. Return an empty array if none detected."
    ),
  disputeScript: z
    .object({
      openingStatement: z
        .string()
        .describe("Professional opening statement to use when contacting the billing department."),
      questionsToAsk: z
        .array(z.string())
        .describe("Targeted questions to challenge improper charges, unbundling, or balance billing."),
      escalationPhrase: z
        .string()
        .describe("Formal escalation statement referencing statutory rights (e.g. No Surprises Act)."),
    })
    .describe("Phone dispute script for patient advocacy."),
  disputeEmail: z
    .object({
      subject: z.string().describe("Clear email subject line referencing invoice dispute."),
      body: z.string().describe("Formal written dispute email text ready to send to billing."),
    })
    .describe("Written dispute email template for patient advocacy."),
});

export type AuditOutput = z.infer<typeof AuditOutputSchema>;

export const AuditRequestSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().max(50).default("item"),
        description: z.string().max(200).default("Medical Procedure"),
        billedAmount: z.number().min(0).default(0),
        allowedAmount: z.number().min(0).optional(),
      })
    )
    .min(1, "At least one line item is required.")
    .max(50, "A maximum of 50 line items can be audited at once."),
  insurance: z.object({
    deductibleRemaining: z.number().min(0).default(0),
    coinsurancePercent: z.number().min(0).max(100).default(0),
    outOfPocketRemaining: z.number().min(0).optional(),
    copay: z.number().min(0).default(0),
  }),
  amountClinicDemands: z.number().min(0, "Demanded amount cannot be negative."),
});

export type AuditRequest = z.infer<typeof AuditRequestSchema>;

import type { runDeterministicAudit } from "./audit-engine";

export function getFallbackAdvocateAnalysis(
  items: AuditRequest["items"],
  mathAudit: ReturnType<typeof runDeterministicAudit>,
  amountClinicDemands: number
): AuditOutput {
  const criticalFlag = mathAudit.flags.find((f) => f.severity === "CRITICAL");
  const matchingLabItems = items.filter((i) => {
    const desc = i.description.toLowerCase();
    return desc.includes("venipuncture") || desc.includes("panel");
  });
  const hasVenipunctureAndPanel =
    matchingLabItems.some((i) => i.description.toLowerCase().includes("venipuncture")) &&
    matchingLabItems.some((i) => i.description.toLowerCase().includes("panel"));

  const bundlingOpportunities = hasVenipunctureAndPanel
    ? [
        {
          unbundledCodes: matchingLabItems.map((i) => i.description),
          recommendedBundledCode: "CMS Comprehensive Episode / Global Service",
          explanation:
            "Separate itemization of routine venipuncture alongside primary diagnostic panels violates NCCI component-to-comprehensive bundling rules.",
          estimatedSavings:
            Math.round(
              Math.max(
                0,
                Math.min(
                  matchingLabItems[0]?.billedAmount || 0,
                  matchingLabItems[1]?.billedAmount || 0
                ) * 0.25
              ) * 100
            ) / 100,
        },
      ]
    : [];

  return {
    plainEnglishSummary: `This medical statement contains charges totaling $${mathAudit.totalBilled.toFixed(2)}. Insurance negotiated the allowable covered rate to $${mathAudit.totalAllowed.toFixed(2)}, leaving a calculated patient obligation of $${mathAudit.calculatedPatientOwes.toFixed(2)}. The clinic demands $${amountClinicDemands.toFixed(2)}${criticalFlag ? `, which includes an improper overcharge of $${criticalFlag.potentialSavings.toFixed(2)}.` : "."}`,
    decodedLineItems: items.map((item) => ({
      originalDescription: item.description,
      plainEnglishMeaning: `Clinical service billed at $${item.billedAmount.toFixed(2)}${item.allowedAmount !== undefined ? ` with in-network allowable of $${item.allowedAmount.toFixed(2)}` : ""}.`,
      commonBillingErrors:
        item.allowedAmount !== undefined && item.billedAmount > item.allowedAmount
          ? "Contractual write-off: participating providers cannot balance bill this difference to the patient."
          : "Verify that facility charges do not duplicate routine tray or supply fees.",
    })),
    bundlingOpportunities,
    disputeScript: {
      openingStatement: `Hello, I am calling regarding my recent bill for ${items[0]?.description || "medical services"}. According to my Explanation of Benefits, my patient cost-sharing responsibility is $${mathAudit.calculatedPatientOwes.toFixed(2)}.`,
      questionsToAsk: [
        `My Explanation of Benefits specifies my legal patient responsibility is $${mathAudit.calculatedPatientOwes.toFixed(2)}. Why does your statement demand $${amountClinicDemands.toFixed(2)}?`,
        "Have all in-network contractual adjustments and provider write-offs been credited to my account?",
        ...(bundlingOpportunities.length > 0
          ? ["Do any of these line items violate NCCI bundling edits that should have been billed under a single comprehensive code?"]
          : []),
        "Can you issue an updated itemized statement with the corrected patient responsibility balance?",
      ],
      escalationPhrase:
        "Under federal and state balance billing protections, NCCI coding standards, and participating provider contracts, billing unbundled codes or demanding amounts above the insurer-approved patient cost share is non-compliant. Please place an administrative hold on this invoice while your billing supervisor reviews it.",
    },
    disputeEmail: {
      subject: `Formal Billing Dispute - Statement Review for ${items[0]?.description || "Recent Medical Services"}`,
      body: `Dear Billing Department,

I am writing to formally dispute the current statement balance of $${amountClinicDemands.toFixed(2)} regarding services billed for ${items.map((i) => i.description).join(", ")}.

According to my insurer's Explanation of Benefits (EOB), the covered allowable amount is $${mathAudit.totalAllowed.toFixed(2)}, and my adjudicated patient cost-sharing responsibility is $${mathAudit.calculatedPatientOwes.toFixed(2)}.

${criticalFlag ? `Your statement includes an apparent discrepancy/overcharge of $${criticalFlag.potentialSavings.toFixed(2)}. Under network provider agreements and statutory billing regulations (including the No Surprises Act), patients cannot be billed for contractual write-offs exceeding approved cost-sharing.\n\n` : ""}Please place an administrative hold on this invoice, credit any missing contractual adjustments, and provide an updated itemized statement reflecting the accurate patient responsibility.

Sincerely,
[Your Name]
[Account / Invoice Number]`,
    },
  };
}

