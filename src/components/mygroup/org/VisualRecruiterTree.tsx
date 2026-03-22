import { useMemo, useCallback } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { getCleanName, getInitials } from "@/utils/nameUtils";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────

export interface TreeNode {
  id: string;
  name: string;
  userId: string | null;
  stage: string | null;
  profilePhotoUrl?: string | null;
  role?: string | null;
  year?: string | null;
  groupName?: string | null;
  teamName?: string | null;
  children: TreeNode[];
}

interface PositionedNode {
  id: string;
  name: string;
  userId: string | null;
  stage: string | null;
  profilePhotoUrl?: string | null;
  role?: string | null;
  year?: string | null;
  groupName?: string | null;
  teamName?: string | null;
  x: number;
  y: number;
  childCount: number;
  totalDescendants: number;
}

interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// ── Layout Constants ───────────────────────────────────

const NODE_RADIUS = 30;
const NODE_DIAMETER = NODE_RADIUS * 2;
const H_GAP = 24;
const V_GAP = 80;
const LABEL_HEIGHT = 48;
const NODE_TOTAL_H = NODE_DIAMETER + LABEL_HEIGHT;

// ── Helpers ────────────────────────────────────────────

function countDescendants(node: TreeNode): number {
  let count = node.children.length;
  for (const child of node.children) {
    count += countDescendants(child);
  }
  return count;
}

// ── Layout Algorithm ───────────────────────────────────

function computeSubtreeWidth(node: TreeNode): number {
  if (node.children.length === 0) return NODE_DIAMETER + H_GAP;
  const childrenWidth = node.children.reduce(
    (sum, child) => sum + computeSubtreeWidth(child),
    0
  );
  return Math.max(NODE_DIAMETER + H_GAP, childrenWidth);
}

function layoutNodes(
  node: TreeNode,
  depth: number,
  offsetX: number,
  nodes: PositionedNode[],
  lines: Line[]
): void {
  const subtreeW = computeSubtreeWidth(node);
  const cx = offsetX + subtreeW / 2;
  const cy = depth * (NODE_TOTAL_H + V_GAP) + NODE_RADIUS;

  nodes.push({
    id: node.id,
    name: node.name,
    userId: node.userId,
    stage: node.stage,
    profilePhotoUrl: node.profilePhotoUrl,
    role: node.role,
    year: node.year,
    x: cx,
    y: cy,
    childCount: node.children.length,
    totalDescendants: countDescendants(node),
  });

  if (node.children.length === 0) return;

  let childOffset = offsetX;
  const childY = (depth + 1) * (NODE_TOTAL_H + V_GAP) + NODE_RADIUS;
  const junctionY = cy + NODE_RADIUS + (V_GAP + LABEL_HEIGHT) / 2;

  // Vertical line from parent down to junction
  lines.push({ x1: cx, y1: cy + NODE_RADIUS, x2: cx, y2: junctionY });

  const childPositions: number[] = [];

  node.children.forEach((child) => {
    const childW = computeSubtreeWidth(child);
    const childCx = childOffset + childW / 2;
    childPositions.push(childCx);

    // Vertical line from junction down to child
    lines.push({ x1: childCx, y1: junctionY, x2: childCx, y2: childY - NODE_RADIUS });

    layoutNodes(child, depth + 1, childOffset, nodes, lines);
    childOffset += childW;
  });

  // Horizontal line across junction
  if (childPositions.length > 1) {
    const leftmost = Math.min(...childPositions);
    const rightmost = Math.max(...childPositions);
    lines.push({ x1: leftmost, y1: junctionY, x2: rightmost, y2: junctionY });
  }
}

function layoutForest(roots: TreeNode[]) {
  const nodes: PositionedNode[] = [];
  const lines: Line[] = [];
  let offset = 0;

  roots.forEach((root) => {
    const w = computeSubtreeWidth(root);
    layoutNodes(root, 0, offset, nodes, lines);
    offset += w + H_GAP * 2;
  });

  const totalWidth = offset;
  const maxDepth = nodes.reduce((max, n) => Math.max(max, n.y), 0);
  const totalHeight = maxDepth + NODE_RADIUS + LABEL_HEIGHT + 40;

  return { nodes, lines, totalWidth, totalHeight };
}

// ── Stage Colors ───────────────────────────────────────

function getStageRing(stage: string | null): string {
  if (!stage) return "border-border";
  const s = stage.toLowerCase();
  if (s.includes("5+")) return "border-purple-500 ring-2 ring-purple-300/40";
  if (s.includes("sold")) return "border-green-500 ring-2 ring-green-300/40";
  if (s.includes("shadow")) return "border-blue-500 ring-2 ring-blue-300/40";
  if (s.includes("signed")) return "border-amber-500 ring-2 ring-amber-300/40";
  if (s.includes("evaluating")) return "border-slate-400";
  return "border-border";
}

function getStageColor(stage: string | null): string {
  if (!stage) return "bg-muted";
  const s = stage.toLowerCase();
  if (s.includes("5+")) return "bg-purple-50 dark:bg-purple-950/30";
  if (s.includes("sold")) return "bg-green-50 dark:bg-green-950/30";
  if (s.includes("shadow")) return "bg-blue-50 dark:bg-blue-950/30";
  if (s.includes("signed")) return "bg-amber-50 dark:bg-amber-950/30";
  return "bg-card";
}

// ── Component ──────────────────────────────────────────

interface VisualRecruiterTreeProps {
  roots: TreeNode[];
  selectedNodeId: string | null;
  onSelectNode: (node: PositionedNode | null) => void;
}

export const VisualRecruiterTree = ({
  roots,
  selectedNodeId,
  onSelectNode,
}: VisualRecruiterTreeProps) => {
  const { nodes, lines, totalWidth, totalHeight } = useMemo(
    () => layoutForest(roots),
    [roots]
  );

  const PADDING = 60;
  const svgWidth = totalWidth + PADDING * 2;
  const svgHeight = totalHeight + PADDING * 2;

  const handleNodeClick = useCallback(
    (node: PositionedNode) => {
      if (selectedNodeId === node.id) {
        onSelectNode(null);
      } else {
        onSelectNode(node);
      }
    },
    [selectedNodeId, onSelectNode]
  );

  if (roots.length === 0) return null;

  return (
    <div className="relative rounded-xl border bg-card overflow-hidden">
      <TransformWrapper
        initialScale={Math.min(1, 380 / svgWidth)}
        minScale={0.1}
        maxScale={2.5}
        centerOnInit
        limitToBounds={false}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <div className="absolute top-2 right-2 z-10 flex gap-1">
              <Button variant="secondary" size="icon" className="h-7 w-7 shadow-sm" onClick={() => zoomIn()}>
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <Button variant="secondary" size="icon" className="h-7 w-7 shadow-sm" onClick={() => zoomOut()}>
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <Button variant="secondary" size="icon" className="h-7 w-7 shadow-sm" onClick={() => resetTransform()}>
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            <TransformComponent
              wrapperStyle={{ width: "100%", height: "70vh", minHeight: 350 }}
            >
              <div style={{ width: svgWidth, height: svgHeight, position: "relative" }}>
                {/* SVG connector lines */}
                <svg
                  width={svgWidth}
                  height={svgHeight}
                  className="absolute inset-0"
                  style={{ pointerEvents: "none" }}
                >
                  {lines.map((line, i) => (
                    <line
                      key={i}
                      x1={line.x1 + PADDING}
                      y1={line.y1 + PADDING}
                      x2={line.x2 + PADDING}
                      y2={line.y2 + PADDING}
                      className="stroke-border"
                      strokeWidth={1.5}
                    />
                  ))}
                </svg>

                {/* Nodes */}
                {nodes.map((node) => {
                  const cleanName = getCleanName(node.name);
                  const initials = getInitials(cleanName);
                  const isSelected = selectedNodeId === node.id;
                  const isGhost = !node.userId;
                  const firstName = cleanName.split(" ")[0];
                  const lastName = cleanName.split(" ").slice(1).join(" ");

                  return (
                    <div
                      key={node.id}
                      className="absolute flex flex-col items-center cursor-pointer group"
                      style={{
                        left: node.x + PADDING - NODE_RADIUS - 16,
                        top: node.y + PADDING - NODE_RADIUS,
                        width: NODE_DIAMETER + 32,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNodeClick(node);
                      }}
                    >
                      {/* Avatar circle */}
                      <div
                        className={cn(
                          "rounded-full border-[2.5px] transition-all duration-200 shadow-sm",
                          getStageRing(node.stage),
                          isSelected && "!border-primary !ring-4 !ring-primary/20 scale-110",
                          isGhost && "opacity-60"
                        )}
                      >
                        <Avatar className={cn("h-[56px] w-[56px]", getStageColor(node.stage))}>
                          <AvatarImage src={node.profilePhotoUrl || undefined} />
                          <AvatarFallback className="text-sm font-bold bg-primary/10 text-primary">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                      </div>

                      {/* Name */}
                      <span
                        className={cn(
                          "text-[11px] leading-tight text-center font-semibold mt-1.5 max-w-[92px] truncate",
                          isSelected ? "text-primary" : "text-foreground"
                        )}
                      >
                        {firstName}
                      </span>
                      {lastName && (
                        <span className="text-[10px] text-muted-foreground leading-tight truncate max-w-[92px]">
                          {lastName}
                        </span>
                      )}

                      {/* Role/Title badge */}
                      {node.role && (
                        <span className="text-[9px] text-primary/80 font-medium leading-tight mt-0.5 truncate max-w-[92px] italic">
                          {node.role}
                        </span>
                      )}

                      {/* Year */}
                      {node.year && (
                        <span className="text-[9px] text-muted-foreground leading-tight truncate max-w-[92px]">
                          {node.year}
                        </span>
                      )}

                      {/* Total downline count badge */}
                      {node.totalDescendants > 0 && (
                        <Badge
                          variant="secondary"
                          className="absolute -bottom-1 -right-1 h-4 min-w-4 px-1 text-[9px] font-bold"
                        >
                          {node.totalDescendants}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>
  );
};
