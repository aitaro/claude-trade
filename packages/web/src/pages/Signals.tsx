import { TipBadge } from "@/components/tip-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { SIGNAL_TYPE_LABELS } from "@/lib/labels";
import { trpc } from "@/lib/trpc";
import { useState } from "react";

export function Signals() {
  const [activeOnly, setActiveOnly] = useState(true);
  const signals = trpc.signals.list.useQuery({ activeOnly, limit: 100 });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Signals</h1>
        <div className="flex gap-2">
          <Button
            variant={activeOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveOnly(true)}
          >
            Active
          </Button>
          <Button
            variant={!activeOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveOnly(false)}
          >
            All
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Strength</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Strategy</TableHead>
                <TableHead>Reasoning</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {signals.data?.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono font-bold">{s.symbol}</TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell>
                    <span className={s.strength > 0 ? "text-green-600" : "text-red-600"}>
                      {s.strength?.toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell>{(s.confidence ?? 0).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{s.sourceStrategy}</Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                    {s.reasoning?.slice(0, 100)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {s.expiresAt ? formatDateTime(s.expiresAt) : ""}
                  </TableCell>
                  <TableCell className="text-xs">
                    {s.createdAt ? formatDateTime(s.createdAt) : ""}
                  </TableCell>
                </TableRow>
              ))}
              {signals.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No signals found
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
