"use client";

import { useState } from "react";

type SystemSettingsEntryProps = {
  error?: string;
  defaultOpen?: boolean;
};

export default function SystemSettingsEntry({
  error = "",
  defaultOpen = false,
}: SystemSettingsEntryProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <>
      <button
        type="button"
        className="role-card role-card-button role-card-wide"
        onClick={() => setOpen(true)}
      >
        系统设置
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
