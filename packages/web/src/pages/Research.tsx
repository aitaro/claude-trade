import { useState } from "react";
import { useParams } from "react-router-dom";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { trpc } from "@/lib/trpc";
import { formatDate, formatDateTime } from "@/lib/format";
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
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4">
      <h1 className="text-2xl font-bold shrink-0">Research Reports</h1>

      <div className="flex gap-4 min-h-0 flex-1">
        {/* List - narrow sidebar */}
        <ScrollArea className="w-72 shrink-0 rounded-lg border">
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
                  <Badge variant="outline" className="text-xs shrink-0">
                    {r.reportType}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {r.createdAt ? formatDate(r.createdAt) : ""}
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium leading-tight line-clamp-2">
                  {r.title}
                </p>
              </button>
            ))}
          </div>
        </ScrollArea>

        {/* Detail - takes remaining space */}
        <ScrollArea className="flex-1 rounded-lg border">
          {detail.data ? (
            <div className="p-6">
              <div className="mb-4">
                <h2 className="text-xl font-bold">{detail.data.title}</h2>
                <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="outline">{detail.data.reportType}</Badge>
                  {detail.data.createdAt
                    ? formatDateTime(detail.data.createdAt)
                    : ""}
                </div>
              </div>
              <article className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-bold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:my-2 prose-ul:my-1 prose-li:my-0.5 prose-strong:text-foreground prose-table:text-sm prose-th:border prose-th:border-border prose-th:bg-muted prose-th:px-3 prose-th:py-1.5 prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-1.5">
                <Markdown remarkPlugins={[remarkGfm]}>
                  {detail.data.content}
                </Markdown>
              </article>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Select a report from the list
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
