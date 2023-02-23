import { useCallback, useEffect, useRef, useState } from "react";
import { Scene, Object3D, Matrix4 } from "three";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import classNames from "classnames";
import { TreeView, NodeDropPosition } from "../src/lib";
import "./App.css";

enum DnDItemTypes {
  Node = "node",
}

const dragItemType = DnDItemTypes.Node;
const dropAccept = [DnDItemTypes.Node];

interface DnDItem {
  type: DnDItemTypes;
  nodeIds?: number[];
}

interface TreeState {
  scene: Scene;
  selected: number[];
  active?: number;
}

function getSelectionRoots(scene: Object3D, selection: number[]): Object3D[] {
  const roots = [];

  const traverse = (object: Object3D) => {
    if (selection.includes(object.id)) {
      roots.push(object);
      return;
    }

    for (const child of object.children) {
      traverse(child);
    }
  };

  traverse(scene);

  return roots;
}

const objectAddedEvent = { type: "added" };

const tempMatrix = new Matrix4();

function reparentObjects(
  parent: Object3D,
  objects: Object3D[],
  before?: Object3D
) {
  parent.updateMatrixWorld();

  console.log({ parent, objects, before });

  for (const object of objects) {
    // Maintain world position when reparenting.
    if (object.parent !== parent) {
      object.parent.updateMatrixWorld();

      tempMatrix.copy(parent.matrixWorld).invert();
      tempMatrix.multiply(object.parent.matrixWorld);

      // Update local matrix and position/rotation/scale/quaternion properties
      object.applyMatrix4(tempMatrix);
      // Update matrixWorld
      object.matrixWorld.multiplyMatrices(
        object.parent.matrixWorld,
        object.matrix
      );
    }

    if (object.parent !== null) {
      object.parent.remove(object);
    }
  }

  if (before) {
    const beforeIndex = parent.children.indexOf(before);

    if (beforeIndex === -1) {
      throw new Error("Couldn't find beforeId");
    }

    parent.children.splice(beforeIndex, 0, ...objects);
  } else {
    parent.children.push(...objects);
  }

  for (const object of objects) {
    object.parent = parent;
    object.dispatchEvent(objectAddedEvent);
  }
}

export default function App() {
  const [{ scene, selected, active }, setState] = useState<TreeState>(() => {
    const scene = new Scene();
    scene.name = "Scene";

    const objectA = new Object3D();
    objectA.name = "Object3D A";
    scene.add(objectA);

    const objectB = new Object3D();
    objectB.name = "Object3D B";
    objectA.add(objectB);

    const objectC = new Object3D();
    objectC.name = "Object3D C";
    scene.add(objectC);

    for (let i = 0; i < 250; i++) {
      const child = new Object3D();
      child.name = `Child${i}`;
      scene.add(child);
    }

    return {
      scene,
      selected: [],
      active: undefined,
    };
  });

  const canDrop = useCallback(
    (item: DnDItem, target: number, position: NodeDropPosition) => {
      if (!item.nodeIds) {
        return false;
      }

      if (
        target === scene.id &&
        (position === NodeDropPosition.Before ||
          position === NodeDropPosition.After)
      ) {
        return false;
      }

      const roots = getSelectionRoots(scene, item.nodeIds);

      for (const root of roots) {
        if (root.getObjectById(target) !== undefined) {
          return false;
        }
      }

      return true;
    },
    [scene]
  );

  const canDrag = useCallback(
    (nodeId: number) => {
      return !selected.includes(scene.id);
    },
    [scene, selected]
  );

  const getDragItem = useCallback(
    (nodeId: number) => {
      return { type: DnDItemTypes.Node, nodeIds: selected };
    },
    [selected]
  );

  const onToggleSelectedNode = useCallback((nodeId) => {
    setState((state) => {
      const isSelected = state.selected.includes(nodeId);
      const nextSelected = isSelected
        ? state.selected.filter((selectedId) => selectedId !== nodeId)
        : [...state.selected, nodeId];

      return {
        ...state,
        selected: nextSelected,
        active:
          nextSelected.length > 0
            ? nextSelected[nextSelected.length - 1]
            : undefined,
      };
    });
  }, []);

  const onAddSelectedNode = useCallback((nodeId) => {
    setState((state) => {
      const isSelected = state.selected.includes(nodeId);

      return {
        ...state,
        selected: !isSelected ? [...state.selected, nodeId] : state.selected,
        active: nodeId,
      };
    });
  }, []);

  const onSetSelectedNode = useCallback((nodeId) => {
    setState((state) => ({
      ...state,
      selected: [nodeId],
      active: nodeId,
    }));
  }, []);

  const onDoubleClickNode = useCallback((nodeId) => {
    console.log(`Focus ${nodeId}`);
  }, []);

  const onRenameNode = useCallback((nodeId, name) => {
    setState((state) => {
      const object = state.scene.getObjectById(nodeId);

      if (object) {
        object.name = name;
      }

      return { ...state };
    });
  }, []);

  const onDrop = useCallback(
    (item: DnDItem, target: number | undefined, position: NodeDropPosition) => {
      const roots = getSelectionRoots(scene, item.nodeIds);

      if (position === NodeDropPosition.Root) {
        reparentObjects(scene, roots);
        return;
      }

      if (!target) {
        return;
      }

      const node = scene.getObjectById(target);

      if (!node) {
        return;
      }

      if (position === NodeDropPosition.On) {
        reparentObjects(node, roots);
      } else if (position === NodeDropPosition.Before) {
        reparentObjects(node.parent, roots, node);
      } else if (position === NodeDropPosition.After) {
        const nodeIndex = node.parent.children.indexOf(node);
        reparentObjects(
          node.parent,
          roots,
          node.parent.children[nodeIndex + 1]
        );
      }

      setState((state) => ({ ...state }));
    },
    [scene]
  );

  const treeViewRef = useRef(null);

  const scrollTo50 = () => {
    const child = scene.getObjectByName("Child50");
    treeViewRef.current.scrollToNode(child.id, "start");
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="Panel">
        <TreeView
          ref={treeViewRef}
          tree={scene}
          selected={selected}
          active={active}
          itemSize={32}
          onToggleSelectedNode={onToggleSelectedNode}
          onAddSelectedNode={onAddSelectedNode}
          onSetSelectedNode={onSetSelectedNode}
          onDoubleClickNode={onDoubleClickNode}
          onRenameNode={onRenameNode}
          dropAccept={dropAccept}
          onDrop={onDrop}
          canDrop={canDrop}
          dragItemType={dragItemType}
          canDrag={canDrag}
          getDragItem={getDragItem}
        >
          {({
            id,
            name,
            depth,
            isExpanded,
            isSelected,
            isActive,
            isLeaf,
            isRenaming,
            listItemProps,
            dragContainerProps,
            beforeDropTargetState,
            beforeDropTargetRef,
            afterDropTargetState,
            afterDropTargetRef,
            onDropTargetState,
            onDropTargetRef,
            toggleProps,
            nameInputProps,
          }) => {
            return (
              <li {...listItemProps}>
                <div
                  {...dragContainerProps}
                  className={classNames("TreeView__node", {
                    "TreeView__node--root": depth === 0,
                    "TreeView__node--selected": isSelected,
                    "TreeView__node--active": isActive,
                  })}
                >
                  <div
                    ref={beforeDropTargetRef}
                    className={classNames(
                      "TreeView__drop-target",
                      "TreeView__drop-target--before",
                      {
                        "TreeView__drop-target--accept":
                          beforeDropTargetState.canDrop &&
                          beforeDropTargetState.isOver,
                      }
                    )}
                  />
                  <div
                    ref={onDropTargetRef}
                    className="TreeView__node-content"
                    style={{ paddingLeft: depth * 8 + 2 }}
                  >
                    {isLeaf ? (
                      <div className="TreeView__leaf-spacer" />
                    ) : (
                      <button
                        {...toggleProps}
                        className={classNames("TreeView__node-toggle", {
                          "TreeView__node-toggle--expanded": isExpanded,
                        })}
                      />
                    )}
                    <div className="TreeView__node-select-target">
                      <div className="TreeView__node-icon" />
                      <div className="TreeView__node-label-container">
                        {isRenaming ? (
                          <div className="TreeView__rename-input-container">
                            <input
                              {...nameInputProps}
                              className="TreeView__rename-input"
                            />
                          </div>
                        ) : (
                          <div
                            className={classNames("TreeView__node-label", {
                              "TreeView__node-label--accept-drop":
                                onDropTargetState.canDrop &&
                                onDropTargetState.isOver,
                            })}
                          >
                            {name}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div
                    ref={afterDropTargetRef}
                    className={classNames(
                      "TreeView__drop-target",
                      "TreeView__drop-target--after",
                      {
                        "TreeView__drop-target--accept":
                          afterDropTargetState.canDrop &&
                          afterDropTargetState.isOver,
                      }
                    )}
                  />
                </div>
              </li>
            );
          }}
        </TreeView>
      </div>
      <button onClick={scrollTo50}>Scroll to ID 50</button>
    </DndProvider>
  );
}
