import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const categoryColors: Record<string, string> = {
  positive: "text-green-600 bg-green-50 border-green-200",
  negative: "text-red-600 bg-red-50 border-red-200",
  neutral: "text-gray-600 bg-gray-50 border-gray-200",
};

export function Lessons() {
  const lessonList = trpc.lessons.list.useQuery({ limit: 50 });
  const accuracy = trpc.lessons.signalAccuracy.useQuery({ days: 30 });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Lessons & Signal Accuracy</h1>

      {/* Signal Accuracy */}
      <Card>
        <CardHeader>
          <CardTitle>Signal Accuracy (30 days)</CardTitle>
          <CardDescription>
            {accuracy.data?.total ?? 0} signals evaluated
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6">
            <div>
              <p className="text-3xl font-bold">
                {accuracy.data?.total
                  ? `${(accuracy.data.accuracy * 100).toFixed(1)}%`
                  : "—"}
              </p>
              <p className="text-sm text-muted-foreground">Overall</p>
            </div>
            {accuracy.data?.byType &&
              Object.entries(accuracy.data.byType).map(([type, data]) => (
                <div key={type}>
                  <p className="text-xl font-bold">
                    {(data.accuracy * 100).toFixed(1)}%
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {type} ({data.correct}/{data.total})
                  </p>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Lessons */}
      <div className="space-y-3">
        {lessonList.data?.map((l) => (
          <Card
            key={l.id}
            className={`border ${categoryColors[l.category] ?? ""}`}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge variant="outline">{l.lessonType}</Badge>
                    <Badge
                      variant={
                        l.category === "positive"
                          ? "default"
                          : l.category === "negative"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {l.category}
                    </Badge>
                    {l.symbol && (
                      <Badge variant="outline" className="font-mono">
                        {l.symbol}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm">{l.description}</p>
                </div>
                <div className="ml-4 text-right text-xs text-muted-foreground">
                  <p>conf: {(l.confidence ?? 0).toFixed(2)}</p>
                  <p>seen: {l.observationCount}x</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {lessonList.data?.length === 0 && (
          <p className="text-center text-muted-foreground">
            No lessons recorded yet
          </p>
        )}
      </div>
    </div>
  );
}
