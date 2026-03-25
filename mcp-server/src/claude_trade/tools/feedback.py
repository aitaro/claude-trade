"""フィードバックループ: シグナル評価・学習ツール"""

from datetime import datetime, timedelta

from sqlalchemy import select, func
from sqlmodel import col

from claude_trade.db import async_session
from claude_trade.models import Signal, SignalOutcome, Lesson, Order


async def evaluate_signal(
    signal_id: str,
    price_at_signal: float,
    price_at_eval: float,
    evaluation: str,
    pnl: float | None = None,
) -> dict:
    """シグナルの事後評価を記録する

    Args:
        signal_id: 評価するシグナルの ID
        price_at_signal: シグナル発行時の価格
        price_at_eval: 評価時の価格
        evaluation: 事後評価テキスト
        pnl: 実現損益 (取引があった場合)
    """
    async with async_session() as session:
        stmt = select(Signal).where(Signal.id == signal_id)
        result = await session.execute(stmt)
        signal = result.scalar_one_or_none()

        if not signal:
            return {"error": f"Signal {signal_id} not found"}

        price_change_pct = ((price_at_eval - price_at_signal) / price_at_signal * 100) if price_at_signal > 0 else 0.0

        # 方向が合っていたか判定
        if signal.signal_type == "buy":
            direction_correct = price_change_pct > 0
        elif signal.signal_type == "sell":
            direction_correct = price_change_pct < 0
        elif signal.signal_type == "avoid":
            direction_correct = price_change_pct < 0  # 避けて正解だったか
        else:  # hold
            direction_correct = abs(price_change_pct) < 2.0  # 大きく動かなかったか

        outcome = SignalOutcome(
            signal_id=signal.id,
            symbol=signal.symbol,
            signal_type=signal.signal_type,
            strength=signal.strength,
            confidence=signal.confidence,
            source_strategy=signal.source_strategy,
            price_at_signal=price_at_signal,
            price_at_eval=price_at_eval,
            price_change_pct=round(price_change_pct, 4),
            direction_correct=direction_correct,
            pnl=pnl,
            evaluation=evaluation,
        )

        session.add(outcome)
        await session.commit()
        await session.refresh(outcome)

    return {
        "id": str(outcome.id),
        "symbol": outcome.symbol,
        "signal_type": outcome.signal_type,
        "direction_correct": direction_correct,
        "price_change_pct": outcome.price_change_pct,
        "evaluation": evaluation[:200],
    }


async def record_lesson(
    lesson_type: str,
    category: str,
    description: str,
    symbol: str | None = None,
    source_strategy: str | None = None,
    evidence: dict | None = None,
    ttl_days: int = 30,
) -> dict:
    """学びを記録する。類似の既存 lesson があれば observation_count を増やす

    Args:
        lesson_type: "signal_accuracy", "market_pattern", "risk", "strategy", "info_source"
        category: "positive", "negative", "neutral"
        description: 学びの内容
        symbol: 特定銘柄に紐づく場合
        source_strategy: マーケットID (us, jp, eu, uk)
        evidence: 根拠データ (JSON)
        ttl_days: 有効期間（日数、デフォルト30日）
    """
    async with async_session() as session:
        # 類似の既存 lesson を検索
        stmt = (
            select(Lesson)
            .where(Lesson.lesson_type == lesson_type)
            .where(Lesson.is_active == True)  # noqa: E712
            .where(Lesson.description == description)
        )
        if symbol:
            stmt = stmt.where(Lesson.symbol == symbol.upper())

        result = await session.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            existing.observation_count += 1
            existing.confidence = min(1.0, existing.confidence + 0.1)
            existing.updated_at = datetime.utcnow()
            existing.expires_at = datetime.utcnow() + timedelta(days=ttl_days)
            if evidence:
                existing.evidence = evidence
            await session.commit()
            await session.refresh(existing)
            return {
                "id": str(existing.id),
                "action": "updated",
                "observation_count": existing.observation_count,
                "confidence": existing.confidence,
                "description": existing.description[:200],
            }

        lesson = Lesson(
            lesson_type=lesson_type,
            category=category,
            description=description,
            symbol=symbol.upper() if symbol else None,
            source_strategy=source_strategy,
            evidence=evidence or {},
            confidence=0.5,
            expires_at=datetime.utcnow() + timedelta(days=ttl_days),
        )
        session.add(lesson)
        await session.commit()
        await session.refresh(lesson)

    return {
        "id": str(lesson.id),
        "action": "created",
        "observation_count": 1,
        "confidence": lesson.confidence,
        "description": lesson.description[:200],
    }


async def get_relevant_lessons(
    symbol: str | None = None,
    source_strategy: str | None = None,
    lesson_type: str | None = None,
    limit: int = 20,
) -> dict:
    """関連する学びを取得する（Research Agent のプロンプトに注入用）

    Args:
        symbol: 特定銘柄に絞る場合
        source_strategy: マーケットID でフィルタ
        lesson_type: タイプでフィルタ
        limit: 取得件数
    """
    now = datetime.utcnow()
    async with async_session() as session:
        stmt = (
            select(Lesson)
            .where(Lesson.is_active == True)  # noqa: E712
            .where((Lesson.expires_at == None) | (col(Lesson.expires_at) > now))  # noqa: E711
            .order_by(Lesson.confidence.desc(), Lesson.observation_count.desc())
            .limit(limit)
        )
        if symbol:
            # 銘柄固有 + 汎用(symbol=None) の両方を取得
            stmt = stmt.where((Lesson.symbol == symbol.upper()) | (Lesson.symbol == None))  # noqa: E711
        if source_strategy:
            stmt = stmt.where(
                (Lesson.source_strategy == source_strategy) | (Lesson.source_strategy == None)  # noqa: E711
            )
        if lesson_type:
            stmt = stmt.where(Lesson.lesson_type == lesson_type)

        result = await session.execute(stmt)
        lessons = result.scalars().all()

    return {
        "lessons": [
            {
                "id": str(l.id),
                "lesson_type": l.lesson_type,
                "category": l.category,
                "symbol": l.symbol,
                "description": l.description,
                "confidence": l.confidence,
                "observation_count": l.observation_count,
                "source_strategy": l.source_strategy,
                "updated_at": l.updated_at.isoformat(),
            }
            for l in lessons
        ],
        "count": len(lessons),
    }


async def get_signal_accuracy(
    source_strategy: str | None = None,
    days: int = 30,
) -> dict:
    """シグナル精度のサマリーを取得する

    Args:
        source_strategy: マーケットID でフィルタ
        days: 過去何日分を集計するか
    """
    cutoff = datetime.utcnow() - timedelta(days=days)
    async with async_session() as session:
        stmt = select(SignalOutcome).where(SignalOutcome.evaluated_at > cutoff)
        if source_strategy:
            stmt = stmt.where(SignalOutcome.source_strategy == source_strategy)

        result = await session.execute(stmt)
        outcomes = result.scalars().all()

    if not outcomes:
        return {"message": "No signal outcomes found", "accuracy": {}}

    total = len(outcomes)
    correct = sum(1 for o in outcomes if o.direction_correct)
    by_type = {}
    for o in outcomes:
        t = o.signal_type
        if t not in by_type:
            by_type[t] = {"total": 0, "correct": 0}
        by_type[t]["total"] += 1
        if o.direction_correct:
            by_type[t]["correct"] += 1

    for t in by_type:
        by_type[t]["accuracy"] = round(by_type[t]["correct"] / by_type[t]["total"], 4) if by_type[t]["total"] > 0 else 0.0

    avg_confidence = sum(o.confidence for o in outcomes) / total
    avg_price_change = sum(abs(o.price_change_pct or 0) for o in outcomes) / total

    return {
        "period_days": days,
        "total_signals": total,
        "overall_accuracy": round(correct / total, 4),
        "avg_confidence": round(avg_confidence, 4),
        "avg_abs_price_change_pct": round(avg_price_change, 4),
        "by_type": by_type,
    }
