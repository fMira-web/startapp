import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useMemo } from 'react';
import { proposalTemplate } from '../data/proposalTemplate';

/* ------------------------------------------------------------------ */
/* Initial selection state, derived from the template                  */
/* ------------------------------------------------------------------ */

function buildInitialSelections(template) {
  const toggles = {};
  const quantities = {};
  const tiers = {};

  for (const section of template.sections) {
    if (section.kind === 'toggles') {
      for (const item of section.items) {
        toggles[item.id] = Boolean(item.defaultOn);
      }
    }
    if (section.kind === 'quantities') {
      for (const item of section.items) {
        quantities[item.id] = clampQuantity(item, item.default ?? item.min ?? 0);
      }
    }
    if (section.kind === 'tier') {
      const fallback = section.options[0]?.id ?? null;
      tiers[section.id] = section.defaultOptionId ?? fallback;
    }
  }

  return { toggles, quantities, tiers };
}

function clampQuantity(item, value) {
  const min = item.min ?? 0;
  const max = item.max ?? Number.MAX_SAFE_INTEGER;
  const step = item.step ?? 1;
  const numeric = Number.isFinite(Number(value)) ? Number(value) : min;
  const snapped = Math.round((numeric - min) / step) * step + min;
  return Math.min(max, Math.max(min, snapped));
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

export const useQuoteStore = create()(
  persist(
    (set, get) => ({
      template: proposalTemplate,
      selections: buildInitialSelections(proposalTemplate),
      // Set once the signed-in client has accepted this configuration.
      acceptance: null, // { acceptedAt: string }
      accepting: false,
      acceptError: null,

      /* --- selection actions ---------------------------------------- */

      toggleItem: (itemId) =>
        set((state) => ({
          selections: {
            ...state.selections,
            toggles: {
              ...state.selections.toggles,
              [itemId]: !state.selections.toggles[itemId],
            },
          },
        })),

      setToggle: (itemId, value) =>
        set((state) => ({
          selections: {
            ...state.selections,
            toggles: { ...state.selections.toggles, [itemId]: Boolean(value) },
          },
        })),

      setQuantity: (itemId, value) =>
        set((state) => {
          const item = findQuantityItem(state.template, itemId);
          if (!item) return {};
          return {
            selections: {
              ...state.selections,
              quantities: {
                ...state.selections.quantities,
                [itemId]: clampQuantity(item, value),
              },
            },
          };
        }),

      stepQuantity: (itemId, direction) =>
        set((state) => {
          const item = findQuantityItem(state.template, itemId);
          if (!item) return {};
          const current = state.selections.quantities[itemId] ?? item.min ?? 0;
          const next = clampQuantity(item, current + direction * (item.step ?? 1));
          return {
            selections: {
              ...state.selections,
              quantities: { ...state.selections.quantities, [itemId]: next },
            },
          };
        }),

      selectTier: (sectionId, optionId) =>
        set((state) => ({
          selections: {
            ...state.selections,
            tiers: { ...state.selections.tiers, [sectionId]: optionId },
          },
        })),

      resetSelections: () =>
        set((state) => ({
          selections: buildInitialSelections(state.template),
        })),

      /* --- acceptance actions --------------------------------------- */

      setAccepting: (accepting) => set({ accepting, acceptError: accepting ? null : undefined }),
      setAcceptError: (acceptError) => set({ acceptError, accepting: false }),
      setAcceptance: (acceptance) => set({ acceptance, accepting: false, acceptError: null }),
      clearAcceptance: () => set({ acceptance: null, accepting: false, acceptError: null }),

      /* --- convenience ---------------------------------------------- */

      getQuote: () => computeQuote(get().template, get().selections),
    }),
    {
      name: `proposal-${proposalTemplate.meta.proposalId}`,
      version: 1,
      partialize: (state) => ({ selections: state.selections }),
      merge: (persisted, current) => {
        // Never trust a persisted shape blindly: an updated template must win.
        if (!persisted || typeof persisted !== 'object') return current;
        const base = buildInitialSelections(current.template);
        const saved = persisted.selections ?? {};
        return {
          ...current,
          selections: {
            toggles: { ...base.toggles, ...pickKnown(base.toggles, saved.toggles) },
            quantities: { ...base.quantities, ...pickKnown(base.quantities, saved.quantities) },
            tiers: { ...base.tiers, ...pickKnown(base.tiers, saved.tiers) },
          },
        };
      },
    }
  )
);

function pickKnown(reference, candidate) {
  if (!candidate || typeof candidate !== 'object') return {};
  const out = {};
  for (const key of Object.keys(reference)) {
    if (key in candidate) out[key] = candidate[key];
  }
  return out;
}

function findQuantityItem(template, itemId) {
  for (const section of template.sections) {
    if (section.kind !== 'quantities') continue;
    const match = section.items.find((item) => item.id === itemId);
    if (match) return match;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Pricing engine — pure, synchronous, no side effects                 */
/* ------------------------------------------------------------------ */

export function computeQuote(template, selections) {
  const lines = [];

  lines.push({
    id: template.basePackage.id,
    group: 'base',
    name: template.basePackage.name,
    detail: template.basePackage.timeline,
    amount: template.basePackage.price,
    removable: false,
  });

  let optionalCount = 0;

  for (const section of template.sections) {
    if (section.kind === 'toggles') {
      for (const item of section.items) {
        if (!selections.toggles[item.id]) continue;
        optionalCount += 1;
        lines.push({
          id: item.id,
          group: section.id,
          groupLabel: section.title,
          name: item.name,
          amount: item.price,
          removable: true,
          kind: 'toggle',
        });
      }
    }

    if (section.kind === 'quantities') {
      for (const item of section.items) {
        const qty = selections.quantities[item.id] ?? 0;
        if (qty <= 0) continue;
        optionalCount += 1;
        const unit = qty === 1 ? item.unitLabel : (item.unitLabelPlural ?? `${item.unitLabel}s`);
        lines.push({
          id: item.id,
          group: section.id,
          groupLabel: section.title,
          name: item.name,
          detail: `${qty} ${unit} × ${item.unitPrice.toLocaleString(template.meta.locale)}`,
          amount: qty * item.unitPrice,
          quantity: qty,
          removable: true,
          kind: 'quantity',
        });
      }
    }

    if (section.kind === 'tier') {
      const optionId = selections.tiers[section.id];
      const option = section.options.find((candidate) => candidate.id === optionId);
      if (!option) continue;
      if (option.price > 0) optionalCount += 1;
      lines.push({
        id: option.id,
        group: section.id,
        groupLabel: section.title,
        name: `${section.title} — ${option.name}`,
        amount: option.price,
        removable: false,
        kind: 'tier',
      });
    }
  }

  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);

  const appliedDiscounts = [];
  let discountTotal = 0;

  for (const discount of template.discounts ?? []) {
    if (!isDiscountActive(discount, { optionalCount })) continue;
    const amount =
      discount.type === 'percent'
        ? Math.round(subtotal * discount.value)
        : Math.min(discount.value, Math.max(0, subtotal - discountTotal));
    if (amount <= 0) continue;
    discountTotal += amount;
    appliedDiscounts.push({
      id: discount.id,
      label: discount.label,
      description: discount.description,
      amount,
      display: discount.type === 'percent' ? `${Math.round(discount.value * 100)}%` : null,
    });
  }

  const discountedSubtotal = Math.max(0, subtotal - discountTotal);
  const taxRate = template.tax?.rate ?? 0;
  const taxAmount = Math.round(discountedSubtotal * taxRate);
  const total = discountedSubtotal + taxAmount;

  const schedule = (template.payment?.schedule ?? []).map((entry) => ({
    ...entry,
    amount: Math.round(total * entry.share),
  }));

  return {
    lines,
    optionalCount,
    subtotal,
    appliedDiscounts,
    discountTotal,
    discountedSubtotal,
    taxRate,
    taxAmount,
    total,
    schedule,
    currency: template.meta.currency,
    locale: template.meta.locale,
  };
}

function isDiscountActive(discount, context) {
  const condition = discount.condition ?? {};
  if (condition.always) return true;
  if (typeof condition.minOptionalItems === 'number') {
    return context.optionalCount >= condition.minOptionalItems;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
/* ------------------------------------------------------------------ */

/** Recomputed synchronously on every selection change. */
export function useQuote() {
  const template = useQuoteStore((state) => state.template);
  const selections = useQuoteStore((state) => state.selections);
  return useMemo(() => computeQuote(template, selections), [template, selections]);
}

export function useTemplate() {
  return useQuoteStore((state) => state.template);
}

export default useQuoteStore;
