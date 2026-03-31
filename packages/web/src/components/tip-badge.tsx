import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface TipBadgeProps extends BadgeProps {
  tip?: string;
}

export function TipBadge({ tip, children, ...props }: TipBadgeProps) {
  if (!tip) return <Badge {...props}>{children}</Badge>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge {...props} className={`cursor-help ${props.className ?? ""}`}>
          {children}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="max-w-xs text-xs">{tip}</p>
      </TooltipContent>
    </Tooltip>
  );
}
