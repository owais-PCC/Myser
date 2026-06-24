'use client'

import React from 'react'

export interface MyserLoaderProps {
  background?: string
  cycleDuration?: number
  showWordmark?: boolean
  showDots?: boolean
  markSize?: number
  fullScreen?: boolean
  className?: string
  style?: React.CSSProperties
}

export function MyserLoader({
  background = '#ffffff',
  cycleDuration = 2.4,
  showWordmark = true,
  showDots = true,
  markSize = 120,
  fullScreen = false,
  className,
  style: styleProp,
}: MyserLoaderProps) {
  const uid = React.useId().replace(/:/g, '')
  const gradId    = `myser-grad-${uid}`
  const fillAnim  = `myser-fill-${uid}`
  const wordAnim  = `myser-word-${uid}`
  const dotsAnim  = `myser-dots-${uid}`

  const c = cycleDuration

  const css = `
    @keyframes ${fillAnim} {
      0%      { clip-path: inset(0 100% 0 0); opacity: 1; }
      33%     { clip-path: inset(0   0% 0 0); opacity: 1; }
      80%     { clip-path: inset(0   0% 0 0); opacity: 1; }
      92%     { clip-path: inset(0   0% 0 0); opacity: 0; }
      92.01%  { clip-path: inset(0 100% 0 0); opacity: 0; }
      100%    { clip-path: inset(0 100% 0 0); opacity: 0; }
    }
    @keyframes ${wordAnim} {
      0%   { opacity: 0; transform: translateX(10px); }
      33%  { opacity: 0; transform: translateX(10px); }
      47%  { opacity: 1; transform: translateX(0);    }
      82%  { opacity: 1; transform: translateX(0);    }
      90%  { opacity: 0; transform: translateX(0);    }
      100% { opacity: 0; transform: translateX(0);    }
    }
    @keyframes ${dotsAnim} {
      0%,  20% { opacity: 0.25; }
      50%      { opacity: 1;    }
      80%, 100%{ opacity: 0.25; }
    }
  `

  const wrapStyle: React.CSSProperties = fullScreen
    ? {
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background,
        ...styleProp,
      }
    : {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        background,
        ...styleProp,
      }

  const s  = markSize
  const gap = Math.round(s * 0.22)
  const fs  = Math.round(s * 0.47)

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div style={wrapStyle} className={className} aria-label="Loading" role="status">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap }}>
            <div style={{ position: 'relative', width: s, height: s, flexShrink: 0 }}>
              <svg viewBox="0 0 120 120" width={s} height={s} aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'block' }}>
                <path d="M18 100 L18 26 L60 66 L102 26 L102 100" fill="none" stroke="#d7dee1" strokeWidth={15} strokeLinecap="round" strokeLinejoin="round" opacity={0.6} />
              </svg>
              <svg viewBox="0 0 120 120" width={s} height={s} aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'block', animation: `${fillAnim} ${c}s ease-out infinite` }}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0.1" x2="0.9" y2="1">
                    <stop offset="0" stopColor="#0e9560" />
                    <stop offset="1" stopColor="#1ac389" />
                  </linearGradient>
                </defs>
                <path d="M18 100 L18 26 L60 66" fill="none" stroke={`url(#${gradId})`} strokeWidth={15} strokeLinecap="round" strokeLinejoin="round" />
                <path d="M60 66 L102 26 L102 100" fill="none" stroke="#52666f" strokeWidth={15} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            {showWordmark && (
              <div aria-label="Myser" style={{ fontSize: fs, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1, fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif", animation: `${wordAnim} ${c}s ease-out infinite`, userSelect: 'none' }}>
                <span style={{ color: '#149867' }}>My</span>
                <span style={{ color: '#52666f' }}>ser</span>
              </div>
            )}
          </div>
          {showDots && (
            <div style={{ display: 'flex', gap: 7 }} aria-hidden="true">
              {[0, 0.16, 0.32].map((delay, i) => (
                <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#149867', display: 'block', animation: `${dotsAnim} ${c}s ease-in-out infinite`, animationDelay: `${delay}s` }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default MyserLoader
