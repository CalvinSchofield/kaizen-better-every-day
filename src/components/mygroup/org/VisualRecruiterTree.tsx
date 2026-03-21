import { useMemo, useCallback, useRef, useState } from "react";
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
  children: TreeNode[];
}

interface PositionedNode {
  id: string;
  name: string;
  userId: string | null;
  stage: string | null;
  profilePhotoUrl?: string | null;
  x: number;
  y: number;
  childCount: number;
}

interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// ── Layout Constants ───────────────────────────────────

const NODE_RADIUS = 26;
const NODE_DIAMETER = NODE_RADIUS * 2;
const H_GAP = 18;
const V_GAP = 90;
const LABEL_HEIGHT = 34;
const NODE_TOTAL_H = NODE_DIAMETER + LABEL_HEIGHT;

// ── Layout Algorithm ───────────────────────────────────

function computeSubtreeWidth(node: TreeNode): number {
  if (node.children.length === 0) return NODE_DIAMETER;
  const childrenWidth = node.children.reduce(
    (sum, child) => sum + computeSubtreeWidth(child),
    0
  );
  return Math.max(
    NODE_DIAMETER,
    childrenWidth + (node.children.length - 1) * H_GAP
  );
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
    x: cx,
    y: cy,
    childCount: node.children.length,
  });

  if (node.children.length === 0) return;

  // Position children
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
    childOffset += childW + H_GAP;
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
    offset += w + H_GAP * 3;
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
  if (s.includes("5+")) return "border-purple-500 ring-2 ring-purple-200";
  if (s.includes("sold")) return "border-green-500 ring-2 ring-green-200";
  if (s.includes("shadow")) return "border-blue-500 ring-2 ring-blue-200";
  if (s.includes("signed")) return "border-amber-500 ring-2 ring-amber-200";
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

  const PADDING = 40;
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
      {/* Zoom controls */}
      <TransformWrapper
        initialScale={Math.min(1, 380 / svgWidth)}
        minScale={0.15}
        maxScale={2}
        centerOnInit
        limitToBounds={false}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <div className="absolute top-2 right-2 z-10 flex gap-1">
              <Button
                variant="secondary"
                size="icon"
                className="h-7 w-7 shadow-sm"
                onClick={() => zoomIn()}
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="h-7 w-7 shadow-sm"
                onClick={() => zoomOut()}
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="h-7 w-7 shadow-sm"
                onClick={() => resetTransform()}
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            <TransformComponent
              wrapperStyle={{ width: "100%", height: "60vh", minHeight: 300 }}
            >
              <div
                style={{ width: svgWidth, height: svgHeight, position: "relative" }}
              >
                {/* SVG lines */}
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

                  return (
                    <div
                      key={node.id}
                      className="absolute flex flex-col items-center cursor-pointer group"
                      style={{
                        left: node.x + PADDING - NODE_RADIUS,
                        top: node.y + PADDING - NODE_RADIUS,
                        width: NODE_DIAMETER,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNodeClick(node);
                      }}
                    >
                      <div
                        className={cn(
                          "rounded-full border-2 transition-all duration-200",
                          getStageRing(node.stage),
                          isSelected &&
                            "!border-primary !ring-4 !ring-primary/20 scale-110",
                          isGhost && "opacity-70"
                        )}
                      >
                        <Avatar
                          className={cn(
                            "h-[48px] w-[48px]",
                            getStageColor(node.stage)
                          )}
                        >
                          <AvatarImage src={node.profilePhotoUrl || undefined} />
                          <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                      </div>

                      {/* Name label */}
                      <span
                        className={cn(
                          "text-[10px] leading-tight text-center font-medium mt-1 max-w-[72px] truncate",
                          isSelected ? "text-primary" : "text-foreground"
                        )}
                      >
                        {cleanName.split(" ")[0]}
                      </span>
                      <span className="text-[9px] text-muted-foreground leading-tight truncate max-w-[72px]">
                        {cleanName.split(" ").slice(1).join(" ")}
                      </span>

                      {/* Child count badge */}
                      {node.childCount > 0 && (
                        <Badge
                          variant="secondary"
                          className="absolute -bottom-1 -right-2 h-4 min-w-4 px-1 text-[9px] font-bold"
                        >
                          {node.childCount}
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
