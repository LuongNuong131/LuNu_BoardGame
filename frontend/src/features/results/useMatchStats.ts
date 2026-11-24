import { onMounted, onScopeDispose, ref } from 'vue';
import { errorMessage, fetchMatchStats, type MatchStats } from './results.api';

export function useMatchStats() {
  const stats = ref<MatchStats>();
  const loading = ref(true);
  const error = ref('');
  let request: AbortController | undefined;

  async function load() {
    request?.abort();
    const signal = (request = new AbortController()).signal;
    loading.value = true;
    error.value = '';
    try {
      const data = await fetchMatchStats(signal);
      if (!signal.aborted) stats.value = data;
    } catch (cause) {
      if (!signal.aborted) error.value = errorMessage(cause);
    } finally {
      if (!signal.aborted) loading.value = false;
    }
  }

  onMounted(load);
  onScopeDispose(() => request?.abort());
  return { stats, loading, error, load };
}
