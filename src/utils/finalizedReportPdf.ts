import { jsPDF } from "jspdf";

/**
 * Finalized project report as PDF: overview, estimation breakdown, technician + department remarks.
 */
export function downloadFinalizedReportPdf(selectedProject: any): void {
  if (!selectedProject?.project) return;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  const maxW = pageW - margin * 2;
  let y = margin;
  const lineGap = 5.5;
  const sectionGap = 7;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const addHeading = (t: string) => {
    ensureSpace(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(37, 99, 235);
    doc.text(t, margin, y);
    y += sectionGap;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
  };

  const addLines = (text: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(text, maxW);
    for (const line of lines) {
      ensureSpace(lineGap);
      doc.text(line, margin, y);
      y += lineGap;
    }
  };

  const p = selectedProject.project;
  const estimations = selectedProject.estimations || {};
  const techNotes = String(selectedProject.techNotes || "").trim();
  const remarks = Array.isArray(selectedProject.remarks) ? selectedProject.remarks : [];

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text("AA2000 — Finalized Project Report", margin, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40, 40, 40);
  addLines(
    [
      `Project: ${p.name || "—"}`,
      `Client: ${p.clientName || "—"}`,
      `Location: ${p.locationName || p.location || "—"}`,
      `Status: ${p.status || "—"}`,
      `Technician: ${p.technicianName || "—"}`,
    ].join("\n"),
  );
  y += sectionGap;

  addHeading("Technical & estimation breakdown");
  const estKeys = Object.keys(estimations);
  if (estKeys.length === 0) {
    addLines("No estimation records attached to this finalized report.");
  } else {
    for (const k of estKeys) {
      const est = estimations[k] as any;
      const days = est?.days ?? "—";
      const techs = est?.techs ?? "—";
      let block = `System: ${k}\nSchedule: ${days} day(s) · Peak manpower: ${techs} technician(s).`;
      const mp = est?.manpowerBreakdown;
      if (Array.isArray(mp) && mp.length) {
        block += "\nManpower: " + mp.map((m: any) => `${m.role || "?"} ×${m.count} @ ${m.hours}h`).join("; ");
      }
      const cons = est?.consumablesList;
      if (Array.isArray(cons) && cons.length) {
        block += "\nConsumables: " + cons.map((c: any) => `${c.name} (${c.qty})`).join(", ");
      }
      const siteBits = [est?.siteConstraintPhysical, est?.siteConstraintElectrical, est?.siteConstraintInstallation].filter(Boolean);
      if (siteBits.length) {
        block += "\nSite constraints: " + siteBits.join(" · ");
      }
      addLines(block);
      y += 4;
    }
  }
  y += sectionGap;

  addHeading("Technician remarks");
  addLines(techNotes || "No technician remarks recorded.");
  y += sectionGap;

  addHeading("Department remarks");
  if (!remarks.length) {
    addLines("No department remarks recorded.");
  } else {
    remarks.forEach((r: any, i: number) => {
      const sender = r?.sender || "Dept";
      const ts = r?.timestamp || "";
      const head = `${i + 1}. ${sender}${ts ? ` · ${ts}` : ""}`;
      doc.setFont("helvetica", "bold");
      ensureSpace(lineGap);
      doc.text(head, margin, y);
      y += lineGap;
      doc.setFont("helvetica", "normal");
      addLines(String(r?.text || ""));
      y += 3;
    });
  }

  const safe = String(p.name || p.id || "report")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "");
  doc.save(`AA2000_FINAL_${safe}.pdf`);
}
