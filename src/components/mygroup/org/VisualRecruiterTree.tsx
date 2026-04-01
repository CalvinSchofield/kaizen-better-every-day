import { useMemo, useCallback, useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize2, Building2 } from "lucide-react";
import { getCleanName, getInitials } from "@/utils/nameUtils";
import { YearBadge } from "@/components/leaderboard/YearBadge";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ──────────────────────────────────────────────

export type RoleColor =
  | "corporate"   // gold
  | "regional"    // red
  | "area_director" // amber
  | "sr_mgmt_group" // purple
  | "mgmt_group"  // blue
  | "team_lead"   // green
  | "none";        // default gray

export interface TreeNode {
  id: string;
  name: string;
  userId: string | null;
  stage: string | null;
  profilePhotoUrl?: string | null;
  role?: string | null;
  year?: string | null;
  isAreaDirector?: boolean;
  roleColor?: RoleColor;
  /** If true, this is a lightweight label node (e.g. "Calvin Schofield Team") not a real person */
  isLabelNode?: boolean;
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
  roleColor?: RoleColor;
  isLabelNode?: boolean;
  x: number;
  y: number;
  childCount: number;
  totalDescendants: number;
}

interface ColoredLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: RoleColor;
}

// ── Layout Constants ───────────────────────────────────

const NODE_RADIUS = 30;
const NODE_DIAMETER = NODE_RADIUS * 2;
const H_GAP = 24;
const V_GAP = 80;
const LABEL_HEIGHT = 48;
const NODE_TOTAL_H = NODE_DIAMETER + LABEL_HEIGHT;
const LABEL_NODE_HEIGHT = 24; // smaller for label nodes

// ── Role Color Definitions ─────────────────────────────

const ROLE_RING_CLASSES: Record<RoleColor, string> = {
  corporate: "border-yellow-500 ring-2 ring-yellow-300/40",
  regional: "border-red-500 ring-2 ring-red-300/40",
  area_director: "border-amber-500 ring-2 ring-amber-300/40",
  mgmt_group: "border-blue-500 ring-2 ring-blue-300/40",
  team_lead: "border-green-500 ring-2 ring-green-300/40",
  none: "border-border",
};

const ROLE_BG_CLASSES: Record<RoleColor, string> = {
  corporate: "bg-yellow-50 dark:bg-yellow-950/30",
  regional: "bg-red-50 dark:bg-red-950/30",
  area_director: "bg-amber-50 dark:bg-amber-950/30",
  mgmt_group: "bg-blue-50 dark:bg-blue-950/30",
  team_lead: "bg-green-50 dark:bg-green-950/30",
  none: "bg-muted",
};

const ROLE_STROKE_COLORS: Record<RoleColor, string> = {
  corporate: "#eab308",
  regional: "#ef4444",
  area_director: "#f59e0b",
  mgmt_group: "#3b82f6",
  team_lead: "#22c55e",
  none: "",  // will use CSS class
};

const ROLE_LABEL_TEXT: Record<RoleColor, string> = {
  corporate: "text-yellow-600 dark:text-yellow-400",
  regional: "text-red-600 dark:text-red-400",
  area_director: "text-amber-600 dark:text-amber-400",
  mgmt_group: "text-blue-600 dark:text-blue-400",
  team_lead: "text-green-600 dark:text-green-400",
  none: "text-muted-foreground",
};

// ── Helpers ────────────────────────────────────────────

function countDescendants(node: TreeNode): number {
  if (node.isLabelNode) {
    // Label nodes count their children but don't count themselves
    return node.children.reduce((sum, c) => sum + 1 + countDescendants(c), 0);
  }
  let count = node.children.length;
  for (const child of node.children) {
    count += countDescendants(child);
  }
  return count;
}

// ── Layout Algorithm ───────────────────────────────────

function computeSubtreeWidth(node: TreeNode, collapsedIds: Set<string>): number {
  if (node.isLabelNode) {
    // Label nodes are compact pills, not full avatar nodes
    if (node.children.length === 0 || collapsedIds.has(node.id)) return NODE_DIAMETER + H_GAP;
    const childrenWidth = node.children.reduce(
      (sum, child) => sum + computeSubtreeWidth(child, collapsedIds),
      0
    );
    return Math.max(NODE_DIAMETER + H_GAP, childrenWidth);
  }
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
  lines: ColoredLine[],
  collapsedIds: Set<string>,
  parentRoleColor: RoleColor = "none"
): void {
  const subtreeW = computeSubtreeWidth(node, collapsedIds);
  const cx = offsetX + subtreeW / 2;
  const cy = depth * (NODE_TOTAL_H + V_GAP) + NODE_RADIUS;
  const nodeRoleColor = node.roleColor || "none";

  nodes.push({
    id: node.id,
    name: node.name,
    userId: node.userId,
    stage: node.stage,
    profilePhotoUrl: node.profilePhotoUrl,
    role: node.role,
    year: node.year,
    isAreaDirector: node.isAreaDirector,
    roleColor: nodeRoleColor,
    isLabelNode: node.isLabelNode,
    x: cx,
    y: cy,
    childCount: node.children.length,
    totalDescendants: countDescendants(node),
  });

  if (node.children.length === 0 || collapsedIds.has(node.id)) return;

  let childOffset = offsetX;
  const childY = (depth + 1) * (NODE_TOTAL_H + V_GAP) + NODE_RADIUS;
  const junctionY = cy + NODE_RADIUS + (V_GAP + LABEL_HEIGHT) / 2;

  // Line color: use this node's role color for lines to children
  const lineColor = nodeRoleColor !== "none" ? nodeRoleColor : parentRoleColor;

  lines.push({ x1: cx, y1: cy + NODE_RADIUS, x2: cx, y2: junctionY, color: lineColor });

  const childPositions: number[] = [];

  node.children.forEach((child) => {
    const childW = computeSubtreeWidth(child, collapsedIds);
    const childCx = childOffset + childW / 2;
    childPositions.push(childCx);

    lines.push({ x1: childCx, y1: junctionY, x2: childCx, y2: childY - NODE_RADIUS, color: lineColor });

    layoutNodes(child, depth + 1, childOffset, nodes, lines, collapsedIds, lineColor);
    childOffset += childW;
  });

  if (childPositions.length > 1) {
    const leftmost = Math.min(...childPositions);
    const rightmost = Math.max(...childPositions);
    lines.push({ x1: leftmost, y1: junctionY, x2: rightmost, y2: junctionY, color: lineColor });
  }
}

function layoutForest(roots: TreeNode[], collapsedIds: Set<string>) {
  const nodes: PositionedNode[] = [];
  const lines: ColoredLine[] = [];
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

// ── Component ──────────────────────────────────────────

interface VisualRecruiterTreeProps {
  roots: TreeNode[];
  selectedNodeId: string | null;
  onSelectNode: (node: PositionedNode | null) => void;
  groupByOffice?: boolean;
  onGroupByOfficeChange?: (value: boolean) => void;
  showGroupByOfficeToggle?: boolean;
}

export const VisualRecruiterTree = ({
  roots,
  selectedNodeId,
  onSelectNode,
  groupByOffice = false,
  onGroupByOfficeChange,
  showGroupByOfficeToggle = false,
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
      if (node.isLabelNode) return; // don't open drawer for label nodes
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
            {showGroupByOfficeToggle && (
              <div className="absolute top-2 left-2 z-10">
                <Button
                  variant={groupByOffice ? "default" : "secondary"}
                  size="sm"
                  className={cn("h-7 shadow-sm gap-1.5 text-xs", groupByOffice && "bg-primary text-primary-foreground")}
                  onClick={() => onGroupByOfficeChange?.(!groupByOffice)}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  Offices
                </Button>
              </div>
            )}
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
                    {lines.map((line, i) => {
                      const strokeColor = ROLE_STROKE_COLORS[line.color];
                      return (
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
                          stroke={strokeColor || undefined}
                          className={strokeColor ? undefined : "stroke-border"}
                          strokeWidth={strokeColor ? 2 : 1.5}
                          strokeOpacity={strokeColor ? 0.6 : 1}
                        />
                      );
                    })}
                  </AnimatePresence>
                </motion.svg>

                {/* Nodes */}
                <AnimatePresence>
                  {nodes.map((node) => {
                    if (node.isLabelNode) {
                      return <LabelNodeRenderer key={node.id} node={node} PADDING={PADDING} collapsedIds={collapsedIds} toggleCollapse={toggleCollapse} />;
                    }

                    const cleanName = getCleanName(node.name);
                    const initials = getInitials(cleanName);
                    const isSelected = selectedNodeId === node.id;
                    const isGhost = !node.userId;
                    const isCollapsed = collapsedIds.has(node.id);
                    const roleColor = node.roleColor || "none";

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
                        {/* Avatar circle with year badge overlay */}
                        <div className="relative">
                          <div
                            className={cn(
                              "rounded-full border-[2.5px] transition-all duration-200 shadow-sm",
                              ROLE_RING_CLASSES[roleColor],
                              isSelected && "!border-primary !ring-4 !ring-primary/20 scale-110",
                              isGhost && "opacity-60"
                            )}
                          >
                            <Avatar className={cn("h-[56px] w-[56px]", ROLE_BG_CLASSES[roleColor])}>
                              <AvatarImage src={node.profilePhotoUrl || undefined} />
                              <AvatarFallback className="text-sm font-bold bg-primary/10 text-primary">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                          </div>

                          {/* Year badge - bottom right of avatar */}
                          {node.year && (
                            <div className="absolute -bottom-1 -right-1">
                              <YearBadge year={node.year} className="!w-4 !h-4 !text-[8px] shadow-sm" />
                            </div>
                          )}
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

                        {/* Area Director label (only for ADs, shown above org title) */}
                        {node.isAreaDirector && (
                          <span className="text-[9px] text-amber-600 dark:text-amber-400 font-bold leading-tight mt-0.5 truncate max-w-[92px]">
                            Area Director
                          </span>
                        )}

                        {/* Highest org title */}
                        {node.role && (
                          <span className={cn(
                            "text-[9px] font-medium leading-tight mt-0.5 truncate max-w-[92px] italic",
                            ROLE_LABEL_TEXT[roleColor]
                          )}>
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

// ── Label Node Renderer ────────────────────────────────

function LabelNodeRenderer({
  node,
  PADDING,
  collapsedIds,
  toggleCollapse,
}: {
  node: PositionedNode;
  PADDING: number;
  collapsedIds: Set<string>;
  toggleCollapse: (id: string, e: React.MouseEvent) => void;
}) {
  const isCollapsed = collapsedIds.has(node.id);
  const roleColor = node.roleColor || "none";
  const labelBg: Record<RoleColor, string> = {
    corporate: "bg-yellow-100 dark:bg-yellow-900/40 border-yellow-300 dark:border-yellow-700",
    regional: "bg-red-100 dark:bg-red-900/40 border-red-300 dark:border-red-700",
    area_director: "bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700",
    mgmt_group: "bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700",
    team_lead: "bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700",
    none: "bg-muted border-border",
  };

  return (
    <motion.div
      key={node.id}
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: "spring", stiffness: 300, damping: 25, mass: 0.8 }}
      className="absolute flex items-center justify-center"
      style={{
        left: node.x + PADDING - 60,
        top: node.y + PADDING - 12,
        width: 120,
        height: LABEL_NODE_HEIGHT,
      }}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold whitespace-nowrap shadow-sm",
          labelBg[roleColor],
          ROLE_LABEL_TEXT[roleColor]
        )}
        onClick={(e) => {
          if (node.totalDescendants > 0) toggleCollapse(node.id, e);
        }}
        style={{ cursor: node.totalDescendants > 0 ? "pointer" : "default" }}
      >
        <span className="truncate max-w-[80px]">{node.name}</span>
        {node.totalDescendants > 0 && (
          <Badge
            variant={isCollapsed ? "default" : "secondary"}
            className={cn(
              "h-4 min-w-4 px-1 text-[8px] font-bold",
              isCollapsed && "bg-primary text-primary-foreground"
            )}
          >
            {isCollapsed ? `+${node.totalDescendants}` : node.totalDescendants}
          </Badge>
        )}
      </div>
    </motion.div>
  );
}
