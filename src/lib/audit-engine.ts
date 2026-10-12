export interface LineItem {
  id: string;
  description: string;
  billedAmount: number;
  allowedAmount?: number;
}

export interface InsuranceProfile {
  deductibleRemaining: number;
  coinsurancePercent: number;
  outOfPocketRemaining?: number;
  copay: number;
}

export interface AuditFlag {
  severity: "CRITICAL" | "WARNING";
  title: string;
  description: string;
  potentialSavings: number;
}

export interface DeterministicAuditResult {
  totalBilled: number;
  totalAllowed: number;
  calculatedPatientOwes: number;
  amountClinicDemands: number;
  flags: AuditFlag[];
}

function roundToCents(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function runDeterministicAudit(
  items: LineItem[],
  insurance: InsuranceProfile,
  amountClinicDemands: number
): DeterministicAuditResult {
  const totalBilled = roundToCents(
    items.reduce((sum, item) => sum + item.billedAmount, 0)
  );

  const totalAllowed = roundToCents(
    items.reduce(
      (sum, item) =>
        sum + (item.allowedAmount !== undefined ? item.allowedAmount : item.billedAmount),
      0
    )
  );

  // Apply deductible to covered allowed charges first
  const safeDeductible = Number(insurance?.deductibleRemaining) || 0;
  const safeCoinsurance = Number(insurance?.coinsurancePercent) || 0;
  const safeOop =
    insurance?.outOfPocketRemaining !== undefined
      ? Number(insurance.outOfPocketRemaining)
      : Infinity;
  const safeCopay = Number(insurance?.copay) || 0;

  const deductiblePayment = Math.min(Math.max(0, safeDeductible), totalAllowed);
  const remainderAfterDeductible = Math.max(0, totalAllowed - deductiblePayment);

  // Apply coinsurance to remaining allowed amount (percentage in 0..100)
  const coinsuranceRate = Math.max(0, safeCoinsurance) / 100;
  const coinsurancePayment = remainderAfterDeductible * coinsuranceRate;

  // Patient cost sharing cannot exceed covered allowed amount
  const copayPayment = Math.max(0, safeCopay);
  const uncappedPatientOwes = Math.min(
    totalAllowed,
    deductiblePayment + coinsurancePayment + copayPayment
  );

  // Cap at out-of-pocket remaining limit
  const oopLimit = Math.max(0, safeOop);
  const calculatedPatientOwes = roundToCents(
    Math.min(uncappedPatientOwes, oopLimit)
  );

  const flags: AuditFlag[] = [];

  // Critical flag: clinic demands more than legal patient obligation
  if (amountClinicDemands > calculatedPatientOwes) {
    const overcharge = roundToCents(amountClinicDemands - calculatedPatientOwes);
    flags.push({
      severity: "CRITICAL",
      title: "Potential Overcharge",
      description: `The clinic demanded $${amountClinicDemands.toFixed(2)}, which exceeds the calculated patient responsibility of $${calculatedPatientOwes.toFixed(2)} by $${overcharge.toFixed(2)}.`,
      potentialSavings: overcharge,
    });
  }

  // Critical flag: provider bills the contractual write-off exceeding total allowed
  const balanceDifference = roundToCents(totalBilled - totalAllowed);
  if (balanceDifference > 0 && amountClinicDemands > totalAllowed) {
    const balanceDemanded = Math.min(
      roundToCents(amountClinicDemands - totalAllowed),
      balanceDifference
    );
    flags.push({
      severity: "CRITICAL",
      title: "Illegal Balance Billing",
      description: `The provider billed $${totalBilled.toFixed(2)} against an insurance allowed amount of $${totalAllowed.toFixed(2)} and is demanding $${balanceDemanded.toFixed(2)} of the contractual write-off (included in the total overcharge above).`,
      potentialSavings: balanceDemanded,
    });
  }

  return {
    totalBilled,
    totalAllowed,
    calculatedPatientOwes,
    amountClinicDemands: roundToCents(amountClinicDemands),
    flags,
  };
}
