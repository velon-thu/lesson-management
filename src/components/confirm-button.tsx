"use client";

import type { ReactNode } from "react";

type ConfirmButtonProps = {
  children: ReactNode;
  message: string;
  className?: string;
};

/**
 * 表单提交按钮，点击时弹出确认框，取消则阻止提交。
 * 用于删除等不可撤销的危险操作。
 */
export default function ConfirmButton({ children, message, className }: ConfirmButtonProps) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
