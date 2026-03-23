// 17_BOQ.tsx
// Centralised BOQ formatting and export logic for finalized reports (Word .docx).

// NOTE: This file is pure logic (no React component).

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType,
  VerticalAlignTable,
  TableLayoutType,
  Footer,
  TabStopType,
  UnderlineType,
  PageNumber,
  SectionType,
  VerticalAlign,
} from "docx";

import { computeAccessControlMeanCosts } from "../utils/accessControlMeanPricing";
import { computeCctvMeanCosts } from "../utils/cctvMeanPricing";
import { computeFireAlarmMeanCosts } from "../utils/fireAlarmMeanPricing";
import { computeFireProtectionMeanCosts } from "../utils/fireProtectionMeanPricing";
import { computeBurglarAlarmMeanCosts } from "../utils/burglarAlarmMeanPricing";
import { CONSUMABLE_DEFAULT_PRICES } from "../utils/consumableDefaultPrices";

// --- AA2000 DOCX formatting (matches reference: AA2000_REPORT_1_qo7zlds9f) ---
const REPORT_FONT = "Arial";
const PRIMARY_COLOR = "003399";
const GREY = "636363";
const TABLE_BORDER_COLOR = "777777";
const HEADER_FILL = "3D3D3D";
const UNIT_TABLE_HEADER_FILL = "C0C0C0";
const BLACK = "000000";

// docx sizes are in half-points; reference uses: 22pt=44, 11pt=22, 14pt=28, 10pt=20, 8pt=16
const FONT = {
  company: 44,
  subtitle: 22,
  mainTitle: 28,
  section: 22,
  body: 20,
  small: 16,
} as const;

const CELL_PARA_SPACING = 80; // reference tables: before=80 after=80 (twips)

const tableBorder = { style: BorderStyle.SINGLE, size: 12, color: TABLE_BORDER_COLOR };

const OVERVIEW_COLS = [2551, 2551, 2551, 2551] as const;
const UNIT_COLS = [850, 6350, 1100] as const;
const EFFORT_COLS = [2551, 2551, 2551, 2551] as const;
const FIN_COLS = [850, 6236, 1134, 1984] as const;

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2 }).format(val);

const cellP = (text: string, opts: { bold?: boolean; color?: string } = {}) =>
  new Paragraph({
    children: [
      new TextRun({
        text,
        font: REPORT_FONT,
        bold: opts.bold ?? false,
        color: opts.color ?? BLACK,
        size: FONT.small,
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { before: CELL_PARA_SPACING, after: CELL_PARA_SPACING },
  });

const sectionTitle = (title: string) =>
  new Paragraph({
    children: [
      new TextRun({
        text: title.toUpperCase(),
        font: REPORT_FONT,
        bold: true,
        color: PRIMARY_COLOR,
        size: FONT.section,
      }),
    ],
    spacing: { before: 240, after: 0, line: 260 },
  });

const blueLine = (thick: boolean) =>
  new Paragraph({
    border: {
      bottom: {
        color: PRIMARY_COLOR,
        space: 1,
        style: BorderStyle.SINGLE,
        size: thick ? 28 : 14,
      },
    },
    spacing: { before: 0, after: 120, line: 100 },
    children: [new TextRun({ text: " ", font: REPORT_FONT })],
  });

const makeFooter = () => {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({ text: "-- ", font: REPORT_FONT, size: FONT.small, color: BLACK }),
          new TextRun({ children: [PageNumber.CURRENT], font: REPORT_FONT, size: FONT.small, color: BLACK }),
          new TextRun({ text: " of ", font: REPORT_FONT, size: FONT.small, color: BLACK }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: REPORT_FONT, size: FONT.small, color: BLACK }),
          new TextRun({ text: " --", font: REPORT_FONT, size: FONT.small, color: BLACK }),
        ],
      }),
    ],
  });
};

const signatureBlock = (technicianName: string) => {
  const tabStop = { type: TabStopType.LEFT, position: 5247 };
  const lineChars = "________________________________________";
  return [
    new Paragraph({
      tabStops: [tabStop],
      spacing: { before: 0, after: 40 },
      children: [
        new TextRun({
          text: lineChars,
          font: REPORT_FONT,
          size: FONT.body,
          color: BLACK,
          underline: { type: UnderlineType.SINGLE, color: BLACK },
        }),
        new TextRun({ text: "\t", font: REPORT_FONT }),
        new TextRun({
          text: lineChars,
          font: REPORT_FONT,
          size: FONT.body,
          color: BLACK,
          underline: { type: UnderlineType.SINGLE, color: BLACK },
        }),
      ],
    }),
    new Paragraph({
      tabStops: [tabStop],
      spacing: { before: 0, after: 80 },
      children: [
        new TextRun({ text: "PREPARED BY (TECHNICIAN)", font: REPORT_FONT, bold: true, size: FONT.body, color: BLACK }),
        new TextRun({ text: "\t", font: REPORT_FONT }),
        new TextRun({ text: "APPROVED BY (SALES & ADMIN)", font: REPORT_FONT, bold: true, size: FONT.body, color: BLACK }),
      ],
    }),
    new Paragraph({
      tabStops: [tabStop],
      spacing: { before: 0, after: 0 },
      children: [
        new TextRun({ text: technicianName || "N/A", font: REPORT_FONT, size: FONT.body, color: BLACK }),
        new TextRun({ text: "\t", font: REPORT_FONT }),
        new TextRun({ text: " ", font: REPORT_FONT, size: FONT.body, color: BLACK }),
      ],
    }),
  ];
};

// Push signatures visually to the bottom of the last page.
// If there isn't enough remaining space, Word will naturally flow the spacer+signatures to a new last page.
const signatureSpacer = (lines: number = 18) =>
  new Paragraph({
    spacing: { before: 0, after: 0, line: 240 },
    children: Array.from({ length: Math.max(0, lines) }).map((_, i) =>
      new TextRun({ text: i === 0 ? "" : "", break: 1, font: REPORT_FONT, size: FONT.body }),
    ),
  });

/** Builds the full BOQ report document (same format as download). Returns Blob for download or upload. */
export async function buildBoqDocument(selectedProject: any): Promise<Blob> {
  if (!selectedProject) throw new Error("No project data");
  const p = selectedProject.project;
  const c = selectedProject.cctvData;
  const f = selectedProject.faData;
  const fp = selectedProject.fpData;
  const ba = selectedProject.baData;
  const a = selectedProject.acData;
  const estimations = selectedProject.estimations || {};
  const estimationData = selectedProject.estimationData;
  const techNotes = selectedProject.techNotes || "";

  // Aggregate calculations
  let totalProjectDays = 0;
  let peakManpower = 0;
  let totalManDays = 0;

  if (Object.keys(estimations).length > 0) {
    Object.values(estimations as Record<string, { days: number; techs: number }>).forEach(
      (est) => {
        totalProjectDays += est.days;
        totalManDays += est.days * est.techs;
        if (est.techs > peakManpower) peakManpower = est.techs;
      },
    );
  } else if (estimationData) {
    totalProjectDays = estimationData.days;
    peakManpower = estimationData.techs;
    totalManDays = estimationData.days * estimationData.techs;
  }

  const systemsLabel = [c ? "CCTV" : "", f ? "FA" : "", fp ? "FP" : "", ba ? "BA" : "", a ? "AC" : "", estimationData ? "OTHER" : ""]
    .filter(Boolean)
    .join(", ") || "N/A";

  const border = tableBorder;

  const children: (Paragraph | Table)[] = [];

  // Header branding
  children.push(
    new Paragraph({
      spacing: { before: 0, after: 40 },
      children: [
        new TextRun({ text: "AA2000", bold: true, font: REPORT_FONT, color: PRIMARY_COLOR, size: FONT.company }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 40 },
      children: [
        new TextRun({
          text: "SECURITY & TECHNOLOGY SOLUTIONS INC.",
          font: REPORT_FONT,
          bold: true,
          size: FONT.subtitle,
          color: GREY,
        }),
      ],
    }),
    blueLine(true),
    new Paragraph({
      children: [
        new TextRun({
          text: "COMPREHENSIVE SITE SURVEY REPORT",
          font: REPORT_FONT,
          bold: true,
          color: BLACK,
          size: FONT.mainTitle,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 240 },
    }),
  );

  // Section: Project & Site Overview
  children.push(sectionTitle("PROJECT & SITE OVERVIEW"), blueLine(false));

  const overviewCell = (text: string, opts: { bold?: boolean; fill?: string } = {}) =>
    new TableCell({
      verticalAlign: VerticalAlignTable.CENTER,
      shading: opts.fill ? { fill: opts.fill, type: ShadingType.SOLID } : undefined,
      margins: { top: 0, bottom: 0, left: 40, right: 40 },
      borders: { top: border, bottom: border, left: border, right: border },
      children: [cellP(text, { bold: opts.bold })],
    });

  const overviewRows: TableRow[] = [
    new TableRow({
      children: [
        overviewCell("Project ID:", { bold: true }),
        overviewCell(p.id || "N/A"),
        overviewCell("Technician:", { bold: true }),
        overviewCell(p.technicianName || "N/A"),
      ],
    }),
    new TableRow({
      children: [
        overviewCell("Client Name:", { bold: true }),
        overviewCell(p.clientName || "N/A"),
        overviewCell("Contact No:", { bold: true }),
        overviewCell(p.clientContact || "N/A"),
      ],
    }),
    new TableRow({
      children: [
        overviewCell("Site Location:", { bold: true }),
        overviewCell(p.location || "N/A"),
        overviewCell("Survey Date:", { bold: true }),
        overviewCell(p.date || "N/A"),
      ],
    }),
    new TableRow({
      children: [
        overviewCell("Report Status:", { bold: true }),
        overviewCell(p.status || "Completed"),
        overviewCell("System(s):", { bold: true }),
        overviewCell(systemsLabel),
      ],
    }),
  ];

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      columnWidths: [...OVERVIEW_COLS],
      rows: overviewRows,
    }),
  );

  // Section: UNIT TABLE (Unit & Detailed)
  // Build equipment/cabling line items (same as Financial Estimation, excluding consumables row and manpower) for both Unit Table and Financial table.
  const equipmentLineItems: Array<{ desc: string; qty: number; amount: number }> = [];
  if (c?.cameras?.length) {
    const computedCctv = computeCctvMeanCosts(c);
    equipmentLineItems.push({
      desc: "CCTV Equipment Baseline Estimate",
      qty: c.cameras.length,
      amount: computedCctv.equipment,
    });
  }
  if (f?.detectionAreas?.length) {
    const computedFa = computeFireAlarmMeanCosts(f);
    let totalDetect = 0;
    f.detectionAreas.forEach((area: any) =>
      (area.devices || []).forEach((d: any) => {
        totalDetect += Number(d.count) || 0;
      }),
    );
    equipmentLineItems.push({
      desc: "Fire Detection Hardware Estimate",
      qty: totalDetect,
      amount: computedFa.equipment + computedFa.cablesCost,
    });
  }
  if (fp?.protectionUnits?.length) {
    const computedFp = computeFireProtectionMeanCosts(fp);
    equipmentLineItems.push({
      desc: "Fire Protection Equipment Estimate",
      qty: fp.protectionUnits.length,
      amount: computedFp.equipment + computedFp.cablesCost,
    });
  }
  if (ba?.sensors?.length) {
    const computedBa = computeBurglarAlarmMeanCosts(ba);
    const totalSensors = ba.sensors.reduce((sum: number, s: any) => sum + (Number(s.count) || 0), 0);
    equipmentLineItems.push({
      desc: "Burglar Alarm Equipment Estimate",
      qty: totalSensors,
      amount: computedBa.equipment + computedBa.cablesCost,
    });
  }
  if (a) {
    const computed = computeAccessControlMeanCosts(a);
    const b = computed.breakdown;
    if (b.facialRecognitionQty > 0) {
      equipmentLineItems.push({
        desc: "Facial Recognition Terminals Estimate",
        qty: b.facialRecognitionQty,
        amount: b.facialRecognitionQty * 29093,
      });
    }
    if (b.biometricReadersQty > 0) {
      equipmentLineItems.push({
        desc: "Biometric Fingerprint Readers Estimate",
        qty: b.biometricReadersQty,
        amount: b.biometricReadersQty * 10658,
      });
    }
    if (b.rfidCardReadersQty > 0) {
      equipmentLineItems.push({
        desc: "RFID / Card Access Readers Estimate",
        qty: b.rfidCardReadersQty,
        amount: b.rfidCardReadersQty * 9850,
      });
    }
    if (b.controllersQty > 0) {
      equipmentLineItems.push({
        desc: "Access Control Controllers Estimate",
        qty: b.controllersQty,
        amount: b.controllersQty * 17335,
      });
    }
    if (b.electricLocksQty > 0) {
      equipmentLineItems.push({
        desc: "Electric Strike / Maglock Estimate",
        qty: b.electricLocksQty,
        amount: b.electricLocksQty * 5976,
      });
    }
    if (b.exitButtonsQty > 0) {
      equipmentLineItems.push({
        desc: "Exit / REX Push Button Estimate",
        qty: b.exitButtonsQty,
        amount: b.exitButtonsQty * 351.5,
      });
    }
    if (b.doorContactsQty > 0) {
      equipmentLineItems.push({
        desc: "Door Contact (Magnetic Sensor) Estimate",
        qty: b.doorContactsQty,
        amount: b.doorContactsQty * 150,
      });
    }
    if (b.powerSuppliesQty > 0) {
      equipmentLineItems.push({
        desc: "Power Supply Estimate",
        qty: b.powerSuppliesQty,
        amount: b.powerSuppliesQty * 97,
      });
    }
    if (computed.cableMeters > 0) {
      equipmentLineItems.push({
        desc: "Access Control Cabling Estimate",
        qty: computed.cableMeters,
        amount: computed.cablesCost,
      });
    }
  }

  const unitItems: Array<{ desc: string; qty: number }> = [];
  // First: all equipment/cabling from Financial Estimation (description without " Estimate")
  equipmentLineItems.forEach((item) => {
    unitItems.push({
      desc: item.desc.replace(/\s+Estimate$/, ""),
      qty: item.qty,
    });
  });
  // Then: detailed camera/device breakdown
  if (c?.cameras?.length) {
    const grouped = new Map<string, number>();
    c.cameras.forEach((cam: any) => {
      const label = `${cam.type || "Camera"}${cam.resolution ? `, ${cam.resolution}` : ""}`;
      grouped.set(label, (grouped.get(label) || 0) + 1);
    });
    Array.from(grouped.entries()).forEach(([label, qty]) => unitItems.push({ desc: label, qty }));
  }
  if (f?.detectionAreas?.length) {
    const grouped = new Map<string, number>();
    f.detectionAreas.forEach((area: any) =>
      (area.devices || []).forEach((d: any) => {
        const name = d.deviceType || d.type || d.name || "Device";
        grouped.set(name, (grouped.get(name) || 0) + (Number(d.count) || 0));
      }),
    );
    Array.from(grouped.entries()).forEach(([label, qty]) => unitItems.push({ desc: label, qty }));
  }
  if (ba?.sensors?.length) {
    const grouped = new Map<string, number>();
    ba.sensors.forEach((s: any) => {
      const label = s.type || "Sensor";
      const n = Number(s.count) || 0;
      grouped.set(label, (grouped.get(label) || 0) + n);
    });
    Array.from(grouped.entries()).forEach(([label, qty]) => unitItems.push({ desc: label, qty }));
  }
  // Then: consumables breakdown (screws, tape, etc. from EstimationScreen)
  if (estimations && Object.keys(estimations).length > 0) {
    const grouped = new Map<string, number>();
    Object.values(estimations as Record<string, any>).forEach((est) => {
      (est?.consumablesList || []).forEach((cItem: any) => {
        const name = String(cItem?.name || "").trim();
        const qty = Number(cItem?.qty) || 0;
        if (!name || qty <= 0) return;
        grouped.set(name, (grouped.get(name) || 0) + qty);
      });
    });
    Array.from(grouped.entries()).forEach(([name, qty]) => unitItems.push({ desc: name, qty }));
  }

  children.push(sectionTitle("Unit Description"), blueLine(false));

  const unitCell = (text: string, opts: { bold?: boolean; fill?: string; color?: string } = {}) =>
    new TableCell({
      verticalAlign: VerticalAlignTable.CENTER,
      shading: opts.fill ? { fill: opts.fill, type: ShadingType.SOLID } : undefined,
      margins: { top: 0, bottom: 0, left: 60, right: 60 },
      borders: { top: border, bottom: border, left: border, right: border },
      children: [cellP(text, { bold: opts.bold, color: opts.color })],
    });

  const unitRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        unitCell("#", { bold: true, fill: UNIT_TABLE_HEADER_FILL, color: "FFFFFF" }),
        unitCell("Description", { bold: true, fill: UNIT_TABLE_HEADER_FILL, color: "FFFFFF" }),
        unitCell("Qty", { bold: true, fill: UNIT_TABLE_HEADER_FILL, color: "FFFFFF" }),
      ],
    }),
    ...unitItems.map((it, idx) =>
      new TableRow({
        children: [
          unitCell(String(idx + 1)),
          unitCell(it.desc),
          unitCell(String(it.qty)),
        ],
      }),
    ),
  ];

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      columnWidths: [...UNIT_COLS],
      rows: unitRows,
    }),
  );

  // Section: CUMULATIVE PROJECT EFFORT
  children.push(sectionTitle("CUMULATIVE PROJECT EFFORT"), blueLine(false));

  const effortCell = (text: string, opts: { bold?: boolean } = {}) =>
    new TableCell({
      verticalAlign: VerticalAlignTable.CENTER,
      margins: { top: 0, bottom: 0, left: 40, right: 40 },
      borders: { top: border, bottom: border, left: border, right: border },
      children: [cellP(text, { bold: opts.bold })],
    });

  const effortRows: TableRow[] = [
    new TableRow({
      children: [
        effortCell("Peak Team Size:", { bold: true }),
        effortCell(`${peakManpower} Techs`),
        effortCell("Total Duration:", { bold: true }),
        effortCell(`${totalProjectDays} Sequence Days`),
      ],
    }),
    new TableRow({
      children: [
        effortCell("Effort Context:", { bold: true }),
        effortCell("Sequential Implementation"),
        effortCell("Calculated Man-Days:", { bold: true }),
        effortCell(`${totalManDays} Man-Days`),
      ],
    }),
  ];

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      columnWidths: [...EFFORT_COLS],
      rows: effortRows,
    }),
  );

  // Section: Project Financial Estimation (BOQ)
  const LABOR_RATE_PER_HOUR: Record<string, number> = {
    "General Helper / Laborer": 100,
    "Pipe Fitter / Electrician": 120,
    "LV Installer": 140,
    "Lead Technician / Senior Installer": 175,
    "Programmer/Commissioning Tech": 200,
    "Safety Officer": 125,
  };
  const DEFAULT_LABOR_RATE_PER_HOUR = 150;

  const lineItems: { desc: string; qty: number; amount: number }[] = [...equipmentLineItems];

  // --- Consumables estimate (from estimation saved list) ---
  // Placed before manpower so it always appears above manpower rows in the BOQ table.
  let consumablesTotalCost = 0;
  let consumablesTotalQty = 0;
  Object.values(estimations as Record<string, any>).forEach((est) => {
    (est?.consumablesList || []).forEach((cItem: any) => {
      const qty = Number(cItem.qty) || 0;
      const name = String(cItem.name || "");
      const unitPrice =
        Number(cItem.unitPrice) ||
        (name && CONSUMABLE_DEFAULT_PRICES[name] ? CONSUMABLE_DEFAULT_PRICES[name] : 0);
      if (qty <= 0) return;
      consumablesTotalQty += qty;
      consumablesTotalCost += qty * unitPrice;
    });
  });
  // Show the line item whenever consumables exist; amount is the sum of all items.
  if (consumablesTotalQty > 0) {
    lineItems.push({
      desc: "Installation Consumables Estimate",
      qty: consumablesTotalQty,
      amount: consumablesTotalCost,
    });
  }

  // --- Additional fees (one row per fee type, e.g. Travel Fee) ---
  const additionalFeesByType = new Map<string, number>();
  Object.values(estimations as Record<string, any>).forEach((est) => {
    (est?.additionalFees || []).forEach((f: { type: string; amount: number }) => {
      const typeName = String(f?.type || "Additional Fee").trim() || "Additional Fee";
      const amt = Number(f?.amount) || 0;
      if (amt <= 0) return;
      additionalFeesByType.set(typeName, (additionalFeesByType.get(typeName) || 0) + amt);
    });
  });
  Array.from(additionalFeesByType.entries()).forEach(([feeType, amount]) => {
    lineItems.push({
      desc: feeType,
      qty: 1,
      amount,
    });
  });

  // --- Manpower rows (by role) ---
  const manpowerByRole = new Map<string, { count: number; totalHours: number; totalCost: number }>();
  Object.values(estimations as Record<string, any>).forEach((est) => {
    (est?.manpowerBreakdown || []).forEach((mp: any) => {
      const role = String(mp.role || "Technician");
      const count = Number(mp.count) || 0;
      const hours = Number(mp.hours) || 0;
      if (count <= 0 || hours <= 0) return;
      const rate = LABOR_RATE_PER_HOUR[role] ?? DEFAULT_LABOR_RATE_PER_HOUR;
      const roleHours = count * hours;
      const roleCost = roleHours * rate;
      const prev = manpowerByRole.get(role) || { count: 0, totalHours: 0, totalCost: 0 };
      manpowerByRole.set(role, {
        count: prev.count + count,
        totalHours: prev.totalHours + roleHours,
        totalCost: prev.totalCost + roleCost,
      });
    });
  });

  Array.from(manpowerByRole.entries()).forEach(([role, v]) => {
    lineItems.push({
      desc: `Manpower – ${role}`,
      qty: v.count,
      amount: v.totalCost,
    });
  });

  children.push(sectionTitle("PROJECT FINANCIAL ESTIMATION"), blueLine(false));

  const finCell = (text: string, opts: { bold?: boolean; fill?: string; color?: string } = {}) =>
    new TableCell({
      verticalAlign: VerticalAlignTable.CENTER,
      shading: opts.fill ? { fill: opts.fill, type: ShadingType.SOLID } : undefined,
      margins: { top: 0, bottom: 0, left: 60, right: 60 },
      borders: { top: border, bottom: border, left: border, right: border },
      children: [cellP(text, { bold: opts.bold, color: opts.color })],
    });

  let grandTotal = 0;
  const boqRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        finCell("#", { bold: true, fill: HEADER_FILL, color: "FFFFFF" }),
        finCell("Description", { bold: true, fill: HEADER_FILL, color: "FFFFFF" }),
        finCell("Qty", { bold: true, fill: HEADER_FILL, color: "FFFFFF" }),
        finCell("Amount (P)", { bold: true, fill: HEADER_FILL, color: "FFFFFF" }),
      ],
    }),
  ];

  lineItems.forEach((item, idx) => {
    const rowTotal = item.amount;
    grandTotal += rowTotal;
    boqRows.push(
      new TableRow({
        children: [
          finCell(String(idx + 1)),
          finCell(item.desc),
          finCell(String(item.qty)),
          finCell(formatCurrency(rowTotal)),
        ],
      }),
    );
  });

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      columnWidths: [...FIN_COLS],
      rows: boqRows,
    }),
    new Paragraph({
      spacing: { before: 240, after: 240 },
      alignment: AlignmentType.LEFT,
      children: [
        new TextRun({ text: "ESTIMATED PROJECT TOTAL (EXCL. TAXES):", font: REPORT_FONT, bold: true, color: BLACK, size: FONT.section }),
        new TextRun({ text: "\t", font: REPORT_FONT }),
        new TextRun({ text: "PHP " + formatCurrency(grandTotal), font: REPORT_FONT, bold: true, color: PRIMARY_COLOR, size: FONT.section }),
      ],
    }),
  );

  // Technician narrative
  if (techNotes && techNotes.trim()) {
    children.push(
      sectionTitle("TECHNICAL REMARKS & OBSERVATIONS"),
      blueLine(false),
      new Paragraph({
        children: [new TextRun({ text: techNotes, font: REPORT_FONT, color: BLACK, size: FONT.body })],
        spacing: { after: 240 },
      }),
    );
  }

  const doc = new Document({
    sections: [
      {
        footers: { default: makeFooter() },
        properties: {
          page: {
            margin: {
              top: 640,
              right: 708,
              bottom: 1700,
              left: 708,
              header: 0,
              footer: 1512,
              gutter: 0,
            },
          },
        },
        children,
      },
      {
        footers: { default: makeFooter() },
        properties: {
          // Use a continuous final section so signatures stay on the last page
          // when space permits; Word will automatically move this section to a new
          // page only if there's not enough remaining space.
          type: SectionType.CONTINUOUS,
          page: {
            margin: {
              top: 640,
              right: 708,
              bottom: 1700,
              left: 708,
              header: 0,
              footer: 1512,
              gutter: 0,
            },
          },
          verticalAlign: VerticalAlign.BOTTOM,
        },
        children: [signatureSpacer(), ...signatureBlock(p.technicianName || "N/A")],
      },
    ],
  });
  return Packer.toBlob(doc);
}

/** Downloads the BOQ report as a .docx file (same format as buildBoqDocument). */
export async function downloadBoqPdf(selectedProject: any) {
  if (!selectedProject) return;
  const blob = await buildBoqDocument(selectedProject);
  const p = selectedProject.project;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `AA2000_REPORT_${(p.name || p.id || "Report").toString().replace(/\s+/g, "_")}_${p.id || "report"}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Payload for a single survey estimation (used when uploading estimation .docx to backend). */
export interface EstimationDocPayload {
  days: number;
  techs: number;
  manpowerBreakdown?: Array<{ role: string; count: number; hours: number }>;
  consumablesList?: Array<{ name: string; category: string; qty: number; unitPrice?: number }>;
  additionalFees?: Array<{ type: string; amount: number }>;
}

/** Survey data for building BOQ (same shape as in App/CurrentProjects). */
export interface EstimationSurveyData {
  cctvData?: any;
  faData?: any;
  fpData?: any;
  acData?: any;
  baData?: any;
  otherData?: any;
}

/**
 * Builds a Word (.docx) in the same format as the full BOQ report (downloadBoqPdf),
 * for a single estimation + project + survey data. Used for upload to estimationFile.
 */
export async function createEstimationDocx(
  project: any,
  surveyType: string,
  estimation: EstimationDocPayload,
  surveyData: EstimationSurveyData,
  techNotes?: string
): Promise<Blob> {
  const selectedProject = {
    project,
    cctvData: surveyData.cctvData ?? null,
    faData: surveyData.faData ?? null,
    fpData: surveyData.fpData ?? null,
    acData: surveyData.acData ?? null,
    baData: surveyData.baData ?? null,
    otherData: surveyData.otherData ?? null,
    estimations: { [surveyType]: estimation },
    estimationData: surveyType === "Other" ? { days: estimation.days, techs: estimation.techs } : undefined,
    techNotes: techNotes ?? "",
  };
  return buildBoqDocument(selectedProject);
}
