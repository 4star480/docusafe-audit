\"use client\";

import { useCallback, useMemo, useState } from \"react\";
import { AUDIT_RULE_OPTIONS, type AuditFlag, type AuditRule } from \"@/lib/analysis\";
import jsPDF from \"jspdf\";
interface AnalyzeResult {
  text: string;
  flags: AuditFlag[];
  rule: AuditRule;
}

export default function Home() {
  const [selectedRule, setSelectedRule] = useState<AuditRule>(\"liability\");
  const [documentText, setDocumentText] = useState<string>(\"\");
  const [flags, setFlags] = useState<AuditFlag[]>([]);
  const [selectedFlagId, setSelectedFlagId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const selectedFlag = useMemo(
    () => flags.find((f) => f.id === selectedFlagId) ?? null,
    [flags, selectedFlagId],
  );

  const onFileChange = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setError(null);
      setIsAnalyzing(true);
      setSelectedFlagId(null);
      setFlags([]);
      setDocumentText(\"\");
      setFileName(file.name);

      try {
        const formData = new FormData();
        formData.append(\"file\", file);
        formData.append(\"rule\", selectedRule);

        const res = await fetch(\"/api/analyze\", {
          method: \"POST\",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || \"Failed to analyze document.\");
        }

        const data: AnalyzeResult = await res.json();
        setDocumentText(data.text);
        setFlags(data.flags);
        setSelectedFlagId(data.flags[0]?.id ?? null);
      } catch (e: unknown) {
        const message =
          e instanceof Error ? e.message : \"Unexpected error during analysis.\";
        setError(message);
      } finally {
        setIsAnalyzing(false);
      }
    },
    [selectedRule],
  );

  const onDrop = useCallback(
    async (event: React.DragEvent<HTMLButtonElement>) => {
      event.preventDefault();
      const file = event.dataTransfer.files?.[0];
      if (file) {
        void onFileChange(file);
      }
    },
    [onFileChange],
  );

  const handleBrowseClick = useCallback(() => {
    const input = document.getElementById(\"file-input-hidden\") as
      | HTMLInputElement
      | null;
    input?.click();
  }, []);

  const renderDocument = useMemo(() => {
    if (!documentText) {
      return (
        <>
          <p className=\"mb-2 text-[11px] uppercase tracking-wide text-slate-500\">
            Waiting for upload
          </p>
          <p className=\"text-slate-400\">
            Upload a contract to see a line-by-line view of the extracted text.
            Click on any flag in the audit panel to jump to the relevant clause.
          </p>
        </>
      );
    }

    if (!selectedFlag) {
      return <p className=\"whitespace-pre-wrap text-xs text-slate-200\">{documentText}</p>;
    }

    const { start, end } = selectedFlag;
    const before = documentText.slice(0, start);
    const target = documentText.slice(start, end);
    const after = documentText.slice(end);

    return (
      <p className=\"whitespace-pre-wrap text-xs leading-relaxed text-slate-200\">
        {before}
        <mark className=\"rounded bg-amber-200/20 px-0.5 py-0.5 text-amber-100 ring-1 ring-amber-400/60\">
          {target}
        </mark>
        {after}
      </p>
    );
  }, [documentText, selectedFlag]);

  const handleExportPdf = useCallback(() => {
    if (!flags.length) return;

    const doc = new jsPDF();
    const title = \"DocuSafe Audit – Findings Summary\";

    doc.setFont(\"helvetica\", \"bold\");
    doc.setFontSize(14);
    doc.text(title, 14, 18);

    doc.setFontSize(10);
    doc.setFont(\"helvetica\", \"normal\");
    const meta: string[] = [
      fileName ? `File: ${fileName}` : undefined,
      `Rule: ${
        AUDIT_RULE_OPTIONS.find((r) => r.id === selectedRule)?.label ??
        selectedRule
      }`,
      `Flags: ${flags.length}`,
    ].filter(Boolean) as string[];

    let y = 26;
    meta.forEach((line) => {
      doc.text(line, 14, y);
      y += 5;
    });

    y += 2;

    flags.forEach((flag, index) => {
      if (y > 270) {
        doc.addPage();
        y = 18;
      }

      doc.setFont(\"helvetica\", \"bold\");
      doc.text(`${index + 1}. ${flag.title} [${flag.severity}]`, 14, y);
      y += 5;

      doc.setFont(\"helvetica\", \"normal\");
      const messageLines = doc.splitTextToSize(flag.message, 180);
      doc.text(messageLines, 14, y);
      y += messageLines.length * 4 + 2;

      const excerptLines = doc.splitTextToSize(
        `Excerpt: ${flag.excerpt.trim()}`,
        180,
      );
      doc.text(excerptLines, 14, y);
      y += excerptLines.length * 4 + 6;
    });

    doc.save(\"docusafe-audit-report.pdf\");
  }, [flags, selectedRule, fileName]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-950 text-slate-50">
      <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-10 lg:py-12">
        <header className="flex flex-col items-start justify-between gap-6 border-b border-slate-800 pb-6 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              DocuSafe Audit
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
              Privacy‑first contract review for professionals
            </h1>
            <p className="max-w-2xl text-sm text-slate-400">
              Securely scan contracts for high‑risk clauses, missing dates, and compliance gaps.
              No permanent storage. Designed for legal, procurement, and compliance teams.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-2 text-xs font-medium text-slate-300">
              <div className="flex flex-col">
                <span className="text-[11px] uppercase tracking-wide text-slate-500">
                  Data Retention
                </span>
                <span className="text-sm text-emerald-400">OFF</span>
              </div>
              <div className="relative h-7 w-12 rounded-full bg-slate-900">
                <div className="absolute inset-y-1 right-1 w-5 rounded-full bg-slate-700 shadow-sm" />
              </div>
            </div>
          </div>
        </header>

        <section className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">
                    Secure Upload
                  </h2>
                  <p className="text-xs text-slate-400">
                    Drag and drop PDF or Word files. Files are processed in memory only.
                  </p>
                </div>
                <div className="flex flex-col gap-1 text-right text-[11px] text-slate-500">
                  <span>Encryption in transit</span>
                  <span>Configurable retention (coming soon)</span>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
                <button
                  type="button"
                  onClick={handleBrowseClick}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={onDrop}
                  className="group flex h-40 flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 px-4 text-center text-sm text-slate-300 transition hover:border-sky-500/80 hover:bg-slate-900/70"
                >
                  <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] font-medium text-slate-300 group-hover:border-sky-500/60 group-hover:text-sky-200">
                    Drop contract here or click to browse
                  </span>
                  <span className="text-xs text-slate-500">
                    Supports .pdf, .docx. Max 25 MB.
                  </span>
                  {fileName && (
                    <span className="mt-1 truncate text-xs text-slate-300">
                      Selected: <span className="font-medium">{fileName}</span>
                    </span>
                  )}
                </button>

                <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/80 p-3 sm:p-4">
                  <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Audit Rule
                  </label>
                  <select
                    className="h-9 rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs text-slate-100 outline-none ring-0 transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    value={selectedRule}
                    onChange={(e) =>
                      setSelectedRule(e.target.value as AuditRule)
                    }
                  >
                    {AUDIT_RULE_OPTIONS.map((rule) => (
                      <option key={rule.id} value={rule.id}>
                        {rule.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.getElementById(
                        "file-input-hidden",
                      ) as HTMLInputElement | null;
                      if (input?.files?.[0]) {
                        void onFileChange(input.files[0]);
                      }
                    }}
                    disabled={isAnalyzing}
                    className="mt-1 inline-flex items-center justify-center rounded-lg bg-sky-500 px-3 py-2 text-xs font-medium text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                  >
                    {isAnalyzing ? "Analyzing…" : "Run Audit"}
                  </button>
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    disabled={!flags.length}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-sky-500/70 hover:text-sky-100 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
                  >
                    Export PDF Report
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-100">
                  Document
                </h2>
                <span className="text-xs text-slate-500">
                  Text view (read‑only)
                </span>
              </div>
              <div className="h-[340px] overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs leading-relaxed text-slate-300">
                {renderDocument}
              </div>
              {error && (
                <p className="mt-2 text-xs text-rose-400">
                  {error}
                </p>
              )}
            </div>
          </div>

          <aside className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100">
                Audit Flags
              </h2>
              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] text-slate-400">
                Senior Legal Ops Review
              </span>
            </div>
            <p className="text-xs text-slate-400">
              When you run an audit, DocuSafe highlights potential risk areas and missing information.
              Click a flag to focus the matching text in the document viewer.
            </p>

            <div className="mt-1 flex-1 space-y-2">
              {!documentText && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    No document loaded
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Upload a contract and choose{" "}
                    <span className="font-semibold text-slate-200">
                      “Identify High‑Risk Liability Clauses”
                    </span>{" "}
                    to generate flags such as unlimited indemnity, uncapped liability,
                    or broad consequential loss exposure.
                  </p>
                </div>
              )}

              {!!documentText && !flags.length && !isAnalyzing && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    No flags detected
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    No clauses matched the current audit rule. A human reviewer should still perform
                    a high-level pass for context-specific risk.
                  </p>
                </div>
              )}

              {isAnalyzing && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    Running analysis…
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Looking for liability and indemnity language that may expose you to uncapped or
                    asymmetric risk.
                  </p>
                </div>
              )}

              {!isAnalyzing &&
                flags.map((flag) => (
                  <button
                    key={flag.id}
                    type="button"
                    onClick={() => setSelectedFlagId(flag.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-xs transition ${
                      selectedFlagId === flag.id
                        ? "border-amber-400/80 bg-amber-400/10 text-amber-50"
                        : "border-slate-800 bg-slate-950/80 text-slate-200 hover:border-sky-500/60 hover:bg-slate-900"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="font-medium">{flag.title}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                          flag.severity === "high"
                            ? "bg-rose-500/20 text-rose-200"
                            : flag.severity === "medium"
                            ? "bg-amber-500/20 text-amber-100"
                            : "bg-slate-700/60 text-slate-100"
                        }`}
                      >
                        {flag.severity}
                      </span>
                    </div>
                    <p className="mb-1 line-clamp-3 text-[11px] text-slate-300">
                      {flag.message}
                    </p>
                    <p className="line-clamp-2 text-[11px] text-slate-400">
                      {flag.excerpt.trim()}
                    </p>
                  </button>
                ))}
            </div>

            <div className="mt-2 border-t border-slate-800 pt-3 text-[11px] text-slate-500">
              System prompt:{" "}
              <span className="font-mono text-slate-300">
                Senior Legal Operations Manager — skeptical, detail‑oriented, privacy‑first.
              </span>
            </div>
          </aside>
        </section>
      </main>
      <input
        id="file-input-hidden"
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          if (f) void onFileChange(f);
        }}
      />
    </div>
  );
}
