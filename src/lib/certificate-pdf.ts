import { jsPDF } from "jspdf";

export interface CertificateInput {
  studentName: string;
  courseTitle: string;
  instructorName: string;
  issuedAt: string | Date;
  certificateId: string;
}

export function downloadCertificatePDF(input: CertificateInput) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297;
  const H = 210;

  // Background
  doc.setFillColor(15, 23, 42); // navy #0f172a
  doc.rect(0, 0, W, H, "F");

  // Gold border
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(2);
  doc.rect(10, 10, W - 20, H - 20);
  doc.setLineWidth(0.4);
  doc.rect(14, 14, W - 28, H - 28);

  // Brand
  doc.setTextColor(59, 130, 246); // electric blue
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("LearnForge", W / 2, 36, { align: "center" });
  doc.setFontSize(9);
  doc.setTextColor(180, 200, 240);
  doc.text("Learn Without Limits", W / 2, 42, { align: "center" });

  // Heading
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.text("CERTIFICATE", W / 2, 62, { align: "center" });
  doc.setTextColor(212, 175, 55);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text("of Completion", W / 2, 74, { align: "center" });

  // Body intro
  doc.setTextColor(220, 230, 250);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text("This is to certify that", W / 2, 92, { align: "center" });

  // Student name
  doc.setTextColor(255, 255, 255);
  doc.setFont("times", "italic");
  doc.setFontSize(36);
  doc.text(input.studentName, W / 2, 110, { align: "center" });

  // Decorative underline
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.6);
  const nameW = Math.min(180, doc.getTextWidth(input.studentName) + 20);
  doc.line(W / 2 - nameW / 2, 115, W / 2 + nameW / 2, 115);

  // Course
  doc.setTextColor(220, 230, 250);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text("has successfully completed the course", W / 2, 128, { align: "center" });
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(input.courseTitle, W / 2, 142, { align: "center", maxWidth: W - 60 });

  // Date + signature row
  const date = typeof input.issuedAt === "string" ? new Date(input.issuedAt) : input.issuedAt;
  const dateStr = date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const y = 172;
  doc.setDrawColor(120, 140, 180);
  doc.setLineWidth(0.3);
  doc.line(40, y, 110, y);
  doc.line(W - 110, y, W - 40, y);

  doc.setTextColor(220, 230, 250);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(dateStr, 75, y + 6, { align: "center" });
  doc.text(input.instructorName, W - 75, y + 6, { align: "center" });

  doc.setTextColor(150, 170, 200);
  doc.setFontSize(8);
  doc.text("DATE OF COMPLETION", 75, y + 12, { align: "center" });
  doc.text("INSTRUCTOR", W - 75, y + 12, { align: "center" });

  // Cert ID
  doc.setFontSize(7);
  doc.setTextColor(120, 140, 180);
  doc.text(`Certificate ID: ${input.certificateId}`, W / 2, H - 16, { align: "center" });
  doc.text("Verify at learnforge.app/verify", W / 2, H - 12, { align: "center" });

  doc.save(`LearnForge-Certificate-${input.courseTitle.replace(/[^a-z0-9]+/gi, "-")}.pdf`);
}
