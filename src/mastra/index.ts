import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';
import { Observability, MastraStorageExporter } from '@mastra/observability';
import { PinoLogger } from '@mastra/loggers';
import { DB_URL } from './lib/paths.ts';
import { reviewer } from './agents/reviewer.ts';
import { stormReview } from './workflows/stormReview.ts';

// The Mastra instance. `mastra dev` (Studio) discovers this export.
// - storage: LibSQL at an ABSOLUTE file url so suspended runs survive a restart
//   and the serve/resume processes open the same sqlite file.
// - observability: spans are exported to storage so the trace shows in Studio.
export const mastra = new Mastra({
  storage: new LibSQLStore({ id: 'storm-review', url: DB_URL }),
  agents: { reviewer },
  workflows: { stormReview },
  logger: new PinoLogger({ name: 'storm-review', level: 'info' }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'storm-review',
        exporters: [new MastraStorageExporter()],
      },
    },
  }),
});
