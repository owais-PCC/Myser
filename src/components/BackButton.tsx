'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function BackButton({ color = '#1e293b' }: { color?: string }) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      style={{
        background: 'none',
        border: 'none',
        padding: '4px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: color,
        marginRight: '6px',
        flexShrink: 0,
        transition: 'transform 0.15s ease',
      }}
      onMouseEnter={(e) => e.currentTarget.style.transform = 'translateX(-2px)'}
      onMouseLeave={(e) => e.currentTarget.style.transform = 'translateX(0)'}
      title="Back"
    >
      <ArrowLeft size={24} style={{ strokeWidth: 2.2 }} />
    </button>
  );
}
