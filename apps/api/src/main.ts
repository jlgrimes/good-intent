import { createApp } from './server.js';

const port = Number(process.env.PORT ?? 4010);

createApp().listen(port, () => {
  console.log(`Good Intent API listening on http://localhost:${port}`);
});
