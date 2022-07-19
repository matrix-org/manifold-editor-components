import {
  useState,
  useEffect,
  useCallback,
  memo,
  MouseEvent,
  ChangeEvent,
  FocusEvent,
  KeyboardEvent,
  Dispatch,
  SetStateAction,
  useRef,
  CSSProperties,
  Ref,
  MouseEventHandler,
  KeyboardEventHandler,
  ChangeEventHandler,
  FocusEventHandler,
  ReactElement,
  JSXElementConstructor,
  forwardRef,
  ForwardedRef,
} from "react";
import { ConnectDragPreview, ConnectDropTarget, useDrag, useDrop } from "react-dnd";
import { FixedSizeList, areEqual } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import { useMemo } from "react";

export enum NodeDropPosition {
  Root = "root",
  Before = "before",
  After = "after",
  On = "on",
}

interface TreeAPI {
  onToggleSelectedNode: (nodeId: number) => void;
  onAddSelectedNode: (nodeId: number) => void;
  onSetSelectedNode: (nodeId: number) => void;
  onDoubleClickNode: (nodeId: number) => void;
  onRenameNode: (nodeId: number, name: string) => void;
  dropAccept: string[];
  onDrop: (
    item: any,
    target: number | undefined,
    position: NodeDropPosition
  ) => void;
  canDrop: (
    item: any,
    target: number | undefined,
    position: NodeDropPosition
  ) => boolean;
  dragItemType: string;
  canDrag: (nodeId: number) => boolean;
  getDragItem: (nodeId: number) => any;
}

interface UseTreeNodeDropTargetProps<T> {
  nodeId?: number;
  position: NodeDropPosition;
  isRoot?: boolean;
  shallow?: boolean;
  accept: string[];
  onDrop: (
    item: T,
    target: number | undefined,
    position: NodeDropPosition
  ) => void;
  canDrop: (
    item: T,
    target: number | undefined,
    position: NodeDropPosition
  ) => boolean;
}

interface UseTreeNodeDropTargetCollectedProps {
  canDrop: boolean;
  isOver: boolean;
}

function useTreeNodeDropTarget<T>({
  nodeId,
  position,
  isRoot,
  shallow,
  accept,
  onDrop,
  canDrop,
}: UseTreeNodeDropTargetProps<T>): [
  UseTreeNodeDropTargetCollectedProps,
  ConnectDropTarget
] {
  return useDrop<T, T, UseTreeNodeDropTargetCollectedProps>({
    accept,
    drop(item, monitor) {
      if (shallow && monitor.didDrop()) {
        return;
      }

      onDrop(item, nodeId, position);

      return undefined;
    },
    canDrop(item, monitor) {
      if (
        !monitor.isOver({ shallow }) ||
        (isRoot && position === NodeDropPosition.Before)
      ) {
        return false;
      }

      return canDrop(item, nodeId, position);
    },
    collect: (monitor) => ({
      canDrop: monitor.canDrop(),
      isOver: monitor.isOver(),
    }),
  });
}

export interface RenderNodeProps {
  id: number;
  name: string;
  depth: number;
  isExpanded: boolean;
  isSelected: boolean;
  isActive: boolean;
  isLeaf: boolean;
  isRenaming: boolean;
  listItemProps: { style: CSSProperties };
  dragContainerProps: {
    ref: Ref<HTMLDivElement>;
    onMouseDown: MouseEventHandler;
    onClick: MouseEventHandler;
    onKeyDown: KeyboardEventHandler;
    tabIndex: number;
  };
  dragPreviewRef: ConnectDragPreview;
  beforeDropTargetState: UseTreeNodeDropTargetCollectedProps;
  beforeDropTargetRef: ConnectDropTarget;
  afterDropTargetState: UseTreeNodeDropTargetCollectedProps;
  afterDropTargetRef: ConnectDropTarget;
  onDropTargetState: UseTreeNodeDropTargetCollectedProps;
  onDropTargetRef: ConnectDropTarget;
  toggleProps: {
    onClick: MouseEventHandler;
  };
  nameInputProps: {
    type: string;
    onChange: ChangeEventHandler<HTMLInputElement>;
    onKeyDown: KeyboardEventHandler<HTMLInputElement>;
    onBlur: FocusEventHandler<HTMLInputElement>;
    value: string;
    autoFocus: boolean;
  };
}

interface TreeNodeItemData extends TreeAPI {
  nodes: InternalTreeNode[];
  renamingNode?: number;
  onExpandNode: (nodeId: number) => void;
  onCollapseNode: (nodeId: number) => void;
  onExpandChildren: (nodeId: number) => void;
  onCollapseChildren: (nodeId: number) => void;
  onExpandAllNodes: () => void;
  onCollapseAllNodes: () => void;
  onSetFocusedNode: (nodeId: number) => void;
  setRenamingNode: Dispatch<SetStateAction<number | undefined>>;
  renderNode: (
    props: RenderNodeProps
  ) => ReactElement<any, string | JSXElementConstructor<any>> | null;
}

interface TreeNodeItemProps {
  index: number;
  data: TreeNodeItemData;
  style: any;
}

function TreeNodeItem({
  index,
  data: {
    nodes,
    renamingNode,
    setRenamingNode,
    onExpandNode,
    onCollapseNode,
    onExpandChildren,
    onCollapseChildren,
    onToggleSelectedNode,
    onAddSelectedNode,
    onSetSelectedNode,
    onSetFocusedNode,
    onDoubleClickNode,
    onRenameNode,
    dragItemType,
    dropAccept,
    onDrop,
    canDrop,
    canDrag,
    getDragItem,
    renderNode,
  },
  style,
}: TreeNodeItemProps) {
  const {
    id,
    name,
    depth,
    isSelected,
    isExpanded,
    isLeaf,
    isActive,
    isFocused,
  } = nodes[index];

  const onMouseDown = useCallback(
    (e: MouseEvent) => {
      if (e.detail === 1) {
        if (e.shiftKey) {
          onToggleSelectedNode(id);
        } else if (!isSelected) {
          onSetSelectedNode(id);
        }
      } else if (e.detail === 2) {
        onDoubleClickNode(id);
      }
    },
    [id, isSelected, onToggleSelectedNode, onSetSelectedNode, onDoubleClickNode]
  );

  const onClickToggle = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();

      if (isExpanded) {
        onCollapseNode(id);
      } else {
        onExpandNode(id);
      }
    },
    [id, isExpanded, onCollapseNode, onExpandNode]
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      e.stopPropagation();

      if (e.key === "ArrowDown") {
        e.preventDefault();

        const nextNode = nodes[index + 1];

        if (nextNode) {
          if (e.shiftKey) {
            onAddSelectedNode(id);
          }

          onSetFocusedNode(nextNode.id);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();

        const prevNode = nodes[index - 1];

        if (prevNode) {
          if (e.shiftKey) {
            onAddSelectedNode(prevNode.id);
          }

          onSetFocusedNode(prevNode.id);
        }
      } else if (e.key === "ArrowLeft" && !isLeaf) {
        if (e.shiftKey) {
          onCollapseChildren(id);
        } else {
          onCollapseNode(id);
        }
      } else if (e.key === "ArrowRight" && !isLeaf) {
        if (e.shiftKey) {
          onExpandChildren(id);
        } else if (!isLeaf) {
          onExpandNode(id);
        }
      } else if (e.key === "Enter") {
        if (e.shiftKey) {
          onToggleSelectedNode(id);
        } else {
          onSetSelectedNode(id);
        }
      }
    },
    [
      onAddSelectedNode,
      onSetFocusedNode,
      onAddSelectedNode,
      onCollapseChildren,
      onCollapseNode,
      onExpandChildren,
      onExpandNode,
      onToggleSelectedNode,
      onSetSelectedNode,
      id,
      isLeaf,
      nodes,
    ]
  );

  const isRenaming = renamingNode === id;
  const [nameInputValue, setNameInputValue] = useState(name);

  const onKeyDownNameInput = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        setRenamingNode(undefined);
      } else if (e.key === "Enter") {
        onRenameNode(id, e.currentTarget.value);
      }
    },
    [id, setRenamingNode, onRenameNode]
  );

  const onChangeNodeName = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setNameInputValue(e.currentTarget.value);
    },
    [id, setNameInputValue]
  );

  const onSubmitNodeName = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      if (e.currentTarget) {
        onRenameNode(id, e.currentTarget.value);
      }
    },
    [onRenameNode, id]
  );

  const nodeRef = useRef<HTMLDivElement>();

  const [, dragRef, dragPreviewRef] = useDrag({
    type: dragItemType,
    item() {
      return getDragItem(id);
    },
    canDrag() {
      return canDrag(id);
    },
  });

  useEffect(() => {
    if (isFocused && nodeRef.current) {
      nodeRef.current.focus();
    }
  }, [isFocused]);

  const wrappedRef = useCallback(
    (el: HTMLDivElement) => {
      dragRef(el);
      nodeRef.current = el;
    },
    [dragRef, nodeRef]
  );

  const listItemProps = useMemo(
    () => ({
      style,
    }),
    [style]
  );

  const dragContainerProps = useMemo(
    () => ({
      ref: wrappedRef,
      onMouseDown,
      onKeyDown,
      tabIndex: 0,
    }),
    [wrappedRef, onMouseDown, onKeyDown]
  );

  const toggleProps = useMemo(
    () => ({
      onClick: onClickToggle,
    }),
    [onClickToggle]
  );

  const nameInputProps = useMemo(
    () => ({
      type: "text",
      onChange: onChangeNodeName,
      onKeyDown: onKeyDownNameInput,
      onBlur: onSubmitNodeName,
      value: nameInputValue,
      autoFocus: true,
    }),
    [onChangeNodeName, onKeyDownNameInput, onSubmitNodeName, nameInputValue]
  );

  const [beforeDropTargetState, beforeDropTargetRef] = useTreeNodeDropTarget({
    nodeId: id,
    position: NodeDropPosition.Before,
    isRoot: index === 0,
    accept: dropAccept,
    onDrop,
    canDrop,
  });

  const [afterDropTargetState, afterDropTargetRef] = useTreeNodeDropTarget({
    nodeId: id,
    position: NodeDropPosition.After,
    isRoot: index === 0,
    accept: dropAccept,
    onDrop,
    canDrop,
  });

  const [onDropTargetState, onDropTargetRef] = useTreeNodeDropTarget({
    nodeId: id,
    position: NodeDropPosition.On,
    isRoot: index === 0,
    accept: dropAccept,
    onDrop,
    canDrop,
  });

  return renderNode({
    id,
    isActive,
    isExpanded,
    isLeaf,
    isSelected,
    isRenaming,
    name,
    depth,
    listItemProps,
    dragContainerProps,
    dragPreviewRef,
    beforeDropTargetState,
    beforeDropTargetRef,
    afterDropTargetState,
    afterDropTargetRef,
    onDropTargetState,
    onDropTargetRef,
    toggleProps,
    nameInputProps,
  });
}

const MemoizedTreeNodeItem = memo(TreeNodeItem, areEqual);

export interface InternalTreeNode {
  id: number;
  name: string;
  depth: number;
  isLeaf: boolean;
  isExpanded: boolean;
  isSelected: boolean;
  isActive: boolean;
  isFocused: boolean;
}

export interface TreeNode {
  id: number;
  name: string;
  children?: TreeNode[];
}

export interface TreeViewProps extends TreeAPI {
  className?: string;
  defaultHeight?: number;
  defaultWidth?: number;
  itemSize: number;
  overscanCount?: number;
  tree: TreeNode;
  selected: number[];
  active?: number;
  children: (
    props: RenderNodeProps
  ) => ReactElement<any, string | JSXElementConstructor<any>> | null;
}

function getNodeKey(index: number, data: TreeNodeItemData) {
  return data.nodes[index].id;
}

export type TreeViewRefApi = Pick<
  FixedSizeList<TreeNodeItemData>,
  "scrollTo" | "scrollToItem"
>;

interface StackNode {
  node: TreeNode;
  depth: number;
}

function treeWalker(tree: TreeNode, expanded: number[], selected: number[], active?: number, focused?: number): InternalTreeNode[] {
  const nodes: InternalTreeNode[] = [];
  const stack: StackNode[] = [];

  stack.push({
    node: tree,
    depth: 0,
  });

  while (stack.length !== 0) {
    const { node, depth } = stack.pop()!;

    const isExpanded = depth === 0 || expanded.includes(node.id);

    nodes.push({
      id: node.id,
      name: node.name,
      depth,
      isExpanded,
      isSelected: selected.includes(node.id),
      isActive: node.id === active,
      isFocused: node.id === focused,
      isLeaf: node.children === undefined || node.children.length === 0
    });

    if (isExpanded && node.children && node.children.length > 0) {
      for (let i = node.children.length - 1; i >= 0; i--) {
        const child = node.children[i];

        stack.push({
          depth: depth + 1,
          node: child,
        });
      }
    }
  }

  return nodes;
}

function findNode(root: TreeNode, id: number): TreeNode | undefined {
  const stack: TreeNode[] = [];
  stack.push(root);

  while (stack.length !== 0) {
    const item = stack.pop()!;

    if (item.id === id) {
      return item;
    }

    if (item.children) {
      stack.push(...item.children);
    }
  }

  return undefined;
}

function getChildren(root: TreeNode, id: number): number[] {
  const parent = findNode(root, id);

  if (!parent) {
    return [];
  }

  const children: number[] = [];
  const stack: TreeNode[] = [];
  stack.push(root);

  while (stack.length !== 0) {
    const node = stack.pop()!;

    if (node !== parent) {
      children.push(node.id);
    }

    if (node.children) {
      stack.push(...node.children);
    }
  }

  return children;
}


export const TreeView = forwardRef<TreeViewRefApi, TreeViewProps>(
  (
    {
      className,
      defaultHeight,
      defaultWidth,
      itemSize,
      overscanCount,
      tree,
      selected,
      active,
      onToggleSelectedNode,
      onAddSelectedNode,
      onSetSelectedNode,
      onRenameNode,
      onDoubleClickNode,
      dropAccept,
      onDrop,
      canDrop,
      canDrag,
      dragItemType,
      getDragItem,
      children: renderNode,
    },
    ref
  ) => {
    const [focused, setFocused] = useState<number | undefined>();
    const [expanded, setExpanded] = useState<number[]>([]);
    const nodes = treeWalker(tree, expanded, selected, active, focused);

    const [renamingNode, setRenamingNode] = useState<number | undefined>();
    const [, treeContainerDropTarget] = useTreeNodeDropTarget({
      position: NodeDropPosition.Root,
      shallow: true,
      accept: dropAccept,
      onDrop,
      canDrop,
    });

    const onExpandNode = useCallback(
      (nodeId: number) => {
        setExpanded((expanded) => expanded.includes(nodeId) ? expanded : [...expanded, nodeId]);
      },
      []
    );
  
    const onCollapseNode = useCallback(
      (nodeId: number) => {
        setExpanded((expanded) => expanded.filter((expandedId) => expandedId !== nodeId));
      },
      []
    );
  
    const onExpandChildren = useCallback(
      (nodeId: number) => {
        setExpanded((expanded) => {
          const children = getChildren(tree, nodeId);
          return Array.from(new Set([...expanded, ...children]))
        });
      },
      [tree]
    );
  
    const onCollapseChildren = useCallback(
      (nodeId: number) => {
        setExpanded((expanded) => {
          const children = getChildren(tree, nodeId);
          return expanded.filter((expandedNode) => !children.includes(expandedNode));
        });
      },
      [tree]
    );
  
    const onExpandAllNodes = useCallback(
      () => {
        setExpanded(nodes.filter(node => !node.isLeaf).map((node) => node.id));
      },
      [nodes]
    );
  
    const onCollapseAllNodes = useCallback(
      () => {
        setExpanded([]);
      },
      []
    );

    return (
      <AutoSizer
        className={className}
        defaultHeight={defaultHeight}
        defaultWidth={defaultWidth}
      >
        {({ height, width }: { height: number; width: number }) => {
          return (
            <FixedSizeList
              ref={ref as ForwardedRef<FixedSizeList<TreeNodeItemData>>}
              height={height}
              width={width}
              itemSize={itemSize}
              itemCount={nodes.length}
              itemData={{
                nodes,
                renamingNode,
                dropAccept,
                dragItemType,
                setRenamingNode,
                onExpandNode,
                onCollapseNode,
                onExpandChildren,
                onCollapseChildren,
                onExpandAllNodes,
                onCollapseAllNodes,
                onToggleSelectedNode,
                onAddSelectedNode,
                onSetSelectedNode,
                onSetFocusedNode: setFocused,
                onDoubleClickNode,
                onRenameNode,
                onDrop,
                canDrop,
                canDrag,
                getDragItem,
                renderNode,
              }}
              itemKey={getNodeKey}
              outerRef={treeContainerDropTarget}
              overscanCount={overscanCount}
            >
              {MemoizedTreeNodeItem}
            </FixedSizeList>
          );
        }}
      </AutoSizer>
    );
  }
);
