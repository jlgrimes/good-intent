import cors from 'cors';
import express from 'express';
import { createStore, type GoodIntentStore } from './store';
import { buildIdpSchemaManifest } from './idp-schema';
import { listIdpExamples } from './idp-examples';
import { buildApiContractManifest } from './api-contract';

export type CreateAppOptions = {
  initialize?: () => void;
  store?: GoodIntentStore;
};

export function createApp(options: CreateAppOptions = {}) {
  const store = options.store ?? createStore();
  (options.initialize ?? (() => store.ensureInitialized()))();
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/org', (_req, res) => {
    res.json({ agents: store.getOrg() });
  });

  app.get('/intents', (_req, res) => {
    res.json({ intents: store.listIntentViews() });
  });

  app.post('/intents', (req, res) => {
    if (!req.body?.text?.trim()) {
      return res.status(400).json({ error: 'text is required' });
    }

    const intent = store.createIntent({
      text: req.body.text.trim(),
      urgency: req.body.urgency,
      project: req.body.project,
      constraints: req.body.constraints
    });

    return res.status(201).json({ intent });
  });

  app.post('/intents/submit', (req, res) => {
    if (!req.body?.text?.trim()) {
      return res.status(400).json({ error: 'text is required' });
    }

    try {
      const intent = store.createIntent({
        text: req.body.text.trim(),
        urgency: req.body.urgency,
        project: req.body.project,
        constraints: req.body.constraints
      });
      const result = store.routeStoredIntent(intent.id);
      if (!result) {
        return res.status(500).json({ error: 'intent created but route failed' });
      }

      return res.status(201).json(result);
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : 'submit failed' });
    }
  });

  app.post('/intents/:id/route', (req, res) => {
    try {
      const result = store.routeStoredIntent(req.params.id);
      if (!result) {
        return res.status(404).json({ error: 'intent not found' });
      }

      return res.json(result);
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : 'route failed' });
    }
  });

  app.get('/intents/:id', (req, res) => {
    const view = store.getIntentView(req.params.id);
    if (!view) {
      return res.status(404).json({ error: 'intent not found' });
    }

    return res.json(view);
  });

  app.get('/idp/schema', (_req, res) => {
    return res.json(buildIdpSchemaManifest());
  });

  app.get('/idp/examples', (_req, res) => {
    return res.json({ version: 'idp.v0', examples: listIdpExamples() });
  });

  app.get('/api/contract', (_req, res) => {
    return res.json(buildApiContractManifest());
  });

  app.get('/dispatch-records', (req, res) => {
    const runId = typeof req.query.runId === 'string' ? req.query.runId : undefined;
    const refresh = req.query.refresh === '1' || req.query.refresh === 'true';

    if (refresh && runId) {
      store.refreshDispatchRecordsForRun(runId);
    }

    return res.json(store.listDispatchRecords({
      intentId: typeof req.query.intentId === 'string' ? req.query.intentId : undefined,
      runId,
      orderId: typeof req.query.orderId === 'string' ? req.query.orderId : undefined
    }));
  });

  app.post('/dispatch-records/refresh', (req, res) => {
    const filters = {
      intentId: typeof req.body?.intentId === 'string' ? req.body.intentId : undefined,
      runId: typeof req.body?.runId === 'string' ? req.body.runId : undefined,
      orderId: typeof req.body?.orderId === 'string' ? req.body.orderId : undefined
    };

    if (!filters.intentId && !filters.runId && !filters.orderId) {
      return res.status(400).json({ error: 'intentId, runId, or orderId is required' });
    }

    const result = store.refreshDispatchRecords(filters);
    return res.json(result);
  });

  app.post('/dispatch-records/:id/refresh', (req, res) => {
    const record = store.refreshDispatchRecord(req.params.id);
    if (!record) {
      return res.status(404).json({ error: 'dispatch record not found' });
    }

    return res.json({ dispatchRecord: record });
  });

  app.get('/intents/:id/idp-export', (req, res) => {
    const exportPayload = store.getIntentIdpExport(req.params.id);
    if (!exportPayload) {
      return res.status(404).json({ error: 'intent not found' });
    }

    return res.json(exportPayload);
  });

  app.post('/delegation-runs/:id/actions', (req, res) => {
    const action = req.body?.action;
    if (!action || !['delegate', 'escalate', 'block', 'complete', 'needs_input', 'reply_to_input'].includes(action)) {
      return res.status(400).json({ error: 'valid action is required' });
    }

    const result = store.applyDelegationAction(req.params.id, {
      action,
      toAgentId: req.body?.toAgentId,
      summary: req.body?.summary,
      needsInput: req.body?.needsInput,
      artifactRefs: req.body?.artifactRefs
    });

    if (!result) {
      return res.status(404).json({ error: 'delegation run not found' });
    }

    if ('error' in result) {
      return res.status(400).json(result);
    }

    return res.json(result);
  });

  return app;
}
