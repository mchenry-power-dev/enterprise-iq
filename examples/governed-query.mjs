import { currentWindow } from './authorized-context.mjs';

// Available in the supported Node runtime and browsers; identifiers convey no authority.
const randomUUID = () => globalThis.crypto.randomUUID();

/** Allowlisted mock templates, never caller-provided SQL or source identifiers. */
export const QUERY_TEMPLATES = Object.freeze(['credits-by-period']);
const TERMINAL = new Set(['succeeded', 'failed', 'cancelled', 'timed_out']);
const token = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, keys) => object(value) && Object.keys(value).length === keys.length &&
  keys.every(key => Object.hasOwn(value, key));
const failure = code => ({ status: 'rejected', error: { code } });
const iso = value => new Date(value).toISOString();

function validateParameters(parameters) {
  return exactKeys(parameters, ['period', 'entity']) && parameters.entity === 'aster-us' &&
    typeof parameters.period === 'string' && /^20\d{2}-(0[1-9]|1[0-2])$/.test(parameters.period);
}

function monthWindow(period) {
  const [year, month] = period.split('-').map(Number);
  return { start: `${period}-01`, end: `${period}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}` };
}

/** Project source data into this template's typed result contract, rejecting malformed evidence. */
function projectResult(result, parameters, maxRows, now) {
  const source = result?.contract;
  const period = monthWindow(parameters.period);
  if (!object(source) || !Array.isArray(result.rows) ||
      !['complete', 'partial'].includes(result.coverage) ||
      source.period?.start !== period.start || source.period?.end !== period.end ||
      source.entity !== 'Aster Manufacturing US' || source.grain !== 'entity-month' ||
      source.aggregation !== 'SUM' || !/^[A-Z]{3}$/.test(source.currency ?? '') ||
      !Array.isArray(source.filters) || source.filters.length !== 2 ||
      source.filters[0] !== 'country=US' || source.filters[1] !== 'status=posted' ||
      source.definition?.id !== 'period-credits' || !token(source.definition?.version) ||
      !currentWindow(source.freshness?.refreshedAt, source.freshness?.validUntil, iso(now)) ||
      !token(source.provenance?.fixtureId) || !token(source.provenance?.version) ||
      source.provenance?.platform !== 'Snowflake') throw new Error('Invalid source result.');
  const ids = new Set();
  for (const row of result.rows) {
    if (!object(row) || !token(row.creditId) || ids.has(row.creditId) ||
        !Number.isSafeInteger(row.amountCents) || row.amountCents < 0) {
      throw new Error('Invalid typed row.');
    }
    ids.add(row.creditId);
  }
  const truncated = result.rows.length > maxRows;
  const rows = result.rows.slice(0, maxRows).map(row => ({
    creditId: row.creditId, amountCents: row.amountCents,
  }));
  return {
    columns: [
      { name: 'creditId', type: 'string' },
      { name: 'amountCents', type: 'integer', unit: 'currency-minor-unit', currency: source.currency },
    ],
    contract: {
      period, currency: source.currency, entity: source.entity, grain: source.grain,
      filters: [...source.filters], aggregation: source.aggregation,
      definition: { id: source.definition.id, version: source.definition.version },
      freshness: { refreshedAt: source.freshness.refreshedAt, validUntil: source.freshness.validUntil },
      provenance: {
        fixtureId: source.provenance.fixtureId, platform: source.provenance.platform,
        version: source.provenance.version, execution: 'synthetic-mock',
      },
    },
    rows, rowCount: rows.length, coverage: truncated ? 'partial' : result.coverage, truncated,
    partialReasons: [
      ...(result.coverage === 'partial' ? ['source_partial'] : []),
      ...(truncated ? ['row_limit'] : []),
    ],
  };
}

/**
 * Synchronous, deterministic mock of asynchronous source execution. Polls advance its
 * state; no SQL, network, credentials, vendor API implementation or background work.
 * The injected source and outcome are trusted test controls, never submit parameters.
 */
export function createMockQueryExecutor({ readFixture, completeAfterPolls = 2, outcome = 'complete' } = {}) {
  if (typeof readFixture !== 'function' || !Number.isInteger(completeAfterPolls) ||
      completeAfterPolls < 1 || !['complete', 'partial', 'failed', 'hang'].includes(outcome)) {
    throw new TypeError('Invalid mock executor configuration.');
  }
  const jobs = new Map();
  let starts = 0;
  return {
    get starts() { return starts; },
    start({ templateId, parameters, context }) {
      if (!QUERY_TEMPLATES.includes(templateId) || !validateParameters(parameters)) {
        throw new Error('Unsupported mock template.');
      }
      const fixture = readFixture();
      const source = fixture?.source;
      if (source?.tenantId !== context.tenantId || source?.entityId !== parameters.entity ||
          source?.contract?.period?.start !== monthWindow(parameters.period).start) {
        throw new Error('Synthetic source unavailable.');
      }
      const handle = randomUUID();
      jobs.set(handle, { polls: 0, cancelled: false, source: structuredClone(source) });
      starts += 1;
      return handle;
    },
    poll(handle) {
      const job = jobs.get(handle);
      if (!job) throw new Error('Unknown source execution.');
      if (job.cancelled) return { status: 'cancelled' };
      job.polls += 1;
      if (outcome === 'hang' || job.polls < completeAfterPolls) return { status: 'running' };
      if (outcome === 'failed') return { status: 'failed', error: 'Untrusted source error detail.' };
      return { status: 'succeeded', result: {
        contract: job.source.contract, rows: job.source.rows,
        coverage: outcome === 'partial' ? 'partial' : 'complete',
      } };
    },
    cancel(handle) {
      const job = jobs.get(handle);
      if (job) job.cancelled = true;
    },
  };
}

/**
 * A server-side reference boundary. Trusted callbacks simulate authentication/current
 * policy. Do not expose them as browser claims. This is not production RLS or isolation.
 * In-memory idempotency lasts for this instance; a restart loses it. Polling drives mock
 * progress and deadlines. Production needs durable requests and source resource controls.
 */
export function createQuerySession({
  getTrustedContext, getPolicy, executor, clock = Date.now,
  maxRows = 100, maxPageSize = 25, timeoutMs = 30_000, maxExecutions = 128,
  // Trusted adapter hooks extend the template contract without accepting caller SQL.
  templates = QUERY_TEMPLATES, validateRequestParameters = validateParameters,
  projectSourceResult = projectResult, requiredColumns = () => ['creditId', 'amountCents'],
} = {}) {
  if (![getTrustedContext, getPolicy, clock, executor?.start, executor?.poll, executor?.cancel,
    validateRequestParameters, projectSourceResult, requiredColumns]
    .every(value => typeof value === 'function') ||
    !Array.isArray(templates) || !templates.length || templates.some(value => !token(value)) ||
    !Number.isInteger(maxRows) || maxRows < 1 || maxRows > 1_000 ||
    !Number.isInteger(maxPageSize) || maxPageSize < 1 || maxPageSize > 100 ||
    !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 300_000 ||
    !Number.isInteger(maxExecutions) || maxExecutions < 1 || maxExecutions > 1_000) {
    throw new TypeError('Invalid server query configuration.');
  }
  const executions = new Map();
  const requests = new Map();
  const cursors = new Map();
  let previousTime = -Infinity;

  function trusted() {
    try {
      const now = clock();
      const context = getTrustedContext();
      const policy = getPolicy();
      if (!Number.isFinite(now) || now < previousTime || now < 0 || now > 8.64e15 ||
          !token(context?.tenantId) || !token(context?.subjectId) ||
          !currentWindow(policy?.checkedAt, policy?.expiresAt, iso(now)) ||
          !Array.isArray(policy.grants)) return undefined;
      previousTime = now;
      const grants = policy.grants.filter(grant => grant?.tenantId === context.tenantId &&
        grant?.subjectId === context.subjectId);
      return { now, context: { tenantId: context.tenantId, subjectId: context.subjectId }, grants };
    } catch { return undefined; }
  }

  function permitted(auth, templateId, parameters, exporting = false) {
    return auth?.grants.some(grant =>
      Array.isArray(grant.templateIds) && grant.templateIds.includes(templateId) &&
      Array.isArray(grant.entities) && grant.entities.includes(parameters.entity) &&
      Array.isArray(grant.periods) && grant.periods.includes(parameters.period) &&
      Array.isArray(grant.columns) && requiredColumns(templateId).every(column => grant.columns.includes(column)) &&
      (!exporting || grant.allowExport === true));
  }

  function stop(execution, status, now, code) {
    if (TERMINAL.has(execution.status)) return;
    execution.status = status;
    execution.completedAt = iso(now);
    if (code) execution.error = { code };
  }

  function deadline(execution, now) {
    if (!TERMINAL.has(execution.status) && now >= execution.deadline) {
      stop(execution, 'timed_out', now, 'execution_timeout');
      try { executor.cancel(execution.handle); } catch { /* Failure details never escape. */ }
    }
  }

  function lookup(executionId, exporting = false) {
    const auth = trusted();
    const execution = executions.get(executionId);
    if (!execution || !auth || execution.owner.tenantId !== auth.context.tenantId ||
        execution.owner.subjectId !== auth.context.subjectId ||
        !permitted(auth, execution.templateId, execution.parameters, exporting)) return undefined;
    deadline(execution, auth.now);
    return { execution, auth };
  }

  function snapshot(execution) {
    return structuredClone({
      executionId: execution.id, status: execution.status, execution: 'synthetic-mock',
      submittedAt: execution.submittedAt,
      ...(execution.completedAt ? { completedAt: execution.completedAt } : {}),
      ...(execution.error ? { error: execution.error } : {}),
      ...(execution.result ? { result: {
        rowCount: execution.result.rowCount, coverage: execution.result.coverage,
        truncated: execution.result.truncated, partialReasons: execution.result.partialReasons,
      } } : {}),
    });
  }

  function ready(request, exporting = false) {
    const found = lookup(request.executionId, exporting);
    if (!found) return { rejected: failure('not_authorized_or_unavailable') };
    if (found.execution.status !== 'succeeded') return { rejected: failure('results_not_available') };
    if (!currentWindow(found.execution.result.contract.freshness.refreshedAt,
      found.execution.result.contract.freshness.validUntil, iso(found.auth.now))) {
      return { rejected: failure('results_stale') };
    }
    return found;
  }

  return {
    submit(request) {
      if (!exactKeys(request, ['requestId', 'templateId', 'parameters']) || !token(request.requestId) ||
          !templates.includes(request.templateId) || !validateRequestParameters(request.parameters, request.templateId)) {
        return failure('invalid_request');
      }
      const auth = trusted();
      if (!permitted(auth, request.templateId, request.parameters)) return failure('not_authorized_or_unavailable');
      const key = JSON.stringify([auth.context.tenantId, auth.context.subjectId, request.requestId]);
      const fingerprint = JSON.stringify([request.templateId, Object.keys(request.parameters).sort()
        .map(key => [key, request.parameters[key]])]);
      const prior = requests.get(key);
      if (prior) {
        if (prior.fingerprint !== fingerprint) return failure('idempotency_conflict');
        const execution = executions.get(prior.id);
        deadline(execution, auth.now);
        return snapshot(execution);
      }
      if (executions.size >= maxExecutions) return failure('session_capacity_reached');
      const execution = {
        id: randomUUID(), owner: auth.context, templateId: request.templateId,
        parameters: structuredClone(request.parameters), status: 'pending',
        submittedAt: iso(auth.now), deadline: auth.now + timeoutMs,
      };
      // Reserve the request before calling the executor. A thrown or uncertain start is
      // retained as failed, so retrying this request cannot issue a second source query.
      executions.set(execution.id, execution);
      requests.set(key, { id: execution.id, fingerprint });
      try {
        execution.handle = executor.start({ templateId: execution.templateId,
          parameters: structuredClone(execution.parameters), context: structuredClone(execution.owner) });
      } catch { stop(execution, 'failed', auth.now, 'source_execution_failed'); }
      return snapshot(execution);
    },
    poll(executionId) {
      const found = lookup(executionId);
      if (!found) return failure('not_authorized_or_unavailable');
      const { execution } = found;
      if (TERMINAL.has(execution.status)) return snapshot(execution);
      try {
        const update = executor.poll(execution.handle);
        // A completion observed at/after its deadline loses to timeout. Also recheck
        // policy after source execution before admitting returned evidence.
        const current = lookup(executionId);
        if (!current) return failure('not_authorized_or_unavailable');
        if (TERMINAL.has(execution.status)) return snapshot(execution);
        const { auth } = current;
        if (update?.status === 'succeeded') {
          execution.result = projectSourceResult(update.result, execution.parameters, maxRows, auth.now, execution.templateId);
          stop(execution, 'succeeded', auth.now);
        } else if (update?.status === 'running' || update?.status === 'pending') {
          // Once running, an older pending status must not regress the session.
          if (execution.status !== 'running') execution.status = update.status;
        } else if (update?.status === 'cancelled') {
          stop(execution, 'cancelled', auth.now);
        } else {
          stop(execution, 'failed', auth.now, 'source_execution_failed');
        }
      } catch { stop(execution, 'failed', found.auth.now, 'source_execution_failed'); }
      return snapshot(execution);
    },
    cancel(executionId) {
      const found = lookup(executionId);
      if (!found) return failure('not_authorized_or_unavailable');
      const { execution, auth } = found;
      if (!TERMINAL.has(execution.status)) {
        // This is local consumer cancellation, not proof a remote warehouse stopped.
        stop(execution, 'cancelled', auth.now);
        try { executor.cancel(execution.handle); } catch { /* Safe local terminal state remains. */ }
      }
      return snapshot(execution);
    },
    page(request) {
      if (!object(request) || Object.keys(request).some(key => !['executionId', 'pageSize', 'cursor'].includes(key)) ||
          typeof request.executionId !== 'string') return failure('invalid_request');
      const pageSize = request.pageSize ?? maxPageSize;
      if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > maxPageSize) return failure('invalid_page_size');
      const found = ready(request);
      if (found.rejected) return found.rejected;
      const { execution } = found;
      let offset = 0;
      if (Object.hasOwn(request, 'cursor')) {
        const cursor = cursors.get(request.cursor);
        if (!cursor || cursor.executionId !== execution.id || cursor.pageSize !== pageSize) return failure('invalid_cursor');
        offset = cursor.offset;
      }
      const result = execution.result;
      const rows = result.rows.slice(offset, offset + pageSize);
      let nextCursor = null;
      if (offset + rows.length < result.rowCount) {
        nextCursor = execution.pageCursors?.get(`${offset + rows.length}:${pageSize}`);
        if (!nextCursor) {
          nextCursor = randomUUID();
          execution.pageCursors ??= new Map();
          execution.pageCursors.set(`${offset + rows.length}:${pageSize}`, nextCursor);
          cursors.set(nextCursor, { executionId: execution.id, offset: offset + rows.length, pageSize });
        }
      }
      return structuredClone({
        status: 'available', executionId: execution.id, execution: 'synthetic-mock',
        ...result, rows, nextCursor,
      });
    },
    exportRows(executionId) {
      const found = ready({ executionId }, true);
      if (found.rejected) return found.rejected;
      return structuredClone({ status: 'available', executionId,
        execution: 'synthetic-mock', ...found.execution.result });
    },
  };
}
