import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

export function mountUi() {
  const el = document.getElementById('ui-root');
  if (!el) return;

  // 防止 HMR 或重复执行时重复 mount
  if (el.__reactRoot) return;

  const root = createRoot(el);
  el.__reactRoot = root;
  root.render(<App />);
}
