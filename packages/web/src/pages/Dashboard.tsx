import { trpc } from "@/lib/trpc";
import { formatDateTime, formatTimeJST } from "@/lib/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TipBadge } from "@/components/tip-badge";
import {
  SIGNAL_TYPE_LABELS,
  SESSION_MODE_LABELS,
  SESSION_STATUS_LABELS,
} from "@/lib/labels";

export function Dashboard() {
  const snapshot = trpc.performance.latestSnapshot.useQuery();
  const signalStats = trpc.signals.stats.useQuery();
  const perfSummary = trpc.performance.summary.useQuery();
  const sessions = trpc.sessions.list.useQuery({ limit: 10 });
  const recentSignals = trpc.signals.list.useQuery({
    activeOnly: true,
    limit: 10,
  });
  const markets = trpc.markets.status.useQuery();
  const schedule = trpc.markets.schedule.useQuery();

  const nav = snapshot.data?.account?.netLiquidation;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>NAV</CardDescription>
            <CardTitle className="text-2xl">
              {nav ? `¥${nav.toLocaleString()}` : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {snapshot.data?.account?.capturedAt
                ? `Last: ${formatDateTime(snapshot.data.account.capturedAt)}`
                : "No snapshot yet"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total PnL</CardDescription>
            <CardTitle
              className={`text-2xl ${(perfSummary.data?.totalPnl ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {perfSummary.data
                ? `¥${perfSummary.data.totalPnl.toLocaleString()}`
                : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {perfSummary.data?.tradingDays ?? 0} trading days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Signals</CardDescription>
            <CardTitle className="text-2xl">
              {signalStats.data?.active ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-1">
              {signalStats.data?.byType &&
                Object.entries(signalStats.data.byType).map(([type, count]) => (
                  <Badge key={type} variant="secondary" className="text-xs">
                    {type}: {count}
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Win Rate</CardDescription>
            <CardTitle className="text-2xl">
              {perfSummary.data
                ? `${(perfSummary.data.winRate * 100).toFixed(1)}%`
                : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {perfSummary.data?.totalTrades ?? 0} total trades
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Market Status */}
      <Card>
        <CardHeader>
          <CardTitle>Markets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            {markets.data?.map((m) => (
              <div
                key={m.marketId}
                className={`rounded-lg border p-3 ${m.isOpen ? "border-green-300 bg-green-50" : "border-border"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">{m.marketId.toUpperCase()}</span>
                  <Badge variant={m.isOpen ? "default" : "secondary"}>
                    {m.isOpen ? "OPEN" : "CLOSED"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{m.name}</p>
                <div className="mt-2 text-sm">
                  <span className="font-mono">{m.openTime}</span>
                  <span className="text-muted-foreground"> – </span>
                  <span className="font-mono">{m.closeTime}</span>
                  <span className="text-muted-foreground text-xs"> ({m.currency})</span>
                </div>
                {m.breakTime && (
                  <p className="text-xs text-muted-foreground">Lunch: {m.breakTime}</p>
                )}
                <p className="mt-1 text-xs">
                  Local: <span className="font-mono font-bold">{m.localTime}</span>
                  {!m.isTradingDay && (
                    <span className="ml-1 text-red-500">Holiday</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Schedule</CardTitle>
          <CardDescription>Today's remaining jobs</CardDescription>
        </CardHeader>
        <CardContent>
          {schedule.data?.upcoming.length === 0 && (
            <p className="text-sm text-muted-foreground">No more jobs today</p>
          )}
          <div className="space-y-1">
            {schedule.data?.upcoming.slice(0, 12).map((j, i) => (
              <div
                key={`${j.marketId}-${j.localTime}-${i}`}
                className="flex items-center justify-between rounded-md border px-3 py-1.5"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs w-8 justify-center">
                    {j.marketId.toUpperCase()}
                  </Badge>
                  <TipBadge
                    tip={SESSION_MODE_LABELS[j.mode]}
                    variant={
                      j.mode === "premarket"
                        ? "secondary"
                        : j.mode === "eod"
                          ? "outline"
                          : "default"
                    }
                    className="text-xs"
                  >
                    {j.mode}
                  </TipBadge>
                  <span className="text-sm text-muted-foreground">{j.name}</span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-sm font-bold">
                    {j.nextRunUtc ? formatTimeJST(j.nextRunUtc) : "—"}
                  </span>
                  <span className="ml-2 font-mono text-xs text-muted-foreground">
                    {j.localTime} {j.localTzAbbr}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Active Signals */}
        <Card>
          <CardHeader>
            <CardTitle>Active Signals</CardTitle>
          </CardHeader>
          <CardContent>
            {recentSignals.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No active signals
              </p>
            )}
            <div className="space-y-2">
              {recentSignals.data?.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-md border p-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold">{s.symbol}</span>
                    <TipBadge
                      tip={SIGNAL_TYPE_LABELS[s.signalType]}
                      variant={
                        s.signalType === "buy"
                          ? "default"
                          : s.signalType === "sell"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {s.signalType}
                    </TipBadge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>str: {s.strength?.toFixed(2)}</span>
                    <span>conf: {(s.confidence ?? 0).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Sessions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sessions.data?.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-md border p-2"
                >
                  <div className="flex items-center gap-2">
                    <TipBadge tip={SESSION_MODE_LABELS[s.sessionType]} variant="outline">{s.sessionType}</TipBadge>
                    <TipBadge
                      tip={SESSION_STATUS_LABELS[s.status ?? ""]}
                      variant={
                        s.status === "completed"
                          ? "default"
                          : s.status === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {s.status}
                    </TipBadge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {s.startedAt
                      ? formatDateTime(s.startedAt)
                      : ""}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
