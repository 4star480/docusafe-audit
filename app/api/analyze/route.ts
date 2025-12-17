import { NextRequest, NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import {
  AuditFlag,
  AuditRule,
  AUDIT_RULE_OPTIONS,
  findLiabilityClauses,
} from "@/lib/analysis";

export const runtime = "nodejs";

interface AnalyzeResponse {
  text: string;
  flags: AuditFlag[];
  rule: AuditRule;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const rule = (formData.get("rule") as string | null) ?? "liability";

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing file in request." },
        { status: 400 },
      );
    }

    const auditRule = normalizeRule(rule);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type || "";
    const fileName = file.name || "document";

    const text = await extractTextFromBuffer(buffer, {
      mimeType,
      fileName,
    });

    if (!text.trim()) {
      return NextResponse.json(
        {
          error:
            "Unable to extract text from this file. Please upload a text-searchable PDF or Word document.",
        },
        { status: 422 },
      );
    }

    // MVP: deterministic rules. This is where an OpenAI or local LLM call would plug in.
    let flags: AuditFlag[] = [];

    switch (auditRule) {
      case "liability":
        flags = findLiabilityClauses(text);
        break;
      case "missing-dates":
      case "gdpr":
      case "obligations":
      default:
        // Placeholder: still return text so the UI works, flags will be empty.
        flags = [];
        break;
    }

    const payload: AnalyzeResponse = {
      text,
      flags,
      rule: auditRule,
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Analyze error", error);
    return NextResponse.json(
      {
        error:
          "Unexpected error while analyzing document. Please try again with another file.",
      },
      { status: 500 },
    );
  }
}

async function extractTextFromBuffer(
  buffer: Buffer,
  opts: { mimeType: string; fileName: string },
): Promise<string> {
  const lowerName = opts.fileName.toLowerCase();

  if (
    opts.mimeType === "application/pdf" ||
    lowerName.endsWith(".pdf")
  ) {
    const result = await pdfParse(buffer);
    return result.text ?? "";
  }

  if (
    opts.mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value ?? "";
  }

  // Fallback: try to interpret as UTF-8 text.
  return buffer.toString("utf8");
}

function normalizeRule(value: string): AuditRule {
  const match = AUDIT_RULE_OPTIONS.find(
    (opt) => opt.id === value || opt.label === value,
  );
  return (match?.id ?? "liability") as AuditRule;
}


