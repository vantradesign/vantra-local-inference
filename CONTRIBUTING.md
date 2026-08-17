# Contributing to @vantra-design/local-inference

Thank you for considering a contribution. This project is maintained by
[Vantra Design](https://vantra.design) and welcomes issues, discussions,
and pull requests.

## Development setup

```bash
git clone https://github.com/vantradesign/vantra-local-inference.git
cd vantra-local-inference
pnpm install
pnpm run verify   # lint + typecheck + test + build
```

## Before submitting a PR

1. Run `pnpm run verify` — all four checks must pass.
2. Add a changeset: `pnpm run changeset` — describe your change.
3. If you're adding a new feature, add tests.
4. If you're fixing a bug, add a regression test.

## Code style

- TypeScript strict mode, no `any`.
- ESLint flat config — run `pnpm run lint:fix` before committing.
- No runtime dependencies unless strictly necessary and documented.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):
`feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`.

## License

By contributing, you agree that your contributions will be licensed
under the [Apache-2.0 License](./LICENSE).
