"use client";

import { useState } from "react";

type SystemSettingsEntryProps = {
  error?: string;
  defaultOpen?: boolean;
};

function GearIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
    </svg>
  );
}

/**
 * 系统设置入口：欢迎页的一张卡片，点击后弹出密码框。
 */
export default function SystemSettingsEntry({
  error = "",
  defaultOpen = false,
}: SystemSettingsEntryProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <>
      <button
        type="button"
        className="welcome-card welcome-card-wide welcome-card-settings"
        onClick={() => setOpen(true)}
      >
        <span className="welcome-card-icon">
          <GearIcon />
        </span>
        <span className="welcome-card-label">系统设置</span>
      </button>

      {open ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="系统设置密码">
          <div className="modal-card">
            <form action="/api/system-settings/unlock" method="post" className="auth-form">
              <input
                name="password"
                type="password"
                placeholder="请输入系统设置密码"
                className="settings-password-input"
                autoFocus
              />
              {error ? <p className="form-error">{error}</p> : null}
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setOpen(false)}>
                  取消
                </button>
                <button type="submit" className="primary-button">
                  进入系统设置
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
