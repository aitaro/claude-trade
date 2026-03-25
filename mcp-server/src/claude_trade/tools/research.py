"""リサーチレポート保存ツール"""

from sqlalchemy import select

from claude_trade.db import async_session
from claude_trade.models import ResearchReport


async def write_research_report(
    report_type: str,
    title: str,
    content: str,
    symbols_analyzed: list[str] | None = None,
    key_findings: dict | None = None,
    session_id: str = "",
) -> dict:
    """リサーチレポートを DB に保存する

    Args:
        report_type: "premarket", "intraday", "eod", "sector", "macro"
        title: レポートタイトル
        content: マークダウン形式のレポート本文
        symbols_analyzed: 分析した銘柄リスト
        key_findings: 主要な発見事項 (JSON)
        session_id: Claude セッション ID
    """
    report = ResearchReport(
        report_type=report_type,
        title=title,
        content=content,
        symbols_analyzed=symbols_analyzed or [],
        key_findings=key_findings or {},
        session_id=session_id,
    )

    async with async_session() as session:
        session.add(report)
        await session.commit()
        await session.refresh(report)

    return {
        "id": str(report.id),
        "report_type": report.report_type,
        "title": report.title,
        "created_at": report.created_at.isoformat(),
    }


async def get_recent_reports(
    report_type: str | None = None,
    limit: int = 10,
) -> dict:
    """最近のリサーチレポートを取得する

    Args:
        report_type: レポートタイプでフィルタ (省略で全タイプ)
        limit: 取得件数 (デフォルト 10)
    """
    async with async_session() as session:
        stmt = select(ResearchReport).order_by(ResearchReport.created_at.desc()).limit(limit)
        if report_type:
            stmt = stmt.where(ResearchReport.report_type == report_type)

        result = await session.execute(stmt)
        reports = result.scalars().all()

    return {
        "reports": [
            {
                "id": str(r.id),
                "report_type": r.report_type,
                "title": r.title,
                "symbols_analyzed": r.symbols_analyzed,
                "key_findings": r.key_findings,
                "created_at": r.created_at.isoformat(),
                "content_preview": r.content[:300],
            }
            for r in reports
        ],
        "count": len(reports),
    }
