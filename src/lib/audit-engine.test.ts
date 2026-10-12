import assert from "node:assert";
import { runDeterministicAudit, type LineItem, type InsuranceProfile } from "./audit-engine";
import {
  AuditOutputSchema,
  AuditRequestSchema,
  getFallbackAdvocateAnalysis,
} from "./schema";

// Test 1: Standard deductible, coinsurance, copay within OOP limit
{
  const items: LineItem[] = [
    { id: "1", description: "Office Visit", billedAmount: 300, allowedAmount: 200 },
    { id: "2", description: "Blood Work", billedAmount: 150, allowedAmount: 100 },
  ];
  // totalBilled = 450, totalAllowed = 300
  // deductible remaining: 100 -> pays 100, remainder 200
  // coinsurance 20% on 200 -> 40
  // copay -> 30
  // patient owes = 100 + 40 + 30 = 170 (OOP remaining 500)
  const insurance: InsuranceProfile = {
    deductibleRemaining: 100,
    coinsurancePercent: 20,
    outOfPocketRemaining: 500,
    copay: 30,
  };

  const result = runDeterministicAudit(items, insurance, 170);
  assert.strictEqual(result.totalBilled, 450);
  assert.strictEqual(result.totalAllowed, 300);
  assert.strictEqual(result.calculatedPatientOwes, 170);
  assert.strictEqual(result.flags.length, 0);
}

// Test 2: Out of Pocket Remaining Cap
{
  const items: LineItem[] = [
    { id: "1", description: "Emergency Room", billedAmount: 2000, allowedAmount: 1500 },
  ];
  const insurance: InsuranceProfile = {
    deductibleRemaining: 1000,
    coinsurancePercent: 20,
    outOfPocketRemaining: 400, // strictly caps patient obligation
    copay: 50,
  };

  const result = runDeterministicAudit(items, insurance, 400);
  assert.strictEqual(result.calculatedPatientOwes, 400);
  assert.strictEqual(result.flags.length, 0);
}

// Test 3: Potential Overcharge and Illegal Balance Billing flags
{
  const items: LineItem[] = [
    { id: "1", description: "Surgery", billedAmount: 5000, allowedAmount: 3000 },
  ];
  // totalBilled = 5000, totalAllowed = 3000 (contractual diff = 2000)
  // Deductible = 0, Coinsurance 10% on 3000 = 300, Copay 0, OOP 2000 -> patient owes 300
  const insurance: InsuranceProfile = {
    deductibleRemaining: 0,
    coinsurancePercent: 10,
    outOfPocketRemaining: 2000,
    copay: 0,
  };

  // Clinic demands full $5000 (overcharge of 4700, balance billing difference of 2000)
  const result = runDeterministicAudit(items, insurance, 5000);
  assert.strictEqual(result.calculatedPatientOwes, 300);
  assert.strictEqual(result.flags.length, 2);

  const overchargeFlag = result.flags.find((f) => f.title === "Potential Overcharge");
  assert(overchargeFlag, "Must have Potential Overcharge flag");
  assert.strictEqual(overchargeFlag.severity, "CRITICAL");
  assert.strictEqual(overchargeFlag.potentialSavings, 4700);

  const balanceFlag = result.flags.find((f) => f.title === "Illegal Balance Billing");
  assert(balanceFlag, "Must have Illegal Balance Billing flag");
  assert.strictEqual(balanceFlag.severity, "CRITICAL");
  assert.strictEqual(balanceFlag.potentialSavings, 2000);
}

// Test 4: Overcharge without balance billing (when totalBilled === totalAllowed)
{
  const items: LineItem[] = [
    { id: "1", description: "Consultation", billedAmount: 200, allowedAmount: 200 },
  ];
  const insurance: InsuranceProfile = {
    deductibleRemaining: 0,
    coinsurancePercent: 0,
    outOfPocketRemaining: 1000,
    copay: 25,
  };

  const result = runDeterministicAudit(items, insurance, 100);
  assert.strictEqual(result.calculatedPatientOwes, 25);
  assert.strictEqual(result.flags.length, 1);
  assert.strictEqual(result.flags[0].title, "Potential Overcharge");
  assert.strictEqual(result.flags[0].potentialSavings, 75);
}

// Test 5: Sub-allowable charge overage (deductible error) does not trigger balance billing
{
  const items: LineItem[] = [
    { id: "1", description: "Procedure", billedAmount: 1000, allowedAmount: 600 },
  ];
  const insurance: InsuranceProfile = {
    deductibleRemaining: 0,
    coinsurancePercent: 0,
    outOfPocketRemaining: 0,
    copay: 0,
  };

  const result = runDeterministicAudit(items, insurance, 200);
  assert.strictEqual(result.calculatedPatientOwes, 0);
  assert.strictEqual(result.flags.length, 1);
  assert.strictEqual(result.flags[0].title, "Potential Overcharge");
  assert.strictEqual(result.flags[0].potentialSavings, 200);
}

// Test 6: AuditOutputSchema validates bundling opportunities
{
  const mockAdvocateOutput = {
    plainEnglishSummary: "Test summary",
    decodedLineItems: [
      {
        originalDescription: "CPT 99285",
        plainEnglishMeaning: "Emergency visit",
        commonBillingErrors: "Check unbundling",
      },
    ],
    bundlingOpportunities: [
      {
        unbundledCodes: ["CPT 99285", "CPT 71046"],
        recommendedBundledCode: "CMS Comprehensive Episode",
        explanation: "Inclusive service under NCCI",
        estimatedSavings: 150,
      },
    ],
    disputeScript: {
      openingStatement: "Hello",
      questionsToAsk: ["Why was this unbundled?"],
      escalationPhrase: "NCCI guidelines require bundling.",
    },
    disputeEmail: {
      subject: "Billing Dispute - Account Review Request",
      body: "Please review the charges for services provided.",
    },
  };

  const parsed = AuditOutputSchema.safeParse(mockAdvocateOutput);
  assert.strictEqual(parsed.success, true);
  if (parsed.success) {
    assert.strictEqual(parsed.data.bundlingOpportunities.length, 1);
    assert.strictEqual(
      parsed.data.bundlingOpportunities[0].recommendedBundledCode,
      "CMS Comprehensive Episode"
    );
  }
}

// Test 7: Coinsurance 1% is computed as 1% (not 100%)
{
  const items: LineItem[] = [
    { id: "1", description: "Infusion", billedAmount: 1000, allowedAmount: 1000 },
  ];
  const insurance: InsuranceProfile = {
    deductibleRemaining: 0,
    coinsurancePercent: 1,
    outOfPocketRemaining: 1000,
    copay: 0,
  };
  const result = runDeterministicAudit(items, insurance, 10);
  assert.strictEqual(result.calculatedPatientOwes, 10);
  assert.strictEqual(result.flags.length, 0);
}

// Test 8: Patient cost-sharing cannot exceed total allowed amount
{
  const items: LineItem[] = [
    { id: "1", description: "Therapy", billedAmount: 100, allowedAmount: 50 },
  ];
  const insurance: InsuranceProfile = {
    deductibleRemaining: 50,
    coinsurancePercent: 20,
    outOfPocketRemaining: 1000,
    copay: 40,
  };
  // totalAllowed is 50. Even with deductible (50) + copay (40), max patient responsibility is 50.
  const result = runDeterministicAudit(items, insurance, 50);
  assert.strictEqual(result.calculatedPatientOwes, 50);
}

// Test 9: Omitted outOfPocketRemaining does not cap patient responsibility to 0
{
  const items: LineItem[] = [
    { id: "1", description: "Procedure", billedAmount: 500, allowedAmount: 500 },
  ];
  const insurance: InsuranceProfile = {
    deductibleRemaining: 300,
    coinsurancePercent: 0,
    copay: 0,
  };
  const result = runDeterministicAudit(items, insurance, 300);
  assert.strictEqual(result.calculatedPatientOwes, 300);
  assert.strictEqual(result.flags.length, 0);
}

// Test 10: AuditRequestSchema validates bounds and rejects negative amounts
{
  const invalid = AuditRequestSchema.safeParse({
    items: [{ id: "1", description: "Test", billedAmount: -10 }],
    insurance: { deductibleRemaining: 0, coinsurancePercent: 0, copay: 0 },
    amountClinicDemands: 100,
  });
  assert.strictEqual(invalid.success, false);

  const valid = AuditRequestSchema.safeParse({
    items: [{ id: "1", description: "Test", billedAmount: 100 }],
    insurance: { deductibleRemaining: 0, coinsurancePercent: 0, copay: 0 },
    amountClinicDemands: 100,
  });
  assert.strictEqual(valid.success, true);
}

// Test 11: Fallback unbundling isolates matching lab items regardless of item position
{
  const items = [
    { id: "1", description: "CPT 71046 - Chest X-Ray", billedAmount: 700, allowedAmount: 150 },
    { id: "2", description: "CPT 99214 - Specialist Consultation", billedAmount: 250, allowedAmount: 200 },
    { id: "3", description: "CPT 80053 - Comprehensive Metabolic Panel", billedAmount: 180, allowedAmount: 45 },
    { id: "4", description: "CPT 36415 - Routine Venipuncture", billedAmount: 65, allowedAmount: 15 },
  ];
  const mathAudit = runDeterministicAudit(
    items,
    { deductibleRemaining: 0, coinsurancePercent: 20, copay: 0 },
    1200
  );
  const fallback = getFallbackAdvocateAnalysis(items, mathAudit, 1200);
  assert.strictEqual(fallback.bundlingOpportunities.length, 1);
  const opportunity = fallback.bundlingOpportunities[0];
  assert.strictEqual(opportunity.unbundledCodes.length, 2);
  assert(opportunity.unbundledCodes.some((c) => c.includes("Metabolic Panel")));
  assert(opportunity.unbundledCodes.some((c) => c.includes("Venipuncture")));
  assert(!opportunity.unbundledCodes.some((c) => c.includes("Chest X-Ray")));

  const parsed = AuditOutputSchema.safeParse(fallback);
  assert.strictEqual(parsed.success, true);
}

console.log("All deterministic audit engine assert tests passed successfully!");
