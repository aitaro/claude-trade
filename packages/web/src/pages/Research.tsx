import { useState } from "react";
import { useParams } from "react-router-dom";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export function Research() {
  const { id } = useParams();
  const [selectedId, setSelectedId] = useState<string | null>(id ?? null);
  const reports = trpc.research.list.useQuery({ limit: 30 });
  const detail = trpc.research.getById.useQuery(
    { id: selectedId! },
    { enabled: !!selectedId },
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Research Reports</h1>

      <div className="grid gap-4 md:grid-cols-3">
        {/* List */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Reports</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              <div className="space-y-1 p-2">
                {reports.data?.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={`w-full rounded-md border p-2 text-left transition-colors ${
                      selectedId === r.id
                        ? "border-primary bg-accent"
                        : "hover:bg-accent/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {r.reportType}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {r.createdAt
                          ? new Date(r.createdAt).toLocaleDateString()
                          : ""}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium leading-tight">
                      {r.title}
                    </p>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Detail */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{detail.data?.title ?? "Select a report"}</CardTitle>
            {detail.data && (
              <CardDescription>
                <Badge variant="outline">{detail.data.reportType}</Badge>{" "}
                {detail.data.createdAt
                  ? new Date(detail.data.createdAt).toLocaleString()
                  : ""}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {detail.data ? (
              <ScrollArea className="h-[500px]">
                <article className="prose prose-sm max-w-none prose-headings:font-bold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:my-2 prose-ul:my-1 prose-li:my-0.5 prose-strong:text-foreground">
                  <Markdown remarkPlugins={[remarkGfm]}>{detail.data.content}</Markdown>
                </article>
              </ScrollArea>
            ) : (
              <p className="text-muted-foreground">
                Select a report from the list
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
