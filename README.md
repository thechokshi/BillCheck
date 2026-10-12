# BillCheck (Medical Bill & Insurance Responsibility Audit)

- **Live Deployed Application:** [Insert Vercel URL]
- **Source Code Repository:** [https://github.com/thechokshi/BillCheck](https://github.com/thechokshi/BillCheck)

---

## 1. Context & Motivation

Medical billing in the United States is deliberately opaque, flooded with cryptic CPT/HCPCS codes, and frequently violates statutory protections such as the **No Surprises Act**. 

Patients routinely receive balance bills demanding thousands of dollars that providers are contractually forbidden from collecting. Because verifying these charges requires calculating multi-tiered insurance cost-sharing mechanics (deductibles, coinsurance percentages, copays, and out-of-pocket maximum caps), patients lack the tools to dispute unlawful bills effectively and end up overpaying out of fear or confusion.

BillCheck was built out of a direct personal passion for consumer financial empowerment and healthcare transparency. It provides patients with an automated mathematical auditor and an AI-powered financial advocate to eliminate the asymmetric advantage healthcare billing departments have over everyday people.

### Core Experience & Workflow
1. **Interactive Bill Modeling:** Users can build and configure itemized CPT charges with contracted in-network allowable rates and insurance policies (or immediately load real-world clinical edge cases like surprise ER bills, unbundled lab panels, or OOP maximum cap violations).
2. **Deterministic Arithmetic Core:** Computes statutory patient responsibility down to the exact cent, completely isolated from probabilistic LLM hallucinations.
3. **Structured Advocacy Generation:** Uses the Vercel AI SDK to translate clinical jargon into plain English, detect unbundling violations, and generate ready-to-use phone dispute scripts and written formal dispute letters grounded strictly in mathematical audit flags.

---

## 2. Architecture & Separation of Concerns

A core principle of reliable AI engineering is knowing what **not** to delegate to a probabilistic model. Arithmetic and contract law calculations must be deterministic. Language models excel at summarization, translation, and empathetic advocacy.

```
┌─────────────────────────────────┐
│     User Bill & Policy Input    │
└────────────────┬────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│  Deterministic Math Core (src/lib/audit-engine.ts)     │
│  - Contractual adjustment verification                 │
│  - Deductible, Coinsurance & Copay calculations        │
│  - Out-of-pocket maximum capping                       │
│  - Flag detection: Overcharge & Illegal Balance Billing│
│  * The LLM is NEVER trusted with arithmetic            │
└────────────────┬───────────────────────────────────────┘
                 │
                 ▼ (Math Audit + Contract Flags)
┌────────────────────────────────────────────────────────┐
│  Structured AI Inference (src/app/api/audit/route.ts)  │
│  - Vercel AI SDK (`generateObject` via @ai-sdk/openai) │
│  - Strict Zod validation (src/lib/schema.ts)           │
│  - Jargon translation & billing error identification   │
│  - Phone call dispute script grounded in math flags    │
└────────────────┬───────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│ Interactive Advocacy Dashboard  │
│ (Next.js App Router + shadcn/ui)│
└─────────────────────────────────┘
```

### Division of Labor
1. **Deterministic Math Core (`src/lib/audit-engine.ts`):** 
   - A pure TypeScript engine that computes legal patient responsibility.
   - Calculates deductible burn, coinsurance splits, and out-of-pocket caps.
   - Flags contractual write-off balance billing and arbitrary overcharges mathematically.
   - Verified via standalone assertion test suite (`src/lib/audit-engine.test.ts`).
2. **Structured AI Inference (`src/lib/schema.ts` & `src/app/api/audit/route.ts`):**
   - Uses the Vercel AI SDK (`generateObject`) paired with Zod schemas to guarantee structured JSON output.
   - Translates raw CPT procedure descriptions into plain English.
   - Synthesizes a dispute script—complete with opening statement, diagnostic questions, and statutory escalation phrases—grounded strictly in the mathematical flags.
3. **Full-Stack Foundation:**
   - **Framework:** Next.js App Router (Turbopack, TypeScript, Server & Client Components).
   - **Styling & Primitives:** Tailwind CSS with shadcn/ui components (`card`, `button`, `input`, `label`, `badge`, `separator`, `alert`).
   - **Zero-Friction Access:** Runs immediately in guest mode without signup barriers or external auth dependencies.

---

## 3. What Works (Current Functionality)

- **Deterministic Financial Engine:** Evaluates patient responsibility down to the cent, applying deductible offsets, coinsurance percentages, and OOP limits.
- **Dynamic Multi-Code Entry:** Expandable CPT/HCPCS line item editor with live aggregate total calculations, customizable charges, and row deletion.
- **One-Click Demo Presets:**
  - *Surprise Emergency Room Bill:* Pre-fills a multi-code $2,500 bill with a $600 in-network allowable amount, immediately flagging illegal balance billing ($1,900) and excessive demands.
  - *Deductible Met Overcharge:* Pre-fills a $400 clinic demand where the patient has already met their OOP maximum, flagging a $400 overcharge where legal responsibility is $0.
  - *Unbundled Codes Demo:* Pre-fills a 3-code clinical statement (Metabolic Panel + Venipuncture + CBC) to trigger NCCI unbundling detection, code combination advice, and bundling dispute questions.
- **Critical Discrepancy Alerts:** High-visibility banner highlighting total identified potential savings when critical compliance violations occur.
- **Phone Call Dispute Cheat Sheet:** Dedicated card providing patients with a turnkey script to read verbatim to billing representatives, including a federal statutory escalation statement.
- **Responsive Layout:** Two-column desktop / single-column mobile view with real-time loading skeletons.
- **Zero-Dependency Fallback:** Built-in deterministic advocate output if an `OPENAI_API_KEY` is not present in local development.

---

## 4. Trade-offs & Incomplete Scope (2-Hour Timebox)

To deliver a working, bug-free core within the take-home constraint, the following scope items were intentionally deferred:

1. **Document OCR / Vision Ingestion:**
   - *Current State:* Line items are input via the multi-code form or loaded via one-click presets.
   - *Production Path:* Implement a multimodal vision ingestion pipeline (GPT-4o vision) to extract line items, CPT codes, and insurance EOB details directly from uploaded scans.
2. **Asynchronous Job Processing:**
   - *Current State:* The audit runs synchronously in the Next.js API route handler.
   - *Production Path:* Offload heavy multi-page bill audits to an async task runner (e.g., Inngest or BullMQ) with streaming updates or webhook notifications.
3. **Enterprise Observability & Eval Harness:**
   - *Current State:* Handled via standard Next.js error logging and TypeScript compile-time safety.
   - *Production Path:* Integrate OpenTelemetry, token cost tracing, and automated regression evaluations (e.g., LangSmith, Braintrust) to measure LLM advocacy consistency against benchmark dispute cases.
4. **Persistent User Accounts & Auth:**
   - *Current State:* Runs friction-free in instantaneous Guest Mode so evaluators can inspect and test all features without requiring third-party credentials or OAuth redirects.
   - *Production Path:* Connect Supabase Auth or Clerk with encrypted session cookies and persistent saved audit histories.

---

## 5. Local Setup Instructions

### Prerequisites
- Node.js 20+ (Node 24 supported)
- npm, pnpm, or yarn

### 1. Clone & Install
```bash
git clone https://github.com/thechokshi/BillCheck.git
cd BillCheck
npm install
```

### 2. Configure Environment Variables
Copy the example environment template:
```bash
cp .env.example .env.local
```

Populate `.env.local` with your credentials:
```env
# OpenAI API Key (for Vercel AI SDK generateObject)
OPENAI_API_KEY=sk-...
```

> **Note:** If `OPENAI_API_KEY` is not provided, the API route seamlessly defaults to the deterministic offline advocate generator so all UI, math, and PDF parsing flows remain fully testable.

### 3. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Run Test & Build Checks
```bash
# Run math audit assertion tests
npm test

# Run linter
npm run lint

# Verify production build
npm run build
```
