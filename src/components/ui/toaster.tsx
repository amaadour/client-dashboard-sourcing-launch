'use client';

import { Toaster as HotToaster } from 'react-hot-toast';

export function Toaster() {
  return (
    <HotToaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: 'var(--background, #fff)',
          color: 'var(--foreground, #000)',
          border: '1px solid var(--border, #e2e8f0)',
          fontSize: '14px',
        },
        success: {
          style: {
            background: 'var(--success-background, #f0fdf4)',
            border: '1px solid var(--success-border, #bbf7d0)',
          },
        },
        error: {
          style: {
            background: 'var(--error-background, #fff1f2)',
            border: '1px solid var(--error-border, #fecdd3)',
          },
        },
      }}
    />
  );
} 