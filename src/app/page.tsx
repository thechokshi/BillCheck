"use client";

import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  ShieldCheck,
  AlertTriangle,
  FileCheck,
  User,
  Activity,
  PhoneCall,
  Sparkles,
  HelpCircle,
  Loader2,
  FileSpreadsheet,
  Zap,
  Plus,
  Trash2,
  Layers,
  Mail,
  Copy,
  Check,
} from "lucide-react";
import type { LineItem, InsuranceProfile, DeterministicAuditResult } from "@/lib/audit-engine";
import type { AuditOutput } from "@/lib/schema";

interface AuditResponse {
  mathAudit: DeterministicAuditResult;
  aiAnalysis: AuditOutput;
}

interface FormLineItem {
  id: string;
  description: string;
  billedAmount: number | string;
  allowedAmount: number | string;
}

export default function Home() {
  // Multi-item form state
  const [items, setItems] = useState<FormLineItem[]>([
    {
      id: "item-1",
      description: "CPT 99285 - Emergency Dept Visit (Level 5)",
      billedAmount: 1800,
      allowedAmount: 450,
    },
    {
      id: "item-2",
      description: "CPT 71046 - Chest X-Ray (2 Views)",
      billedAmount: 700,
      allowedAmount: 150,
    },
  ]);
  const [amountClinicDemands, setAmountClinicDemands] = useState<number | string>(2500);

  // Insurance profile state
  const [deductibleRemaining, setDeductibleRemaining] = useState<number | string>(0);
  const [coinsurancePercent, setCoinsurancePercent] = useState<number | string>(20);
  const [outOfPocketRemaining, setOutOfPocketRemaining] = useState<number | string>(1000);
  const [copay, setCopay] = useState<number | string>(0);

  // Submission & Results state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<AuditResponse | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const copyEmailToClipboard = () => {
    if (!auditResult?.aiAnalysis.disputeEmail) return;
    const fullText = `Subject: ${auditResult.aiAnalysis.disputeEmail.subject}\n\n${auditResult.aiAnalysis.disputeEmail.body}`;
    navigator.clipboard
      .writeText(fullText)
      .then(() => {
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 2000);
      })
      .catch(() => {});
  };

  // Item helpers
  const addLineItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        description: "",
        billedAmount: "",
        allowedAmount: "",
      },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const updateLineItem = (id: string, field: keyof FormLineItem, value: string | number) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
  };

  // Demo Presets
  const loadSurpriseEmergencyBill = () => {
    setItems([
      {
        id: "item-1",
        description: "CPT 99285 - Emergency Dept Visit (Level 5)",
        billedAmount: 1800,
        allowedAmount: 450,
      },
      {
        id: "item-2",
        description: "CPT 71046 - Chest X-Ray (2 Views)",
        billedAmount: 700,
        allowedAmount: 150,
      },
    ]);
    setAmountClinicDemands(2500);
    setDeductibleRemaining(0);
    setCoinsurancePercent(20);
    setOutOfPocketRemaining(1000);
    setCopay(0);
    setError(null);
  };

  const loadDeductibleError = () => {
    setItems([
      {
        id: "item-1",
        description: "CPT 99214 - Specialist Consultation",
        billedAmount: 250,
        allowedAmount: 250,
      },
      {
        id: "item-2",
        description: "CPT 80053 - Comprehensive Metabolic Panel",
        billedAmount: 150,
        allowedAmount: 150,
      },
    ]);
    setAmountClinicDemands(400);
    setDeductibleRemaining(0);
    setCoinsurancePercent(0);
    setOutOfPocketRemaining(0); // OOP Max already met!
    setCopay(0);
    setError(null);
  };

  const loadUnbundledCodesDemo = () => {
    setItems([
      {
        id: "item-1",
        description: "CPT 80053 - Comprehensive Metabolic Panel",
        billedAmount: 180,
        allowedAmount: 45,
      },
      {
        id: "item-2",
        description: "CPT 36415 - Routine Venipuncture (Blood Draw)",
        billedAmount: 65,
        allowedAmount: 15,
      },
      {
        id: "item-3",
        description: "CPT 85025 - Complete Blood Count (CBC Automated)",
        billedAmount: 110,
        allowedAmount: 30,
      },
    ]);
    setAmountClinicDemands(355);
    setDeductibleRemaining(0);
    setCoinsurancePercent(20);
    setOutOfPocketRemaining(500);
    setCopay(0);
    setError(null);
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const submissionItems: LineItem[] = items.map((it, idx) => ({
      id: it.id || `item-${idx + 1}`,
      description: it.description || `Procedure ${idx + 1}`,
      billedAmount: Number(it.billedAmount) || 0,
      allowedAmount:
        it.allowedAmount !== "" && it.allowedAmount !== undefined
          ? Number(it.allowedAmount)
          : undefined,
    }));

    const insurance: InsuranceProfile = {
      deductibleRemaining: Number(deductibleRemaining) || 0,
      coinsurancePercent: Number(coinsurancePercent) || 0,
      outOfPocketRemaining:
        outOfPocketRemaining !== "" && outOfPocketRemaining !== undefined
          ? Number(outOfPocketRemaining)
          : undefined,
      copay: Number(copay) || 0,
    };

    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: submissionItems,
          insurance,
          amountClinicDemands: Number(amountClinicDemands) || 0,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${res.status}`);
      }

      const data: AuditResponse = await res.json();
      setAuditResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run medical bill audit.");
    } finally {
      setLoading(false);
    }
  };

  const criticalFlags =
    auditResult?.mathAudit.flags.filter((f) => f.severity === "CRITICAL") || [];
  const totalCriticalSavings = Math.max(
    0,
    (auditResult?.mathAudit.amountClinicDemands ?? (Number(amountClinicDemands) || 0)) -
      (auditResult?.mathAudit.calculatedPatientOwes ?? 0)
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/70 dark:bg-zinc-950 font-sans text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <ShieldCheck className="size-5" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-lg tracking-tight">BillCheck</span>
              <Badge
                variant="outline"
                className="hidden sm:inline-flex text-teal-700 border-teal-200 bg-teal-50 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800"
              >
                AI Patient Advocate
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="hidden md:inline-flex gap-1.5 py-1">
              <Activity className="size-3.5 text-teal-600" />
              <span>Deterministic Audit + LLM Advocate</span>
            </Badge>
            <div className="flex items-center gap-2 border border-border rounded-full pl-3 pr-1.5 py-1 bg-card">
              <span className="text-xs font-medium text-muted-foreground">Guest Mode</span>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full size-7 p-0 bg-muted hover:bg-muted/80 text-foreground"
                aria-label="User account"
              >
                <User className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Medical Bill Audit Dashboard
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-3xl">
            Input medical line items and insurance terms to calculate legal patient liability,
            detect illegal balance billing, and receive an AI dispute phone script.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Form */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="shadow-xs border-border/80">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                      <FileSpreadsheet className="size-4" />
                    </div>
                    <div>
                      <CardTitle>Medical Bill Audit Form</CardTitle>
                      <CardDescription>
                        Test deterministic math against in-network rules.
                      </CardDescription>
                    </div>
                  </div>
                </div>

                {/* Demo Data Buttons */}
                <div className="pt-3 space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Zap className="size-3 text-amber-500" />
                    One-Click Demo Presets
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={loadSurpriseEmergencyBill}
                      className="text-xs h-auto py-2 px-2.5 text-left flex flex-col items-start gap-0.5 border-teal-200 hover:bg-teal-50 dark:border-teal-900 dark:hover:bg-teal-950/40"
                    >
                      <span className="font-semibold text-teal-700 dark:text-teal-300">
                        Surprise Bill
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        $2.5k billed, $600 allowed
                      </span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={loadDeductibleError}
                      className="text-xs h-auto py-2 px-2.5 text-left flex flex-col items-start gap-0.5 border-amber-200 hover:bg-amber-50 dark:border-amber-900 dark:hover:bg-amber-950/40"
                    >
                      <span className="font-semibold text-amber-700 dark:text-amber-300">
                        OOP Cap Error
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        $400 billed, OOP met
                      </span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={loadUnbundledCodesDemo}
                      className="text-xs h-auto py-2 px-2.5 text-left flex flex-col items-start gap-0.5 border-purple-200 hover:bg-purple-50 dark:border-purple-900 dark:hover:bg-purple-950/40"
                    >
                      <span className="font-semibold text-purple-700 dark:text-purple-300">
                        Unbundled Codes
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        3 codes, NCCI bundling
                      </span>
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4 pt-1">
                  {/* Demanded Charge */}
                  <div className="space-y-2 rounded-lg bg-teal-50/50 dark:bg-teal-950/20 p-3 border border-teal-100 dark:border-teal-900/50">
                    <Label htmlFor="amountClinicDemands" className="font-semibold text-xs">
                      Amount Clinic Demands ($)
                    </Label>
                    <Input
                      id="amountClinicDemands"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={amountClinicDemands}
                      onChange={(e) => setAmountClinicDemands(e.target.value)}
                      placeholder="e.g. 2500"
                      className="bg-background font-medium"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      The balance due stated on the paper bill or clinic statement.
                    </p>
                  </div>

                  <Separator />

                  {/* Dynamic Line Items / Procedure Codes */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                        Procedure Codes & Line Items ({items.length})
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={addLineItem}
                        className="text-xs h-7 text-teal-700 hover:text-teal-800 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-950/40 gap-1 px-2"
                      >
                        <Plus className="size-3.5" />
                        Add Code
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {items.map((item, index) => (
                        <div
                          key={item.id}
                          className="rounded-lg border border-border p-3 bg-muted/20 space-y-2.5 relative"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold text-muted-foreground">
                              Code #{index + 1}
                            </span>
                            {items.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeLineItem(item.id)}
                                className="size-6 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                                aria-label="Remove procedure code"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor={`desc-${item.id}`} className="text-xs">
                              CPT Code / Description
                            </Label>
                            <Input
                              id={`desc-${item.id}`}
                              required
                              value={item.description}
                              onChange={(e) =>
                                updateLineItem(item.id, "description", e.target.value)
                              }
                              placeholder="e.g. CPT 99285 - Emergency Dept Level 5"
                              className="text-xs bg-background"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1.5">
                              <Label htmlFor={`billed-${item.id}`} className="text-xs">
                                Billed ($)
                              </Label>
                              <Input
                                id={`billed-${item.id}`}
                                type="number"
                                step="0.01"
                                min="0"
                                required
                                value={item.billedAmount}
                                onChange={(e) =>
                                  updateLineItem(item.id, "billedAmount", e.target.value)
                                }
                                placeholder="1800"
                                className="text-xs bg-background"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor={`allowed-${item.id}`} className="text-xs">
                                In-Network Allowed ($)
                              </Label>
                              <Input
                                id={`allowed-${item.id}`}
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.allowedAmount}
                                onChange={(e) =>
                                  updateLineItem(item.id, "allowedAmount", e.target.value)
                                }
                                placeholder="450"
                                className="text-xs bg-background"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Aggregate total preview across all procedure codes */}
                    <div className="rounded-md bg-muted/40 p-2 text-[11px] flex items-center justify-between text-muted-foreground border border-border/50">
                      <span>
                        Total Billed:{" "}
                        <strong className="text-foreground">
                          $
                          {items
                            .reduce((sum, it) => sum + (Number(it.billedAmount) || 0), 0)
                            .toFixed(2)}
                        </strong>
                      </span>
                      <span>
                        Total Allowed:{" "}
                        <strong className="text-foreground">
                          $
                          {items
                            .reduce(
                              (sum, it) =>
                                sum +
                                (it.allowedAmount !== "" && it.allowedAmount !== undefined
                                  ? Number(it.allowedAmount) || 0
                                  : Number(it.billedAmount) || 0),
                              0
                            )
                            .toFixed(2)}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <Separator />

                  {/* Insurance Profile */}
                  <div className="space-y-3">
                    <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      Insurance Profile
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="deductibleRemaining">Deductible Left ($)</Label>
                        <Input
                          id="deductibleRemaining"
                          type="number"
                          step="0.01"
                          min="0"
                          value={deductibleRemaining}
                          onChange={(e) => setDeductibleRemaining(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="coinsurancePercent">Coinsurance (%)</Label>
                        <Input
                          id="coinsurancePercent"
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={coinsurancePercent}
                          onChange={(e) => setCoinsurancePercent(e.target.value)}
                          placeholder="20"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="outOfPocketRemaining">OOP Limit Left ($)</Label>
                        <Input
                          id="outOfPocketRemaining"
                          type="number"
                          step="0.01"
                          min="0"
                          value={outOfPocketRemaining}
                          onChange={(e) => setOutOfPocketRemaining(e.target.value)}
                          placeholder="1000"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="copay">Copay ($)</Label>
                        <Input
                          id="copay"
                          type="number"
                          step="0.01"
                          min="0"
                          value={copay}
                          onChange={(e) => setCopay(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="pt-2">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Auditing & Generating Advocate Script...
                      </>
                    ) : (
                      <>
                        <FileCheck className="size-4" />
                        Run Medical Bill Audit
                      </>
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>

          {/* Right Column: Audit Results */}
          <div className="lg:col-span-7 space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertTitle>Audit Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Loading Skeleton */}
            {loading && (
              <Card className="shadow-xs border-border/80 animate-pulse">
                <CardHeader className="space-y-2">
                  <div className="h-6 w-48 bg-muted rounded-md" />
                  <div className="h-4 w-72 bg-muted/60 rounded-md" />
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Alert Skeleton */}
                  <div className="h-20 bg-muted/70 rounded-xl" />
                  {/* Metric Cards Skeleton */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="h-20 bg-muted/60 rounded-lg" />
                    <div className="h-20 bg-muted/60 rounded-lg" />
                    <div className="h-20 bg-muted/60 rounded-lg" />
                  </div>
                  {/* Section Skeleton */}
                  <div className="space-y-3">
                    <div className="h-4 w-36 bg-muted rounded-md" />
                    <div className="h-24 bg-muted/50 rounded-lg" />
                  </div>
                  {/* Script Skeleton */}
                  <div className="h-48 bg-muted/40 rounded-xl" />
                </CardContent>
              </Card>
            )}

            {/* Empty State before submission */}
            {!loading && !auditResult && (
              <Card className="shadow-xs border-dashed border-2 border-border/80 text-center py-12 px-6">
                <CardContent className="space-y-4">
                  <div className="size-12 rounded-full bg-teal-50 dark:bg-teal-950/50 text-teal-600 flex items-center justify-center mx-auto">
                    <Sparkles className="size-6" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-lg">Audit Engine Ready</CardTitle>
                    <CardDescription className="max-w-md mx-auto">
                      Click either demo button on the left or customize your line items, then
                      press &quot;Run Medical Bill Audit&quot; to inspect your bill.
                    </CardDescription>
                  </div>
                  <div className="pt-2 flex flex-wrap justify-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadSurpriseEmergencyBill}
                      className="gap-1.5"
                    >
                      <Zap className="size-3.5 text-teal-600" />
                      Try Surprise Bill Demo
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadUnbundledCodesDemo}
                      className="gap-1.5"
                    >
                      <Layers className="size-3.5 text-purple-600" />
                      Try Unbundled Codes Demo
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Completed Audit Results */}
            {!loading && auditResult && (
              <div className="space-y-6">
                {/* High-Visibility Critical Alert Banner */}
                {criticalFlags.length > 0 && (
                  <div className="rounded-xl border-2 border-red-500/80 bg-red-50/90 dark:bg-red-950/50 p-4 sm:p-5 shadow-xs space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-red-600 text-white shrink-0 mt-0.5">
                        <AlertTriangle className="size-5" />
                      </div>
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap justify-between">
                          <span className="font-bold text-red-700 dark:text-red-400 text-base tracking-tight uppercase">
                            Critical Billing Overcharge Detected
                          </span>
                          <Badge className="bg-red-600 text-white hover:bg-red-700">
                            Immediate Dispute Recommended
                          </Badge>
                        </div>
                        <p className="text-xs sm:text-sm text-red-900/90 dark:text-red-200">
                          The provider is attempting to collect funds beyond your calculated in-network
                          cost-sharing limit or is balance billing contractual discounts.
                        </p>
                        <div className="pt-2 flex items-baseline gap-2">
                          <span className="text-xs font-semibold text-red-700 dark:text-red-300">
                            Identified Potential Savings:
                          </span>
                          <span className="text-2xl sm:text-3xl font-black text-red-600 dark:text-red-400 tracking-tight">
                            ${totalCriticalSavings.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Math Audit Breakdown Card */}
                <Card className="shadow-xs border-border/80">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Deterministic Math Breakdown</CardTitle>
                        <CardDescription>
                          Contractual allowable charges and legal patient liability.
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        Adjudicated
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Metrics Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-lg border border-border p-3.5 bg-card">
                        <span className="text-xs text-muted-foreground">Total Billed</span>
                        <p className="text-xl font-bold mt-1 tracking-tight">
                          ${auditResult.mathAudit.totalBilled.toFixed(2)}
                        </p>
                        <span className="text-[11px] text-muted-foreground">Original Charge</span>
                      </div>
                      <div className="rounded-lg border border-border p-3.5 bg-card">
                        <span className="text-xs text-muted-foreground">Total In-Network Allowed</span>
                        <p className="text-xl font-bold mt-1 tracking-tight text-foreground">
                          ${auditResult.mathAudit.totalAllowed.toFixed(2)}
                        </p>
                        <span className="text-[11px] text-muted-foreground">Contracted Fee</span>
                      </div>
                      <div className="rounded-lg border border-teal-200 dark:border-teal-900 p-3.5 bg-teal-50/50 dark:bg-teal-950/30">
                        <span className="text-xs text-teal-700 dark:text-teal-300 font-medium">
                          Legal Patient Responsibility
                        </span>
                        <p className="text-xl font-bold mt-1 tracking-tight text-teal-700 dark:text-teal-300">
                          ${auditResult.mathAudit.calculatedPatientOwes.toFixed(2)}
                        </p>
                        <span className="text-[11px] text-teal-600/80 dark:text-teal-400">
                          Max Deductible + Coinsurance + Copay
                        </span>
                      </div>
                    </div>

                    {/* Flags List */}
                    {auditResult.mathAudit.flags.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Mathematical Audit Flags ({auditResult.mathAudit.flags.length})
                        </span>
                        <div className="space-y-2">
                          {auditResult.mathAudit.flags.map((flag, idx) => (
                            <div
                              key={idx}
                              className={`rounded-lg p-3 border text-xs space-y-1 ${
                                flag.severity === "CRITICAL"
                                  ? "bg-red-50/60 border-red-200 text-red-900 dark:bg-red-950/30 dark:border-red-900/60 dark:text-red-200"
                                  : "bg-amber-50/60 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-900/60 dark:text-amber-200"
                              }`}
                            >
                              <div className="flex items-center justify-between font-semibold">
                                <span className="flex items-center gap-1.5">
                                  <AlertTriangle className="size-3.5 shrink-0" />
                                  {flag.title}
                                </span>
                                <Badge
                                  variant={flag.severity === "CRITICAL" ? "destructive" : "secondary"}
                                  className="text-[10px] h-4.5"
                                >
                                  Discrepancy: ${flag.potentialSavings.toFixed(2)}
                                </Badge>
                              </div>
                              <p className="text-[11px] opacity-90">{flag.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* AI Patient Advocate Translation Card */}
                <Card className="shadow-xs border-border/80">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-md bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                        <Sparkles className="size-4" />
                      </div>
                      <div>
                        <CardTitle>AI Patient Advocate Explanation</CardTitle>
                        <CardDescription>
                          Plain English translation of procedure codes and clinical billing issues.
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Summary */}
                    <div className="p-3.5 rounded-lg bg-muted/40 border border-border text-sm leading-relaxed">
                      <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-1">
                        Executive Summary
                      </p>
                      <p className="text-foreground">{auditResult.aiAnalysis.plainEnglishSummary}</p>
                    </div>

                    {/* Decoded Line Items */}
                    <div className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Decoded Line Items
                      </span>
                      <div className="space-y-2">
                        {auditResult.aiAnalysis.decodedLineItems.map((item, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-lg border border-border bg-card space-y-1 text-xs"
                          >
                            <div className="flex items-center justify-between font-semibold text-sm">
                              <span>{item.originalDescription}</span>
                            </div>
                            <p className="text-muted-foreground">{item.plainEnglishMeaning}</p>
                            <div className="pt-1 text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-1">
                              <HelpCircle className="size-3.5 shrink-0 mt-0.5" />
                              <span>
                                <strong>Known billing error:</strong> {item.commonBillingErrors}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Code Bundling & Unbundling Analysis Card */}
                {auditResult.aiAnalysis.bundlingOpportunities &&
                  auditResult.aiAnalysis.bundlingOpportunities.length > 0 && (
                    <Card className="shadow-xs border-amber-200 dark:border-amber-900 bg-amber-50/20 dark:bg-amber-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                              <Layers className="size-4" />
                            </div>
                            <div>
                              <CardTitle className="text-base">Code Bundling & Unbundling Analysis</CardTitle>
                              <CardDescription>
                                Procedures that should legally be combined into a single code under CMS NCCI guidelines.
                              </CardDescription>
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className="text-amber-800 border-amber-300 dark:text-amber-300 dark:border-amber-800"
                          >
                            NCCI Review
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {auditResult.aiAnalysis.bundlingOpportunities.map((opportunity, idx) => (
                          <div
                            key={idx}
                            className="p-3.5 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-card space-y-2 text-xs"
                          >
                            <div className="flex items-center justify-between flex-wrap gap-1">
                              <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
                                <span>Recommended Combined Code:</span>
                                <span className="text-teal-700 dark:text-teal-400 font-bold">
                                  {opportunity.recommendedBundledCode}
                                </span>
                              </div>
                              {opportunity.estimatedSavings > 0 && (
                                <Badge className="bg-emerald-600 text-white text-[10px]">
                                  Est. Bundling Savings: ${opportunity.estimatedSavings.toFixed(2)}
                                </Badge>
                              )}
                            </div>
                            <div className="space-y-1">
                              <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                                Codes that should be combined:
                              </span>
                              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground pl-1">
                                {opportunity.unbundledCodes.map((c, i) => (
                                  <li key={i}>{c}</li>
                                ))}
                              </ul>
                            </div>
                            <p className="text-muted-foreground pt-1 border-t border-border/50 leading-relaxed">
                              <strong>Why this matters:</strong> {opportunity.explanation}
                            </p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                {/* Phone Call Cheat Sheet Card */}
                <Card className="shadow-md border-teal-200 dark:border-teal-900 bg-gradient-to-b from-card to-teal-50/20 dark:to-teal-950/10">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-teal-600 text-white">
                          <PhoneCall className="size-4" />
                        </div>
                        <div>
                          <CardTitle className="text-base sm:text-lg">
                            Phone Call Cheat Sheet
                          </CardTitle>
                          <CardDescription>
                            Read this script directly to the clinic or hospital billing desk.
                          </CardDescription>
                        </div>
                      </div>
                      <Badge className="bg-teal-600 hover:bg-teal-700 text-white">
                        Dispute Script
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Opening Statement */}
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300">
                        1. Opening Statement
                      </span>
                      <div className="p-3.5 rounded-lg border border-teal-200 dark:border-teal-900 bg-teal-50/70 dark:bg-teal-950/40 text-xs sm:text-sm italic font-medium leading-relaxed">
                        &quot;{auditResult.aiAnalysis.disputeScript.openingStatement}&quot;
                      </div>
                    </div>

                    {/* Questions to Ask */}
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300">
                        2. Targeted Questions to Ask
                      </span>
                      <ul className="space-y-2">
                        {auditResult.aiAnalysis.disputeScript.questionsToAsk.map((q, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-xs sm:text-sm p-2.5 rounded-md bg-muted/40 border border-border"
                          >
                            <span className="size-5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <span className="flex-1">{q}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Escalation Phrase */}
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-red-700 dark:text-red-400">
                        3. Statutory Escalation Phrase (If they resist)
                      </span>
                      <div className="p-3.5 rounded-lg border-2 border-red-300 dark:border-red-900 bg-red-50/80 dark:bg-red-950/30 text-xs sm:text-sm font-semibold text-red-900 dark:text-red-200 leading-relaxed">
                        &quot;{auditResult.aiAnalysis.disputeScript.escalationPhrase}&quot;
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="pt-2 border-t border-border/70 text-xs text-muted-foreground flex justify-between items-center">
                    <span>Ask for the representative&apos;s name and call reference ID.</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.print()}
                      className="text-xs h-7 gap-1"
                    >
                      Print Script
                    </Button>
                  </CardFooter>
                </Card>

                {/* Written Dispute Email Template Card */}
                {auditResult.aiAnalysis.disputeEmail && (
                  <Card className="shadow-md border-teal-200 dark:border-teal-900 bg-gradient-to-b from-card to-teal-50/20 dark:to-teal-950/10">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-lg bg-teal-600 text-white">
                            <Mail className="size-4" />
                          </div>
                          <div>
                            <CardTitle className="text-base sm:text-lg">
                              Written Dispute Email Template
                            </CardTitle>
                            <CardDescription>
                              Send this formal dispute letter to the clinic or hospital billing department.
                            </CardDescription>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={copyEmailToClipboard}
                          className="h-8 gap-1.5 text-xs text-teal-700 border-teal-200 hover:bg-teal-50 dark:text-teal-300 dark:border-teal-800 dark:hover:bg-teal-950/40"
                        >
                          {copiedEmail ? (
                            <>
                              <Check className="size-3.5 text-emerald-600" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="size-3.5" />
                              <span>Copy Email</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Subject */}
                      <div className="space-y-1.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300">
                          Subject Line
                        </span>
                        <div className="p-2.5 rounded-lg border border-border bg-muted/40 text-xs sm:text-sm font-medium font-mono text-foreground select-all">
                          {auditResult.aiAnalysis.disputeEmail.subject}
                        </div>
                      </div>

                      {/* Body */}
                      <div className="space-y-1.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300">
                          Email Message
                        </span>
                        <pre className="p-3.5 rounded-lg border border-border bg-muted/30 text-xs sm:text-sm font-sans leading-relaxed text-foreground whitespace-pre-wrap select-all">
                          {auditResult.aiAnalysis.disputeEmail.body}
                        </pre>
                      </div>
                    </CardContent>

                    <CardFooter className="pt-2 border-t border-border/70 text-xs text-muted-foreground flex justify-between items-center">
                      <span>Include a PDF scan or photo of your insurance EOB as an attachment.</span>
                      <a
                        href={`mailto:?subject=${encodeURIComponent(
                          auditResult.aiAnalysis.disputeEmail.subject
                        )}&body=${encodeURIComponent(auditResult.aiAnalysis.disputeEmail.body)}`}
                        className="inline-flex items-center gap-1 font-medium text-teal-700 hover:underline dark:text-teal-400"
                      >
                        Open in Email App &rarr;
                      </a>
                    </CardFooter>
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
