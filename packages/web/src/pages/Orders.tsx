import { trpc } from "@/lib/trpc";
import { formatDateTime } from "@/lib/format";
import { TipBadge } from "@/components/tip-badge";
import {
  ORDER_STATUS_LABELS,
  ORDER_SIDE_LABELS,
  DECISION_ACTION_LABELS,
} from "@/lib/labels";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function Orders() {
  const orderList = trpc.orders.list.useQuery({ limit: 50 });
  const decisionList = trpc.orders.decisions.useQuery({ limit: 50 });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Orders & Decisions</h1>

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="decisions">Decisions</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Side</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Fill Price</TableHead>
                    <TableHead>IB Order ID</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderList.data?.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono font-bold">
                        {o.symbol}
                      </TableCell>
                      <TableCell>
                        <TipBadge
                          tip={ORDER_SIDE_LABELS[o.side]}
                          variant={
                            o.side === "BUY" ? "default" : "destructive"
                          }
                        >
                          {o.side}
                        </TipBadge>
                      </TableCell>
                      <TableCell>{o.quantity}</TableCell>
                      <TableCell>{o.orderType}</TableCell>
                      <TableCell>
                        <TipBadge
                          tip={ORDER_STATUS_LABELS[o.status ?? ""]}
                          variant={
                            o.status === "filled"
                              ? "default"
                              : o.status === "rejected"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {o.status}
                        </TipBadge>
                      </TableCell>
                      <TableCell>
                        {o.fillPrice?.toFixed(2) ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {o.ibOrderId ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {o.createdAt
                          ? formatDateTime(o.createdAt)
                          : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="decisions">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Approved</TableHead>
                    <TableHead>Risk Checks</TableHead>
                    <TableHead>Reasoning</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {decisionList.data?.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono font-bold">
                        {d.symbol}
                      </TableCell>
                      <TableCell>
                        <TipBadge tip={DECISION_ACTION_LABELS[d.action]} variant="outline">{d.action}</TipBadge>
                      </TableCell>
                      <TableCell>{d.targetQuantity}</TableCell>
                      <TableCell>
                        <TipBadge
                          tip={d.approved ? "リスクチェック全項目パス。発注実行" : "リスクチェック不合格。発注拒否"}
                          variant={d.approved ? "default" : "destructive"}
                        >
                          {d.approved ? "Yes" : "No"}
                        </TipBadge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {(() => {
                          const checks = d.riskChecks as Record<string, boolean> | null;
                          if (!checks || typeof checks !== "object") return null;
                          return Object.entries(checks).map(([k, v]) => (
                            <span
                              key={k}
                              className={`mr-1 ${v ? "text-green-600" : "text-red-600"}`}
                            >
                              {k}: {v ? "✓" : "✗"}
                            </span>
                          ));
                        })()}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {(d.reasoning ?? "").slice(0, 80)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {d.createdAt
                          ? formatDateTime(d.createdAt)
                          : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
