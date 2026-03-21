import { createServer } from 'node:http';
import { createRequestListener } from './app';
import { loadConfig } from './config/env';

function bootstrap() {
  const config = loadConfig();
  const server = createServer(createRequestListener(config));

  server.listen(config.PORT, () => {
    console.log(
      JSON.stringify({
        level: config.LOG_LEVEL,
        event: 'forge_service_started',
        port: config.PORT,
        mode: config.FORGE_SERVICE_MODE
      })
    );
  });
}

bootstrap();
