/** リサーチレポート保存ツール */

import { eq, desc } from "drizzle-orm";
import { db } from "../../db/client.js";
import { researchReports } from "../../db/schema.js";

export async function writeResearchReport(
  reportType: string,
  title: string,
  content: string,
  symbolsAnalyzed: string[] | null = null,
  keyFindings: Record<string, unknown> | null = null,
  sessionId = "",
): Promise<Record<string, unknown>> {
  const [report] = await db
    .insert(researchReports)
    .values({
      reportType,
      title,
      content,
      symbolsAnalyzed: symbolsAnalyzed ?? [],
      keyFindings: keyFindings ?? {},
      sessionId,
    })
    .returning();

  return {
    id: report.id,
    report_type: report.reportType,
    title: report.title,
    created_at: report.createdAt?.toISOString(),
  };
}

export async function getRecentReports(
  reportType: string | null = null,
  limit = 10,
): Promise<Record<string, unknown>> {
  let query = db
    .select()
    .from(researchReports)
    .orderBy(desc(researchReports.createdAt))
    .limit(limit);

  if (reportType) {
    query = query.where(
      eq(researchReports.reportType, reportType),
    ) as typeof query;
  }

  const rows = await query;

  return {
    reports: rows.map((r) => ({
      id: r.id,
      report_type: r.reportType,
      title: r.title,
      symbols_analyzed: r.symbolsAnalyzed,
      key_findings: r.keyFindings,
      created_at: r.createdAt?.toISOString(),
      content_preview: r.content.slice(0, 300),
    })),
    count: rows.length,
  };
}
