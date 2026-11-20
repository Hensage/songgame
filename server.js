import { assertConfig, loadConfig } from './src/config.js';
import { createServices } from './src/services.js';

async function main() {
  const config = loadConfig();
  assertConfig(config);

  const { app, store } = createServices(config);
  await store.load();
  store.startSweep();

  const server = app.listen(config.port, () => {
    const mode = config.stub ? 'stub' : 'Spotify';
    console.log(`Song Game listening on http://localhost:${config.port} (${mode} mode)`);
  });

  let shuttingDown = false;

  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received, shutting down`);

    store.stopSweep();
    server.closeIdleConnections();
    await new Promise((resolve) => server.close(resolve));
    await store.flush();
  }

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      shutdown(signal)
        .then(() => process.exit(0))
        .catch((error) => {
          console.error('Failed to shut down cleanly:', error);
          process.exit(1);
        });
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});