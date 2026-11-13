import { process, type Options } from './algorithms';
import type { Picture } from './pixels';
self.onmessage = (event: MessageEvent<{ image: Picture; options: Options }>) => {
  try {
    const start = performance.now();
    const result = process(event.data.image, event.data.options);
    self.postMessage({ ...result, elapsed: performance.now() - start });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
