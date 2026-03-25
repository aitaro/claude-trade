import { trpc } from "@/lib/trpc";
import { formatDateTime } from "@/lib/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function Dashboard() {
  const snapshot = trpc.performance.latestSnapshot.useQuery();
  const signalStats = trpc.signals.stats.useQuery();
  const perfSummary = trpc.performance.summary.useQuery();
  const sessions = trpc.sessions.list.useQuery({ limit: 10 });
  const recentSignals = trpc.signals.list.useQuery({
    activeOnly: true,
    limit: 10,
  });

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
                    <Badge
                      variant={
                        s.signalType === "buy"
                          ? "default"
                          : s.signalType === "sell"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {s.signalType}
                    </Badge>
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
                    <Badge variant="outline">{s.sessionType}</Badge>
                    <Badge
                      variant={
                        s.status === "completed"
                          ? "default"
                          : s.status === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {s.status}
                    </Badge>
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
