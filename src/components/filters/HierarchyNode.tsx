import { useState, memo } from "react";
import { cn } from "@/lib/utils";
import { Check, ChevronRight, Building2, Users, Layers } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { FilterNode } from "./UnifiedFilterDrawer";

export interface HierarchyTreeNode {
  type: 'office' | 'sr_mgmt_group' | 'mgmt_group' | 'team';
  id: string;
  name: string;
  repCount: number;
  children: HierarchyTreeNode[];
}

interface HierarchyNodeProps {
  node: HierarchyTreeNode;
  selectedNodes: FilterNode[];
  onToggle: (node: FilterNode, children?: FilterNode[]) => void;
  depth: number;
  defaultExpanded?: boolean;
  /** Whether this node's parent is selected (cascade highlight) */
  parentSelected?: boolean;
}

const typeIcons: Record<string, typeof Building2> = {
  office: Building2,
  sr_mgmt_group: Layers,
  mgmt_group: Users,
  team: Users,
};

/** Collect all descendant FilterNodes from a tree node */
export const collectDescendants = (node: HierarchyTreeNode): FilterNode[] => {
  const result: FilterNode[] = [];
  for (const child of node.children) {
    result.push({ type: child.type, id: child.id, name: child.name });
    result.push(...collectDescendants(child));
  }
  return result;
};

export const HierarchyNode = memo(({
  node,
  selectedNodes,
  onToggle,
  depth,
  defaultExpanded = false,
  parentSelected = false,
}: HierarchyNodeProps) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedNodes.some(n => n.type === node.type && n.id === node.id);
  const isEffectivelySelected = isSelected || parentSelected;
  const Icon = typeIcons[node.type] || Users;

  const handleClick = () => {
    const descendants = collectDescendants(node);
    onToggle({ type: node.type, id: node.id, name: node.name }, descendants);
  };

  const handleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  return (
    <div>
      <button
        onClick={handleClick}
        className={cn(
          "w-full flex items-center gap-2 p-2.5 rounded-xl transition-all text-left",
          isEffectivelySelected
            ? "bg-primary/8 ring-1 ring-primary/30"
            : "hover:bg-muted/40"
        )}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {/* Expand chevron */}
        {hasChildren ? (
          <button
            onClick={handleExpand}
            className="h-5 w-5 flex items-center justify-center flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className={cn(
              "h-3.5 w-3.5 transition-transform duration-200",
              expanded && "rotate-90"
            )} />
          </button>
        ) : (
          <span className="w-5 flex-shrink-0" />
        )}

        {/* Icon */}
        <Icon className={cn(
          "h-4 w-4 flex-shrink-0",
          isEffectivelySelected ? "text-primary" : "text-muted-foreground"
        )} />

        {/* Name */}
        <span className={cn(
          "text-sm flex-1 truncate",
          isEffectivelySelected ? "font-semibold text-primary" : "font-medium"
        )}>
          {node.name}
        </span>

        {/* Rep count */}
        {node.repCount > 0 && (
          <span className="text-[11px] text-muted-foreground flex-shrink-0">
            {node.repCount}
          </span>
        )}

        {/* Checkmark */}
        {isEffectivelySelected && (
          <Check className="h-4 w-4 text-primary flex-shrink-0" />
        )}
      </button>

      {/* Children */}
      <AnimatePresence>
        {expanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className="border-l-2 border-border/50 ml-5"
              style={{ marginLeft: `${20 + depth * 16}px` }}
            >
              {node.children.map((child) => (
                <HierarchyNode
                  key={`${child.type}-${child.id}`}
                  node={child}
                  selectedNodes={selectedNodes}
                  onToggle={onToggle}
                  depth={depth + 1}
                  defaultExpanded={defaultExpanded}
                  parentSelected={isEffectivelySelected}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

HierarchyNode.displayName = 'HierarchyNode';
