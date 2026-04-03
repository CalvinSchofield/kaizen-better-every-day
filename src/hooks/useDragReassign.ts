import { useRef, useCallback, useState } from 'react';
import { hapticMedium, hapticSelection, hapticWarning } from '@/utils/haptics';

export interface DragNode {
  id: string;
  name: string;
  userId: string | null;
  profilePhotoUrl?: string | null;
  totalDescendants: number;
  x: number;
  y: number;
}

interface PositionedHitTarget {
  id: string;
  userId: string | null;
  x: number;
  y: number;
  isLabelNode?: boolean;
  isOfficeNode?: boolean;
}

interface UseDragReassignOptions {
  /** IDs of nodes this user is allowed to drag (their downline) */
  draggableNodeIds: Set<string>;
  /** IDs of nodes that are valid drop targets */
  validDropTargetIds: Set<string>;
  /** All positioned nodes for hit-testing */
  positionedNodes: PositionedHitTarget[];
  /** Current zoom scale from TransformWrapper */
  scale: number;
  /** Current pan offset */
  panOffset: { x: number; y: number };
  /** Padding used in the tree layout */
  padding: number;
  /** Called when a valid drop is completed */
  onDrop: (sourceNode: DragNode, targetNodeId: string) => void;
  /** Get the subtree IDs for a node (to prevent circular drops) */
  getSubtreeIds: (nodeId: string) => Set<string>;
  /** Current user's own userId - can't drag yourself */
  currentUserId: string | null;
}

const LONG_PRESS_DELAY = 400;
const HIT_RADIUS = 40; // pixels in tree-space
const MOVE_THRESHOLD = 10; // pixels before cancelling long press

export const useDragReassign = ({
  draggableNodeIds,
  validDropTargetIds,
  positionedNodes,
  scale,
  panOffset,
  padding,
  onDrop,
  getSubtreeIds,
  currentUserId,
}: UseDragReassignOptions) => {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNode, setDraggedNode] = useState<DragNode | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [subtreeIds, setSubtreeIds] = useState<Set<string>>(new Set());

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);
  const isLongPressRef = useRef(false);
  const pendingNodeRef = useRef<DragNode | null>(null);
  const wrapperRef = useRef<HTMLElement | null>(null);
  const lastHoverIdRef = useRef<string | null>(null);

  const cancelTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /** Convert page coordinates to tree-space coordinates */
  const pageToTreeCoords = useCallback(
    (pageX: number, pageY: number): { tx: number; ty: number } => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return { tx: 0, ty: 0 };
      const localX = pageX - rect.left;
      const localY = pageY - rect.top;
      const tx = (localX - panOffset.x) / scale;
      const ty = (localY - panOffset.y) / scale;
      return { tx, ty };
    },
    [scale, panOffset]
  );

  /** Find closest positioned node to tree-space coordinates */
  const hitTest = useCallback(
    (tx: number, ty: number, excludeIds: Set<string>): string | null => {
      let closest: { id: string; dist: number } | null = null;
      for (const node of positionedNodes) {
        if (node.isLabelNode || node.isOfficeNode) continue;
        if (excludeIds.has(node.id)) continue;
        if (!validDropTargetIds.has(node.id)) continue;
        const dx = (node.x + padding) - tx;
        const dy = (node.y + padding) - ty;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < HIT_RADIUS && (!closest || dist < closest.dist)) {
          closest = { id: node.id, dist };
        }
      }
      return closest?.id || null;
    },
    [positionedNodes, validDropTargetIds, padding]
  );

  const handleDragStart = useCallback(
    (node: DragNode) => {
      // Can't drag yourself, label nodes, or nodes without userId
      if (!node.userId) return;
      if (node.userId === currentUserId) return;
      if (!draggableNodeIds.has(node.id)) return;

      pendingNodeRef.current = node;
    },
    [currentUserId, draggableNodeIds]
  );

  const onTouchStart = useCallback(
    (node: DragNode, e: React.TouchEvent) => {
      handleDragStart(node);
      if (!pendingNodeRef.current) return;

      const touch = e.touches[0];
      startPosRef.current = { x: touch.clientX, y: touch.clientY };
      movedRef.current = false;
      isLongPressRef.current = false;

      timerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        const n = pendingNodeRef.current;
        if (!n) return;
        
        hapticMedium();
        setDraggedNode(n);
        setIsDragging(true);
        setDragPosition({ x: touch.clientX, y: touch.clientY });
        const sIds = getSubtreeIds(n.id);
        sIds.add(n.id);
        setSubtreeIds(sIds);
      }, LONG_PRESS_DELAY);
    },
    [handleDragStart, getSubtreeIds]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      
      if (!isLongPressRef.current && startPosRef.current) {
        const dx = Math.abs(touch.clientX - startPosRef.current.x);
        const dy = Math.abs(touch.clientY - startPosRef.current.y);
        if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
          cancelTimer();
          movedRef.current = true;
          pendingNodeRef.current = null;
          return;
        }
      }

      if (isDragging) {
        e.preventDefault();
        e.stopPropagation();
        setDragPosition({ x: touch.clientX, y: touch.clientY });
        
        const { tx, ty } = pageToTreeCoords(touch.clientX, touch.clientY);
        const hitId = hitTest(tx, ty, subtreeIds);
        
        if (hitId !== lastHoverIdRef.current) {
          lastHoverIdRef.current = hitId;
          setDropTargetId(hitId);
          if (hitId) hapticSelection();
        }
      }
    },
    [isDragging, cancelTimer, pageToTreeCoords, hitTest, subtreeIds]
  );

  const onTouchEnd = useCallback(() => {
    cancelTimer();
    
    if (isDragging && draggedNode) {
      if (dropTargetId) {
        hapticWarning();
        onDrop(draggedNode, dropTargetId);
      }
      // Reset drag state
      setIsDragging(false);
      setDraggedNode(null);
      setDropTargetId(null);
      setSubtreeIds(new Set());
      lastHoverIdRef.current = null;
    }
    
    startPosRef.current = null;
    movedRef.current = false;
    isLongPressRef.current = false;
    pendingNodeRef.current = null;
  }, [isDragging, draggedNode, dropTargetId, cancelTimer, onDrop]);

  // Mouse equivalents for desktop
  const onMouseDown = useCallback(
    (node: DragNode, e: React.MouseEvent) => {
      handleDragStart(node);
      if (!pendingNodeRef.current) return;

      startPosRef.current = { x: e.clientX, y: e.clientY };
      movedRef.current = false;
      isLongPressRef.current = false;

      timerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        const n = pendingNodeRef.current;
        if (!n) return;
        
        hapticMedium();
        setDraggedNode(n);
        setIsDragging(true);
        setDragPosition({ x: e.clientX, y: e.clientY });
        const sIds = getSubtreeIds(n.id);
        sIds.add(n.id);
        setSubtreeIds(sIds);
      }, LONG_PRESS_DELAY);
    },
    [handleDragStart, getSubtreeIds]
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isLongPressRef.current && startPosRef.current) {
        const dx = Math.abs(e.clientX - startPosRef.current.x);
        const dy = Math.abs(e.clientY - startPosRef.current.y);
        if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
          cancelTimer();
          movedRef.current = true;
          pendingNodeRef.current = null;
          return;
        }
      }

      if (isDragging) {
        e.preventDefault();
        setDragPosition({ x: e.clientX, y: e.clientY });
        
        const { tx, ty } = pageToTreeCoords(e.clientX, e.clientY);
        const hitId = hitTest(tx, ty, subtreeIds);
        
        if (hitId !== lastHoverIdRef.current) {
          lastHoverIdRef.current = hitId;
          setDropTargetId(hitId);
          if (hitId) hapticSelection();
        }
      }
    },
    [isDragging, cancelTimer, pageToTreeCoords, hitTest, subtreeIds]
  );

  const onMouseUp = useCallback(() => {
    cancelTimer();
    
    if (isDragging && draggedNode) {
      if (dropTargetId) {
        hapticWarning();
        onDrop(draggedNode, dropTargetId);
      }
      setIsDragging(false);
      setDraggedNode(null);
      setDropTargetId(null);
      setSubtreeIds(new Set());
      lastHoverIdRef.current = null;
    }
    
    startPosRef.current = null;
    movedRef.current = false;
    isLongPressRef.current = false;
    pendingNodeRef.current = null;
  }, [isDragging, draggedNode, dropTargetId, cancelTimer, onDrop]);

  const cancelDrag = useCallback(() => {
    cancelTimer();
    setIsDragging(false);
    setDraggedNode(null);
    setDropTargetId(null);
    setSubtreeIds(new Set());
    lastHoverIdRef.current = null;
    startPosRef.current = null;
    movedRef.current = false;
    isLongPressRef.current = false;
    pendingNodeRef.current = null;
  }, [cancelTimer]);

  return {
    isDragging,
    draggedNode,
    dragPosition,
    dropTargetId,
    subtreeIds,
    wrapperRef,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    cancelDrag,
    /** Whether the long press fired (used to suppress tap) */
    wasLongPress: isLongPressRef,
  };
};
