'use client';

import { useState, useEffect } from 'react';
import { Sparkles, X, Check } from 'lucide-react';
import { getUserProfile, scansRemaining, UserProfile, PRO_MONTHLY_SCAN_CAP } from '@/lib/firestore-sync';
import { fetchProviderUsage, ProviderUsageSnapshot } from '@/lib/itemized-scan';
// purchasePro/verifyPurchaseWithServer from '@/lib/purchases' — not called
// from here yet. Wiring them into the button before the native purchase
// plugins exist just surfaces their "not implemented" error as an alert,
// which reads as broken rather than "coming soon." Swap the button back to
// calling them once the iOS engineer has the native side working — see
// IOS_SPECS_HANDOVER.md Part 4.

interface ProUpgradeModalProps {
  uid: string | null;
  onClose: () => void;
}

const PRO_FEATURES = [
  `Itemized receipt splitting — up to ${PRO_MONTHLY_SCAN_CAP} scans/month`,
  'Cloud receipt sync across devices (coming soon)',
  'Automated backups (coming soon)',
  'CSV/Excel export (coming soon)',
];

/**
 * Pro plan info + upgrade entry point (MYS-10). This is UI only — actual
 * payment processing (App Store In-App Purchase / StoreKit) is explicitly
 * NOT built here; that's the Mac-based iOS engineer's responsibility per
 * IOS_SPECS_HANDOVER.md. handleUpgradeClick below is the integration point
 * left for them: swap its body for the real StoreKit purchase flow, then
 * on a successful purchase the only thing that needs to happen is setting
 * `tier: 'pro'` on the user's `users/{uid}` Firestore document (the same
 * document functions/src/quota.ts already reads/writes server-side).
 *
 * Deliberately calm, not naggy — this only ever appears when the user
 * navigates here themselves (Settings > Myser Pro). No banners, no
 * interrupt-the-flow upsells elsewhere in the app (explicit product
 * decision, see TICKETS.md MYS-10).
 */
export default function ProUpgradeModal({ uid, onClose }: ProUpgradeModalProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiUsage, setApiUsage] = useState<ProviderUsageSnapshot | null>(null);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }
    getUserProfile(uid)
      .then((p) => {
        setProfile(p);
        // Backend enforces executive-only and returns null for anyone
        // else, but skip the request entirely for non-executive accounts
        // rather than relying on the server to say no.
        if (p.tier === 'executive') return fetchProviderUsage().then(setApiUsage);
      })
      .finally(() => setLoading(false));
  }, [uid]);

  function handleUpgradeClick() {
    // Payments aren't live yet — see src/lib/purchases.ts and
    // IOS_SPECS_HANDOVER.md Part 4 for what's already scaffolded and what
    // the iOS engineer still needs to build (native StoreKit/Play Billing
    // plugins, then real server-side receipt verification).
    alert('Hang tight — payment methods will be live soon!');
  }

  const tier = profile?.tier ?? 'free';
  const isExecutive = tier === 'executive';
  const isPro = tier === 'pro';
  // Paid-looking treatment covers executive too — it's an unlimited plan,
  // not a downgrade.
  const isPaid = isPro || isExecutive;
  const remaining = profile ? scansRemaining(profile) : null;
  const used = profile?.itemizedScansUsedThisMonth ?? 0;

  const planName = isExecutive ? 'Executive' : isPro ? 'Myser Pro' : 'Free';

  function usageLine(): string {
    if (isExecutive) {
      return `${used} AI ${used === 1 ? 'scan' : 'scans'} used this month · unlimited`;
    }
    if (isPro) {
      return `${used}/${PRO_MONTHLY_SCAN_CAP} AI scans used this month · ${remaining} left`;
    }
    return profile?.hasUsedFreeItemizedScan
      ? 'Your one free AI scan has been used. Regular receipt logging stays free and unlimited.'
      : "1 free AI scan available. Regular receipt logging is always free and unlimited.";
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ padding: '24px', maxWidth: '420px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={20} color="#6366f1" />
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Myser Pro</h2>
          </div>
          <button onClick={onClose} style={{ background: 'var(--bg-elevated)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading…</div>
        ) : (
          <>
            {/* Current plan + AI usage */}
            <div style={{
              background: isPaid ? 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(124,58,237,0.08))' : 'var(--bg-elevated)',
              border: isPaid ? '1px solid rgba(99,102,241,0.25)' : '1px solid var(--border)',
              borderRadius: '14px', padding: '14px', marginBottom: '18px',
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                Current plan
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {planName}
                {isExecutive && (
                  <span style={{
                    fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.5px',
                    background: '#6366f1', color: 'white', borderRadius: '4px', padding: '2px 6px',
                  }}>
                    UNLIMITED
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                {usageLine()}
              </div>

              {/* Usage bar — only meaningful where there's a cap to fill. */}
              {isPro && (
                <div style={{ marginTop: '10px', height: '6px', background: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, (used / PRO_MONTHLY_SCAN_CAP) * 100)}%`,
                    height: '100%',
                    background: remaining === 0 ? 'var(--danger, #dc2626)' : 'linear-gradient(90deg, #6366f1, #7c3aed)',
                  }} />
                </div>
              )}
            </div>

            {/* Owner-only diagnostic: raw call counts against the AI
                provider we use — never shown to regular users, and never
                names the provider (see itemized-scan.ts / geminiUsage.ts
                for exactly what this is and isn't — our own count, not the
                provider's real quota). */}
            {isExecutive && apiUsage && (
              <div style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border)', borderRadius: '12px', padding: '12px', marginBottom: '18px' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                  AI calls (internal count, not the provider's real limit)
                </div>
                <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  <div><strong>{apiUsage.today}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>today</span></div>
                  <div><strong>{apiUsage.thisMonth}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>this month</span></div>
                  <div><strong>{apiUsage.lifetime}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>lifetime</span></div>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '8px', lineHeight: 1.4 }}>
                  For the real free-tier limit, check the provider's own usage dashboard directly — there's no API to pull it into the app.
                </div>
              </div>
            )}

            {/* Plan features — the sales pitch is pointless for an account
                that already has everything unlimited. */}
            {!isExecutive && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '2px' }}>
                $5<span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}> / month</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '14px' }}>One plan. Cancel anytime.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {PRO_FEATURES.map((f) => (
                  <div key={f} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <Check size={16} color="#22c55e" style={{ flexShrink: 0, marginTop: '1px' }} />
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
            )}

            {!isPaid && (
              <button
                onClick={handleUpgradeClick}
                style={{
                  width: '100%', background: 'linear-gradient(135deg, #6366f1, #7c3aed)', color: 'white',
                  border: 'none', borderRadius: '14px', padding: '13px', fontSize: '0.95rem', fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}
              >
                <Sparkles size={16} />
                Upgrade to Pro
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
