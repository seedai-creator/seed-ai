import type {Instrumentation} from 'next';

export const onRequestError: Instrumentation.onRequestError = async () => {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.SEED_OPERATIONS_ENABLED === 'true') {
    const {recordServerFailure} = await import('./lib/operations/alert-worker');
    // Never serialize the error, headers, URL, query string or request body.
    await recordServerFailure('server', 'UNHANDLED_REQUEST');
  }
};
