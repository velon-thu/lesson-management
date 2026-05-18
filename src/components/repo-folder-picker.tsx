"use client";

import { useMemo, useState } from "react";

type FolderNode = {
  name: string;
  path: string;
  children: FolderNode[];
};

function buildFolderTree(paths: string[]): FolderNode[] {
  const root: FolderNode = { name: "", path: "", children: [] };

  for (const folderPath of paths) {
    const parts = folderPath.split("/").filter(Boolean);
    let cursor = root;

    parts.forEach((part, index) => {
      let folder = cursor.children.find((child) => child.name === part);

      if (!folder) {
        folder = { name: part, path: parts.slice(0, index + 1).join("/"), children: [] };
        cursor.children.push(folder);
      }

      cursor = folder;
    });
  }

  const sortNodes = (nodes: FolderNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
    nodes.forEach((node) => sortNodes(node.children));
  };

  sortNodes(root.children);
  return root.children;
}

type FolderRowProps = {
  node: FolderNode;
  selected: string | null;
  onSelect: (path: string) => void;
};

function FolderRow({ node, selected, onSelect }: FolderRowProps) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <li>
      <div className={`tree-row folder-pick-row${selected === node.path ? " is-selected" : ""}`}>
        {hasChildren ? (
          <button
            type="button"
            className="tree-caret-btn"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? "收起" : "展开"}
          >
            {open ? "▾" : "▸"}
          </button>
        ) : (
          <span className="tree-caret-spacer" />
        )}
        <button type="button" className="folder-pick-name" onClick={() => onSelect(node.path)}>
          {node.name}
        </button>
      </div>
      {hasChildren && open ? (
        <ul className="tree-children">
          {node.children.map((child) => (
            <FolderRow key={child.path} node={child} selected={selected} onSelect={onSelect} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

type RepoFolderPickerProps = {
  folders: string[];
  defaultFolder?: string;
};

export default function RepoFolderPicker({ folders, defaultFolder = "" }: RepoFolderPickerProps) {
  const tree = useMemo(() => buildFolderTree(folders.filter(Boolean)), [folders]);
  const [selected, setSelected] = useState(defaultFolder);
  const [newFolder, setNewFolder] = useState("");

  const usingNewFolder = newFolder.trim().length > 0;
  const effectiveFolder = usingNewFolder ? newFolder.trim() : selected;
  const activeSelected = usingNewFolder ? null : selected;

  return (
    <div className="folder-picker">
      <input type="hidden" name="repoFolder" value={effectiveFolder} />

      <div className="folder-picker-tree">
        <ul className="lecture-tree">
          <li>
            <div
              className={`tree-row folder-pick-row${activeSelected === "" ? " is-selected" : ""}`}
            >
              <span className="tree-caret-spacer" />
              <button
                type="button"
                className="folder-pick-name"
                onClick={() => setSelected("")}
              >
                （仓库根目录）
              </button>
            </div>
          </li>
          {tree.map((node) => (
            <FolderRow
              key={node.path}
              node={node}
              selected={activeSelected}
              onSelect={setSelected}
            />
          ))}
        </ul>
      </div>

      <label className="form-field">
        <span>或新建文件夹</span>
        <input
          type="text"
          value={newFolder}
          onChange={(event) => setNewFolder(event.target.value)}
          placeholder="输入新文件夹名，如 chapter5；填了就以新建为准"
        />
      </label>

      <p className="form-hint folder-picker-hint">
        当前讲义将放到：{effectiveFolder || "仓库根目录"}
        {usingNewFolder ? "（新建文件夹）" : ""}
      </p>
    </div>
  );
}
