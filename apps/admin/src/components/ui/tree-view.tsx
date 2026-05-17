'use client';

// Reorderable nested tree. Uses dnd-kit to support drag-to-reorder among siblings.
// Drag-to-reparent is handled by dropping onto a row's "into" zone (the row body itself).
// On mobile (touch-only) we render the same markup; dnd-kit handles pointer + touch.
//
// The component is generic on the node shape — callers pass an array of nodes with a
// `children` array. The onReorder callback receives a flat list of mutations to apply
// (id → new parentId + sortOrder) so the server can persist in one transaction.

import * as React from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TreeNode {
  id: string;
  parentId: string | null;
  sortOrder: number;
  children: TreeNode[];
}

export interface TreeReorderUpdate {
  id: string;
  parentId: string | null;
  sortOrder: number;
}

interface TreeViewProps<T extends TreeNode> {
  nodes: T[];
  renderRow: (node: T, ctx: { depth: number }) => React.ReactNode;
  onReorder?: (updates: TreeReorderUpdate[]) => void | Promise<void>;
  // Optional: render the entire tree but suppress drag interaction (used in read-only
  // contexts like category-pickers).
  readOnly?: boolean;
}

export function TreeView<T extends TreeNode>({
  nodes,
  renderRow,
  onReorder,
  readOnly,
}: TreeViewProps<T>) {
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [dropTarget, setDropTarget] = React.useState<DropTarget | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const flatById = React.useMemo(() => {
    const map = new Map<string, T>();
    function walk(list: T[]) {
      for (const n of list) {
        map.set(n.id, n);
        walk(n.children as T[]);
      }
    }
    walk(nodes);
    return map;
  }, [nodes]);

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleDragStart(e: DragStartEvent) {
    setDraggingId(String(e.active.id));
  }

  async function handleDragEnd(e: DragEndEvent) {
    const draggedId = String(e.active.id);
    setDraggingId(null);
    setDropTarget(null);
    if (!e.over || !onReorder) return;
    const target = parseDropId(String(e.over.id));
    if (!target) return;
    if (target.id === draggedId) return;
    if (isDescendant(draggedId, target.id, flatById)) return;

    const updates = computeReorder(
      nodes,
      draggedId,
      target,
    );
    if (updates.length === 0) return;
    await onReorder(updates);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={(e) => {
        setDropTarget(e.over ? parseDropId(String(e.over.id)) : null);
      }}
    >
      <div className="rounded-2xl border border-ink-100 bg-snow">
        <TreeLevel
          nodes={nodes}
          depth={0}
          collapsed={collapsed}
          onToggle={toggle}
          renderRow={renderRow}
          readOnly={readOnly}
          draggingId={draggingId}
          dropTarget={dropTarget}
        />
      </div>
      <DragOverlay>
        {draggingId && flatById.has(draggingId) ? (
          <div className="rounded-md border border-ink-200 bg-snow px-3 py-2 text-[13px] shadow-soft-md">
            Moving…
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

interface TreeLevelProps<T extends TreeNode> {
  nodes: T[];
  depth: number;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  renderRow: (node: T, ctx: { depth: number }) => React.ReactNode;
  readOnly?: boolean;
  draggingId: string | null;
  dropTarget: DropTarget | null;
}

function TreeLevel<T extends TreeNode>({
  nodes,
  depth,
  collapsed,
  onToggle,
  renderRow,
  readOnly,
  draggingId,
  dropTarget,
}: TreeLevelProps<T>) {
  if (nodes.length === 0) {
    return null;
  }
  return (
    <ul className="divide-y divide-ink-100">
      {nodes.map((node, idx) => {
        const isOpen = !collapsed.has(node.id);
        const hasChildren = node.children.length > 0;
        return (
          <li key={node.id}>
            <TreeRow
              node={node}
              depth={depth}
              hasChildren={hasChildren}
              isOpen={isOpen}
              isFirst={idx === 0}
              onToggle={() => onToggle(node.id)}
              renderRow={renderRow}
              readOnly={readOnly}
              draggingId={draggingId}
              dropTarget={dropTarget}
            />
            {hasChildren && isOpen ? (
              <TreeLevel
                nodes={node.children as T[]}
                depth={depth + 1}
                collapsed={collapsed}
                onToggle={onToggle}
                renderRow={renderRow}
                readOnly={readOnly}
                draggingId={draggingId}
                dropTarget={dropTarget}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

interface TreeRowProps<T extends TreeNode> {
  node: T;
  depth: number;
  hasChildren: boolean;
  isOpen: boolean;
  isFirst: boolean;
  onToggle: () => void;
  renderRow: (node: T, ctx: { depth: number }) => React.ReactNode;
  readOnly?: boolean;
  draggingId: string | null;
  dropTarget: DropTarget | null;
}

function TreeRow<T extends TreeNode>({
  node,
  depth,
  hasChildren,
  isOpen,
  onToggle,
  renderRow,
  readOnly,
  draggingId,
  dropTarget,
}: TreeRowProps<T>) {
  // Three drop zones per row: before (reorder above), into (reparent into), after (below).
  // dnd-kit's pointer detects which is closest.
  const draggable = useDraggable({ id: node.id, disabled: readOnly });
  const before = useDroppable({ id: `before:${node.id}`, disabled: readOnly });
  const into = useDroppable({ id: `into:${node.id}`, disabled: readOnly });
  const after = useDroppable({ id: `after:${node.id}`, disabled: readOnly });

  const beingDragged = draggingId === node.id;
  const isDropTargetInto = dropTarget?.kind === 'into' && dropTarget.id === node.id;
  const isDropTargetBefore = dropTarget?.kind === 'before' && dropTarget.id === node.id;
  const isDropTargetAfter = dropTarget?.kind === 'after' && dropTarget.id === node.id;

  return (
    <div
      ref={draggable.setNodeRef}
      className={cn('relative', beingDragged ? 'opacity-50' : '')}
      style={{
        transform: draggable.transform
          ? `translate3d(${draggable.transform.x}px, ${draggable.transform.y}px, 0)`
          : undefined,
      }}
    >
      <div
        ref={before.setNodeRef}
        className={cn(
          'pointer-events-auto absolute inset-x-0 top-0 h-2 -translate-y-1',
          isDropTargetBefore ? 'border-t-2 border-clay' : '',
        )}
      />
      <div
        ref={into.setNodeRef}
        className={cn(
          'flex items-center gap-2 px-2 py-2',
          isDropTargetInto ? 'bg-clay-200/40' : 'hover:bg-ink-50',
        )}
        style={{ paddingLeft: 8 + depth * 24 }}
      >
        {!readOnly ? (
          <button
            type="button"
            {...draggable.attributes}
            {...draggable.listeners}
            className="cursor-grab text-ink-300 hover:text-ink-500 active:cursor-grabbing"
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        ) : null}
        {hasChildren ? (
          <button
            type="button"
            onClick={onToggle}
            className="text-ink-500 hover:text-ink-900"
            aria-label={isOpen ? 'Collapse' : 'Expand'}
          >
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="inline-block h-4 w-4 text-ink-200">·</span>
        )}
        <div className="flex-1 min-w-0">{renderRow(node, { depth })}</div>
      </div>
      <div
        ref={after.setNodeRef}
        className={cn(
          'pointer-events-auto absolute inset-x-0 bottom-0 h-2 translate-y-1',
          isDropTargetAfter ? 'border-b-2 border-clay' : '',
        )}
      />
    </div>
  );
}

// =====================================================
// Reorder math
// =====================================================

interface DropTarget {
  kind: 'before' | 'into' | 'after';
  id: string;
}

function parseDropId(raw: string): DropTarget | null {
  const m = raw.match(/^(before|into|after):(.+)$/);
  if (!m) return null;
  return { kind: m[1] as DropTarget['kind'], id: m[2] };
}

function isDescendant<T extends TreeNode>(
  ancestorId: string,
  candidateId: string,
  byId: Map<string, T>,
): boolean {
  let curId: string | null = candidateId;
  const seen = new Set<string>();
  while (curId) {
    if (seen.has(curId)) return false;
    seen.add(curId);
    if (curId === ancestorId) return true;
    const parent: string | null = byId.get(curId)?.parentId ?? null;
    curId = parent;
  }
  return false;
}

// Given the tree, the dragged node id, and the drop target, compute a minimal set of
// `{ id, parentId, sortOrder }` updates to apply. We re-number the affected sibling
// lists by index so server-side sortOrder stays compact.
function computeReorder<T extends TreeNode>(
  nodes: T[],
  draggedId: string,
  target: DropTarget,
): TreeReorderUpdate[] {
  // Flatten parent→children mapping with the dragged node removed.
  const parentChildren = new Map<string | null, string[]>();
  function walk(list: T[], parentId: string | null) {
    parentChildren.set(parentId, []);
    for (const node of list) {
      if (node.id === draggedId) continue;
      parentChildren.get(parentId)!.push(node.id);
      walk(node.children as T[], node.id);
    }
  }
  walk(nodes, null);

  // Determine the dragged node's new parent and insertion index.
  let newParentId: string | null;
  let insertIndex: number;
  const targetParentId = findParentId(nodes, target.id);

  if (target.kind === 'into') {
    newParentId = target.id;
    // Append into the target as the last child.
    insertIndex = (parentChildren.get(target.id) ?? []).length;
    if (!parentChildren.has(target.id)) parentChildren.set(target.id, []);
  } else {
    newParentId = targetParentId;
    const siblings = parentChildren.get(targetParentId) ?? [];
    const targetIndex = siblings.indexOf(target.id);
    if (targetIndex === -1) {
      // Target was the dragged node itself or detached; bail.
      return [];
    }
    insertIndex = target.kind === 'before' ? targetIndex : targetIndex + 1;
  }

  // Insert into the new siblings list.
  const newSiblings = [...(parentChildren.get(newParentId) ?? [])];
  newSiblings.splice(insertIndex, 0, draggedId);
  parentChildren.set(newParentId, newSiblings);

  // Emit updates only for nodes whose (parentId, sortOrder) changed.
  const updates: TreeReorderUpdate[] = [];
  const originalById = new Map<string, { parentId: string | null; sortOrder: number }>();
  function index(list: T[], parentId: string | null) {
    list.forEach((n, idx) => {
      originalById.set(n.id, { parentId, sortOrder: idx });
      index(n.children as T[], n.id);
    });
  }
  // Index originals using positional order to detect changes consistently.
  index(nodes, null);

  for (const [parentId, ids] of parentChildren) {
    ids.forEach((id, sortOrder) => {
      const orig = originalById.get(id);
      if (!orig || orig.parentId !== parentId || orig.sortOrder !== sortOrder || id === draggedId) {
        updates.push({ id, parentId, sortOrder });
      }
    });
  }
  return updates;
}

function findParentId<T extends TreeNode>(nodes: T[], id: string): string | null {
  let result: string | null = null;
  function walk(list: T[], parentId: string | null) {
    for (const n of list) {
      if (n.id === id) {
        result = parentId;
        return;
      }
      walk(n.children as T[], n.id);
    }
  }
  walk(nodes, null);
  return result;
}
