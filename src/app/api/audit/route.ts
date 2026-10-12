import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { runDeterministicAudit } from "@/lib/audit-engine";
import {
  AuditOutputSchema,
  AuditRequestSchema,
  getFallbackAdvocateAnalysis,
} from "@/lib/schema";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json().catch(() => null);
    const parseResult = AuditRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: `Invalid request: ${parseResult.error.issues
            .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
            .join("; ")}`,
        },
        { status: 400 }
      );
    }

    const { items, insurance, amountClinicDemands } = parseResult.data;

    // 1. Deterministic mathematical audit
    const mathAudit = runDeterministicAudit(
      items,
      {
        ...insurance,
        outOfPocketRemaining: insurance.outOfPocketRemaining ?? Infinity,
      },
      amountClinicDemands
    );

    // 2. AI patient advocate analysis and dispute script grounded in math audit
    const prompt = `You are an expert patient financial advocate reviewing a medical bill.
Translate the medical codes and procedures into clear, plain English, explain common billing pitfalls for each code, detect any improper unbundling (where multiple separate codes should legally be combined/bundled under CMS National Correct Coding Initiative [NCCI] edits or global billing rules), and draft both a phone dispute script and a formal written dispute email template based strictly on the mathematical audit flags provided. Do not invent financial discrepancies not present in the mathematical audit.

Line Items:
${JSON.stringify(items, null, 2)}

Deterministic Mathematical Audit Results:
- Total Billed: $${mathAudit.totalBilled.toFixed(2)}
- Total Allowed: $${mathAudit.totalAllowed.toFixed(2)}
- Legal Patient Responsibility Calculated: $${mathAudit.calculatedPatientOwes.toFixed(2)}
- Amount Demanded by Clinic: $${amountClinicDemands.toFixed(2)}
- Audit Flags:
${JSON.stringify(mathAudit.flags, null, 2)}
`;

    let aiAnalysis;
    if (process.env.OPENAI_API_KEY) {
      try {
        const { object } = await generateObject({
          model: openai("gpt-4o-mini"),
          schema: AuditOutputSchema,
          prompt,
          abortSignal: AbortSignal.timeout(15000),
        });
        aiAnalysis = object;
      } catch (aiError) {
        console.error("OpenAI inference failed; falling back to offline advocate generator:", aiError);
        aiAnalysis = getFallbackAdvocateAnalysis(items, mathAudit, amountClinicDemands);
      }
    } else {
      aiAnalysis = getFallbackAdvocateAnalysis(items, mathAudit, amountClinicDemands);
    }

    return NextResponse.json({
      mathAudit,
      aiAnalysis,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
