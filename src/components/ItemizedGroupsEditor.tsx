'use client';

import { groupItems, ReceiptLineItem, ProposedTransactionGroup } from '@/lib/itemized-scan';

interface MinimalCategory { id: number; name: string; icon: string; }

interface ItemizedGroupsEditorProps {
  items: ReceiptLineItem[];
  categories: MinimalCategory[];
  fmt: (n: number) => string;
  onReassign: (itemIndex: number, newCategoryName: string) => void;
  onDrop: (itemIndex: number) => void;
}

/**
 * Renders the proposed category groups for an itemized receipt scan — one
 * card per group with its item list, each item reassignable to a different
 * category or removable. Purely presentational: the caller owns the actual
 * `items` array as state (see ShareReceiptModal.tsx) and recomputes groups
 * on every render via groupItems(); this component just draws that and
 * reports edits back up via onReassign/onDrop.
 *
 * A group whose category_id is null is one the AI proposed that doesn't
 * exist yet. Those are badged "NEW" rather than shown silently, so the
 * user can see exactly which categories saving would create — and can
 * reassign the items elsewhere first if they'd rather not create it.
 */
export default function ItemizedGroupsEditor({ items, categories, fmt, onReassign, onDrop }: ItemizedGroupsEditorProps) {
  const groups = groupItems(items, categories);

  // Proposed categories aren't in `categories` yet, so they'd be missing
  // from the reassign dropdown — leaving a select with no option matching
  // its own value. Append them so every group's current value is
  // selectable, and so items can be moved between two proposed categories.
  const proposedNames = groups.filter((g) => g.category_id === null).map((g) => g.category_name);
  const dropdownOptions = [
    ...categories.map((c) => ({ key: `id:${c.id}`, name: c.name, label: `${c.icon} ${c.name}` })),
    ...proposedNames.map((n) => ({ key: `new:${n}`, name: n, label: `✨ ${n} (new)` })),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {groups.map((group: ProposedTransactionGroup) => {
        const isNew = group.category_id === null;
        return (
          <div
            key={isNew ? `new:${group.category_name}` : `id:${group.category_id}`}
            style={{
              background: 'var(--bg-elevated)',
              borderRadius: '10px',
              padding: '10px',
              border: isNew ? '1px dashed var(--accent)' : '1px solid transparent',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '8px' }}>
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {isNew ? '✨' : categories.find((c) => c.id === group.category_id)?.icon} {group.category_name}
                </span>
                {isNew && (
                  <span style={{
                    flexShrink: 0, fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.5px',
                    background: 'var(--accent)', color: 'white', borderRadius: '4px', padding: '2px 5px',
                  }}>
                    NEW
                  </span>
                )}
              </span>
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', flexShrink: 0 }}>{fmt(group.amount)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {group.items.map((item: ReceiptLineItem) => {
                const itemIndex = items.indexOf(item);
                return (
                  <div key={itemIndex} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.item_name} {item.quantity > 1 ? `×${item.quantity}` : ''}
                    </span>
                    <span>{fmt(item.line_total)}</span>
                    <select
                      value={group.category_name}
                      onChange={(e) => onReassign(itemIndex, e.target.value)}
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '6px', padding: '2px 4px', fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif', maxWidth: '110px' }}
                    >
                      {dropdownOptions.map((o) => (
                        <option key={o.key} value={o.name}>{o.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => onDrop(itemIndex)}
                      title="Remove this item"
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem', padding: '0 2px' }}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
