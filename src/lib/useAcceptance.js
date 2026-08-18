import { useCallback, useEffect } from 'react';
import { useQuoteStore, useTemplate, useQuote } from '../store/useQuoteStore';
import { useAuthStore } from '../store/useAuthStore';
import { useHubStore } from '../store/useHubStore';
import { acceptProposal, fetchAcceptance, isOfflineFallback } from './api';

/**
 * Принятие предложения — действие авторизованного пользователя: подписью
 * служит сессия, отдельный одноразовый код здесь не нужен.
 *
 * После записи согласия проект сразу публикуется в Центре проектов, и
 * пользователь переходит туда: принятое предложение без доски исполнителей
 * было бы тупиком.
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

  const publish = useHubStore((state) => state.publish);
  const setView = useHubStore((state) => state.setView);
  const projectId = useHubStore((state) => state.projectId);

  // Вернувшийся клиент должен видеть своё согласие, а не кнопку «Принять».
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

  /** Публикует принятую конфигурацию на доске исполнителей. */
  const publishProject = useCallback(async () => {
    const weeks = Number.parseInt(template.basePackage.timeline, 10);
    return publish({
      proposalId: template.meta.proposalId,
      title: template.client.projectTitle,
      summary: template.client.summary,
      budget: quote.total,
      currency: quote.currency,
      weeks: Number.isFinite(weeks) ? weeks : null,
      lines: quote.lines.map((line) => ({
        id: line.id,
        name: line.name,
        amount: line.amount,
      })),
    });
  }, [publish, template, quote]);

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
      await publishProject();
      setView('hub');
      return true;
    } catch (error) {
      // Показываем настоящую причину: «что-то пошло не так» здесь бесполезно.
      const detail =
        error.status === 401
          ? 'Сессия истекла. Войдите заново, чтобы принять предложение.'
          : error.code === 'network'
            ? 'Не получилось связаться с сервером. Проверьте, что он запущен, и повторите.'
            : (error.message ?? 'Не удалось записать согласие.');
      console.error('[accept] не удалось принять предложение:', error);
      setAcceptError(detail);
      return false;
    }
  }, [template, quote, setAccepting, setAcceptance, setAcceptError, publishProject, setView]);

  /** Кнопка «Открыть Центр проектов» для уже принятого предложения. */
  const openHub = useCallback(async () => {
    if (!projectId) await publishProject();
    setView('hub');
  }, [projectId, publishProject, setView]);

  return { acceptance, accepting, acceptError, accept, openHub, offline: isOfflineFallback() };
}

export default useAcceptance;
