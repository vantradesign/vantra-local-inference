# @vantra-design/local-inference

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![CI](https://github.com/vantradesign/vantra-local-inference/actions/workflows/ci.yml/badge.svg)](https://github.com/vantradesign/vantra-local-inference/actions/workflows/ci.yml)

Shared browser-side inference runtime for the [Vantra](https://vantra.design) tool suite. Provides WebGPU feature detection, a WebLLM engine wrapper, and a Kokoro TTS wrapper with progress reporting and Cache API integration.

## Install

```bash
pnpm add @vantra-design/local-inference
```

## Quick start

### WebGPU detection

```ts
import { isWebGPUAvailable, getGPUCapabilities } from '@vantra-design/local-inference'

if (isWebGPUAvailable()) {
  const caps = await getGPUCapabilities()
  console.log(caps?.estimatedVRAM) // 'low' | 'medium' | 'high'
}
```

### LLM inference

```ts
import { LocalLLMEngine } from '@vantra-design/local-inference'

const engine = new LocalLLMEngine({
  onProgress: (p) => console.log(`${p.percentage}%`),
})

await engine.init()

for await (const token of engine.generate('What is a design token?')) {
  process.stdout.write(token)
}

await engine.destroy()
```

### Text-to-speech

```ts
import { LocalTTS } from '@vantra-design/local-inference'

const tts = new LocalTTS({
  voice: 'af_heart',
  rate: 1.0,
  onProgress: (p) => console.log(`${p.percentage}%`),
})

await tts.init()
await tts.speak('Design systems reduce cognitive load.')
```

### Cache checking

```ts
import { LocalLLMEngine, LocalTTS } from '@vantra-design/local-inference'

const llmReady = await LocalLLMEngine.isCached()
const ttsReady = await LocalTTS.isCached()
```

## API

| Export | Description |
| --- | --- |
| `isWebGPUAvailable()` | Synchronous check for `navigator.gpu` |
| `getGPUCapabilities()` | Async adapter query returning limits and VRAM estimate |
| `LocalLLMEngine` | WebLLM wrapper: `init`, `generate` (async generator), `abort`, `destroy`, `isCached` |
| `LocalTTS` | Kokoro-js wrapper: `init`, `speak`, `pause`, `resume`, `stop`, `destroy`, `isCached` |
| `normalizeProgress()` | Clamp and normalize raw progress reports |
| `isCacheAPIAvailable()` | Check for Cache API |
| `hasCacheEntry()` | Check for a specific cache entry |
| `deleteCache()` | Delete an entire cache bucket |
| `InferenceError` | Structured error with `.code` field |

## Size budget

| Component | JS bundle (gzipped) | Runtime download | Cached? |
| --- | --- | --- | --- |
| This package | ~5 KB | — | — |
| WebLLM runtime | ~150 KB | — | — |
| Llama-3.2-1B-Instruct (q4f32_1) | — | ~500 MB | ✓ Cache API |
| Kokoro TTS | ~200 KB | ~82 MB | ✓ Cache API |

## Development

```bash
pnpm install
pnpm run verify   # lint + typecheck + test + build
```

## License

[Apache-2.0](./LICENSE)
