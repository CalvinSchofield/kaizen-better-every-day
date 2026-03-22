import { useMemo, useCallback, useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { getCleanName, getInitials } from "@/utils/nameUtils";
import { YearBadge } from "@/components/leaderboard/YearBadge";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ──────────────────────────────────────────────

export interface TreeNode {
  id: string;
  name: string;
  userId: string | null;
  stage: string | null;
  profilePhotoUrl?: string | null;
  role?: string | null;
  year?: string | null;
  isAreaDirector?: boolean;
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
  isAreaDirector?: boolean;
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

function computeSubtreeWidth(node: TreeNode, collapsedIds: Set<string>): number {
  if (node.children.length === 0 || collapsedIds.has(node.id)) return NODE_DIAMETER + H_GAP;
  const childrenWidth = node.children.reduce(
    (sum, child) => sum + computeSubtreeWidth(child, collapsedIds),
    0
  );
  return Math.max(NODE_DIAMETER + H_GAP, childrenWidth);
}

function layoutNodes(
  node: TreeNode,
  depth: number,
  offsetX: number,
  nodes: PositionedNode[],
  lines: Line[],
  collapsedIds: Set<string>
): void {
  const subtreeW = computeSubtreeWidth(node, collapsedIds);
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
    isAreaDirector: node.isAreaDirector,
    x: cx,
    y: cy,
    childCount: node.children.length,
    totalDescendants: countDescendants(node),
  });

  if (node.children.length === 0 || collapsedIds.has(node.id)) return;

  let childOffset = offsetX;
  const childY = (depth + 1) * (NODE_TOTAL_H + V_GAP) + NODE_RADIUS;
  const junctionY = cy + NODE_RADIUS + (V_GAP + LABEL_HEIGHT) / 2;

  lines.push({ x1: cx, y1: cy + NODE_RADIUS, x2: cx, y2: junctionY });

  const childPositions: number[] = [];

  node.children.forEach((child) => {
    const childW = computeSubtreeWidth(child, collapsedIds);
    const childCx = childOffset + childW / 2;
    childPositions.push(childCx);

    lines.push({ x1: childCx, y1: junctionY, x2: childCx, y2: childY - NODE_RADIUS });

    layoutNodes(child, depth + 1, childOffset, nodes, lines, collapsedIds);
    childOffset += childW;
  });

  if (childPositions.length > 1) {
    const leftmost = Math.min(...childPositions);
    const rightmost = Math.max(...childPositions);
    lines.push({ x1: leftmost, y1: junctionY, x2: rightmost, y2: junctionY });
  }
}

function layoutForest(roots: TreeNode[], collapsedIds: Set<string>) {
  const nodes: PositionedNode[] = [];
  const lines: Line[] = [];
  let offset = 0;

  roots.forEach((root) => {
    const w = computeSubtreeWidth(root, collapsedIds);
    layoutNodes(root, 0, offset, nodes, lines, collapsedIds);
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
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const toggleCollapse = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const { nodes, lines, totalWidth, totalHeight } = useMemo(
    () => layoutForest(roots, collapsedIds),
    [roots, collapsedIds]
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
              <motion.div
                layout
                transition={{ type: "spring", stiffness: 300, damping: 25, mass: 0.8 }}
                style={{ width: svgWidth, height: svgHeight, position: "relative" }}
              >
                {/* SVG connector lines */}
                <motion.svg
                  layout
                  width={svgWidth}
                  height={svgHeight}
                  className="absolute inset-0"
                  style={{ pointerEvents: "none" }}
                  transition={{ type: "spring", stiffness: 300, damping: 25, mass: 0.8 }}
                >
                  <AnimatePresence>
                    {lines.map((line, i) => (
                      <motion.line
                        key={`${line.x1}-${line.y1}-${line.x2}-${line.y2}-${i}`}
                        initial={{ opacity: 0 }}
                        animate={{
                          x1: line.x1 + PADDING,
                          y1: line.y1 + PADDING,
                          x2: line.x2 + PADDING,
                          y2: line.y2 + PADDING,
                          opacity: 1,
                        }}
                        exit={{ opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25, mass: 0.8 }}
                        className="stroke-border"
                        strokeWidth={1.5}
                      />
                    ))}
                  </AnimatePresence>
                </motion.svg>

                {/* Nodes */}
                <AnimatePresence>
                  {nodes.map((node) => {
                    const cleanName = getCleanName(node.name);
                    const initials = getInitials(cleanName);
                    const isSelected = selectedNodeId === node.id;
                    const isGhost = !node.userId;
                    const isCollapsed = collapsedIds.has(node.id);

                    return (
                      <motion.div
                        key={node.id}
                        layout
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25, mass: 0.8 }}
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
                          {cleanName.split(" ")[0]}
                        </span>
                        {cleanName.split(" ").length > 1 && (
                          <span className="text-[10px] text-muted-foreground leading-tight truncate max-w-[92px]">
                            {cleanName.split(" ").slice(1).join(" ")}
                          </span>
                        )}

                        {/* Year badge */}
                        {node.year && (
                          <YearBadge year={node.year} className="mt-0.5 scale-90" />
                        )}

                        {/* Area Director label (only for ADs, shown above org title) */}
                        {node.isAreaDirector && (
                          <span className="text-[9px] text-amber-600 dark:text-amber-400 font-bold leading-tight mt-0.5 truncate max-w-[92px]">
                            Area Director
                          </span>
                        )}

                        {/* Highest org title */}
                        {node.role && (
                          <span className="text-[9px] text-primary/80 font-medium leading-tight mt-0.5 truncate max-w-[92px] italic">
                            {node.role}
                          </span>
                        )}

                        {/* Collapsible descendant count badge */}
                        {node.totalDescendants > 0 && (
                          <motion.div
                            whileTap={{ scale: 0.85 }}
                            className="absolute -bottom-1 -right-1"
                            onClick={(e) => toggleCollapse(node.id, e)}
                          >
                            <Badge
                              variant={isCollapsed ? "default" : "secondary"}
                              className={cn(
                                "h-5 min-w-5 px-1.5 text-[9px] font-bold cursor-pointer transition-colors",
                                isCollapsed && "bg-primary text-primary-foreground"
                              )}
                            >
                              {isCollapsed ? `+${node.totalDescendants}` : node.totalDescendants}
                            </Badge>
                          </motion.div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>
  );
};
