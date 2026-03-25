import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function Performance() {
  const summary = trpc.performance.summary.useQuery();
  const daily = trpc.performance.daily.useQuery({ limit: 30 });
  const snapshot = trpc.performance.latestSnapshot.useQuery();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Performance</h1>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total PnL</CardDescription>
            <CardTitle
              className={`text-2xl ${(summary.data?.totalPnl ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              ¥{(summary.data?.totalPnl ?? 0).toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Daily Return</CardDescription>
            <CardTitle className="text-2xl">
              {((summary.data?.avgDailyReturn ?? 0) * 100).toFixed(2)}%
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Max Drawdown</CardDescription>
            <CardTitle className="text-2xl text-red-600">
              {((summary.data?.maxDrawdown ?? 0) * 100).toFixed(2)}%
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Positions */}
      {snapshot.data?.positions && snapshot.data.positions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Current Positions</CardTitle>
            <CardDescription>
              Latest snapshot
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Avg Cost</TableHead>
                  <TableHead>Market Price</TableHead>
                  <TableHead>Market Value</TableHead>
                  <TableHead>Unrealized PnL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshot.data.positions.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono font-bold">
                      {p.symbol}
                    </TableCell>
                    <TableCell>{p.quantity}</TableCell>
                    <TableCell>{p.avgCost?.toFixed(2)}</TableCell>
                    <TableCell>{p.marketPrice?.toFixed(2)}</TableCell>
                    <TableCell>
                      ¥{p.marketValue?.toLocaleString()}
                    </TableCell>
                    <TableCell
                      className={
                        (p.unrealizedPnl ?? 0) >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }
                    >
                      ¥{p.unrealizedPnl?.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Daily Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Performance</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Starting NAV</TableHead>
                <TableHead>Ending NAV</TableHead>
                <TableHead>PnL</TableHead>
                <TableHead>PnL %</TableHead>
                <TableHead>Trades</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {daily.data?.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono">{d.date}</TableCell>
                  <TableCell>¥{d.startingNav?.toLocaleString()}</TableCell>
                  <TableCell>¥{d.endingNav?.toLocaleString()}</TableCell>
                  <TableCell
                    className={
                      d.pnl >= 0 ? "text-green-600" : "text-red-600"
                    }
                  >
                    ¥{d.pnl?.toLocaleString()}
                  </TableCell>
                  <TableCell
                    className={
                      d.pnlPct >= 0 ? "text-green-600" : "text-red-600"
                    }
                  >
                    {d.pnlPct?.toFixed(2)}%
                  </TableCell>
                  <TableCell>{d.tradesCount}</TableCell>
                </TableRow>
              ))}
              {daily.data?.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    No performance data yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
