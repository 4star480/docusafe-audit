export type AuditRule =
  | "liability"
  | "missing-dates"
  | "gdpr"
  | "obligations";

export const AUDIT_RULE_OPTIONS: { id: AuditRule; label: string }[] = [
  { id: "liability", label: "Identify High-Risk Liability Clauses" },
  { id: "missing-dates", label: "Find Missing Dates/Deadlines" },
  { id: "gdpr", label: "GDPR Compliance Check" },
  { id: "obligations", label: "Summarize Key Obligations" },
];

export type AuditFlagSeverity = "info" | "medium" | "high";

export interface AuditFlag {
  id: string;
  rule: AuditRule;
  title: string;
  message: string;
  severity: AuditFlagSeverity;
  /**
   * Character offsets in the full extracted text.
   */
  start: number;
  end: number;
  excerpt: string;
}

export const SYSTEM_PROMPT =
  "You are a Senior Legal Operations Manager reviewing contracts. " +
  "You are skeptical, detail-oriented, and privacy-first. " +
  "You highlight high-risk liability clauses, missing dates and deadlines, and GDPR compliance gaps. " +
  "You explain findings in clear, practical language for legal, procurement, and compliance teams.";

/**
 * Simple, deterministic liability clause finder for the MVP.
 * This avoids sending data to any external AI service while still surfacing useful risk flags.
 */
export function findLiabilityClauses(text: string): AuditFlag[] {
  const keywords = [
    "liability",
    "indemnify",
    "indemnification",
    "hold harmless",
    "consequential damages",
    "indirect damages",
    "unlimited",
    "cap on liability",
  ];

  const sentences = splitIntoSentences(text);
  const flags: AuditFlag[] = [];

  for (const sentence of sentences) {
    const lower = sentence.value.toLowerCase();
    const hits = keywords.filter((k) => lower.includes(k));
    if (!hits.length) continue;

    const hasUnlimited =
      lower.includes("unlimited") ||
      /without\s+limit/.test(lower) ||
      /no\s+cap/.test(lower);

    const hasCap =
      /cap on liability/.test(lower) ||
      /liability.*(shall not exceed|is limited to)/.test(lower);

    let severity: AuditFlagSeverity = "medium";
    if (hasUnlimited && !hasCap) severity = "high";
    if (hasCap && !hasUnlimited) severity = "info";

    flags.push({
      id: `${sentence.index}`,
      rule: "liability",
      title: hasUnlimited
        ? "Potentially unlimited liability"
        : "Liability / indemnity clause detected",
      message:
        hasUnlimited && !hasCap
          ? "This clause appears to expose your side to broad or uncapped liability. A Senior Legal Ops Manager would typically push for a clear monetary cap and exclusions for indirect or consequential losses."
          : "This clause allocates liability or indemnity obligations. Review the cap, carve-outs, and scope of indemnity to ensure they align with your risk appetite.",
      severity,
      start: sentence.start,
      end: sentence.end,
      excerpt: sentence.value.trim(),
    });
  }

  return flags;
}

function splitIntoSentences(text: string): {
  value: string;
  start: number;
  end: number;
  index: number;
}[] {
  const results: {
    value: string;
    start: number;
    end: number;
    index: number;
  }[] = [];

  let buffer = "";
  let sentenceStart = 0;
  let index = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    buffer += ch;

    if (/[.!?]/.test(ch)) {
      const next = text[i + 1];
      if (!next || /\s/.test(next)) {
        const value = buffer;
        results.push({
          value,
          start: sentenceStart,
          end: i + 1,
          index,
        });
        index += 1;
        buffer = "";
        sentenceStart = i + 1;
      }
    }
  }

  if (buffer.trim().length) {
    results.push({
      value: buffer,
      start: sentenceStart,
      end: text.length,
      index,
    });
  }

  return results;
}


