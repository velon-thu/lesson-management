"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type FileNode = { type: "file"; name: string; path: string };
type FolderNode = { type: "folder"; name: string; path: string; children: TreeNode[] };
type TreeNode = FileNode | FolderNode;

function buildTree(paths: string[]): TreeNode[] {
  const root: FolderNode = { type: "folder", name: "", path: "", children: [] };

  for (const filePath of paths) {
    const parts = filePath.split("/").filter(Boolean);
    let cursor = root;

    parts.forEach((part, index) => {
      const isLeaf = index === parts.length - 1;

      if (isLeaf) {
        cursor.children.push({ type: "file", name: part, path: filePath });
        return;
      }

      const existing = cursor.children.find(
        (child): child is FolderNode => child.type === "folder" && child.name === part
      );

      if (existing) {
        cursor = existing;
        return;
      }

      const folder: FolderNode = {
        type: "folder",
        name: part,
        path: parts.slice(0, index + 1).join("/"),
        children: [],
      };
      cursor.children.push(folder);
      cursor = folder;
    });
  }

  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1;
      }
      return a.name.localeCompare(b.name, "zh-CN");
    });
    nodes.forEach((node) => {
      if (node.type === "folder") {
        sortNodes(node.children);
      }
    });
  };

  sortNodes(root.children);
  return root.children;
}

function FolderRow({ node }: { node: FolderNode }) {
  const [open, setOpen] = useState(true);

  return (
    <li>
      <button
        type="button"
        className="tree-row tree-folder-row"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="tree-caret">{open ? "▾" : "▸"}</span>
        <span className="tree-folder-name">{node.name}</span>
      </button>
      {open ? (
        <ul className="tree-children">
          {node.children.map((child) => (
            <TreeNodeRow key={`${child.type}:${child.path}`} node={child} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function FileRow({ node }: { node: FileNode }) {
  return (
    <li>
      <div className="tree-row tree-file-row">
        <label className="tree-file-label">
          <input type="checkbox" name="path" value={node.path} />
          <span className="tree-file-name">{node.name}</span>
        </label>
        <Link
          href={`/admin/lectures/revise?path=${encodeURIComponent(node.path)}`}
          className="secondary-link-button compact-button"
        >
          修改
        </Link>
      </div>
    </li>
  );
}

function TreeNodeRow({ node }: { node: TreeNode }) {
  return node.type === "folder" ? <FolderRow node={node} /> : <FileRow node={node} />;
}

export default function LectureTree({ files }: { files: string[] }) {
  const tree = useMemo(() => buildTree(files), [files]);

  return (
    <ul className="lecture-tree">
      {tree.map((node) => (
        <TreeNodeRow key={`${node.type}:${node.path}`} node={node} />
      ))}
    </ul>
  );
}
