# @vantra-design/local-inference

## 0.3.0

### Minor Changes

- Add GenerateOptions to generate() for per-call maxTokens and temperature

## 0.2.0

### Minor Changes

- ca00885: Hardening release — no API changes, no new features.

  - Cross-package integration tests verify cache sharing between ask-design-system and screenreader-empathy
  - CSP `connect-src` allowlist verified and documented
  - README updated with real measured bundle sizes (2.7 KB gzipped)
  - Confirmed zero network calls after model download

## 0.1.0

### Minor Changes

- Initial release — WebGPU detection, LocalLLMEngine (WebLLM), LocalTTS (kokoro-js), Cache API helpers, progress normalization, structured errors.
