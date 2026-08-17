import { useCallback, useEffect } from 'react';
import { useQuoteStore, useTemplate, useQuote } from '../store/useQuoteStore';
import { useAuthStore } from '../store/useAuthStore';
import { acceptProposal, fetchAcceptance } from './api';

/**
 * Accepting the proposal is now an authenticated action: the session cookie
 * is the signature, so there is no second one-time code at this step.
 */
export function useAcceptance() {
  const template = useTemplate();
  const quote = useQuote();

  const acceptance = useQuoteStore((state) => state.acceptance);
  const accepting = useQuoteStore((state) => state.accepting);
  const acceptError = useQuoteStore((state) => state.acceptError);
  const setAccepting = useQuoteStore((state) => state.setAccepting);
  const setAcceptError = useQuoteStore((state) => state.setAcceptError);
  const setAcceptance = useQuoteStore((state) => state.setAcceptance);

  const status = useAuthStore((state) => state.status);

  // A returning client should see their acceptance, not an "Accept" button.
  useEffect(() => {
    if (status !== 'authenticated' || acceptance) return;
    let cancelled = false;
    fetchAcceptance(template.meta.proposalId).then((record) => {
      if (!cancelled && record) setAcceptance(record);
    });
    return () => {
      cancelled = true;
    };
  }, [status, acceptance, template.meta.proposalId, setAcceptance]);

  const accept = useCallback(async () => {
    setAccepting(true);
    try {
      const result = await acceptProposal({
        proposalId: template.meta.proposalId,
        total: quote.total,
        currency: quote.currency,
        lines: quote.lines.map((line) => ({
          id: line.id,
          name: line.name,
          amount: line.amount,
        })),
      });
      setAcceptance({ acceptedAt: result.acceptedAt ?? new Date().toISOString() });
      return true;
    } catch (error) {
      setAcceptError(
        error.status === 401
          ? 'Your session expired. Sign in again to accept.'
          : (error.message ?? 'Could not record your acceptance.')
      );
      return false;
    }
  }, [template.meta.proposalId, quote, setAccepting, setAcceptance, setAcceptError]);

  return { acceptance, accepting, acceptError, accept };
}

export default useAcceptance;
