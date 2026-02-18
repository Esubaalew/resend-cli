import { spyOn } from 'bun:test';

export class ExitError extends Error {
  constructor(public code: number) {
    super(`process.exit(${code})`);
  }
}

export function setNonInteractive(): void {
  Object.defineProperty(process.stdin, 'isTTY', { value: undefined, writable: true });
  Object.defineProperty(process.stdout, 'isTTY', { value: undefined, writable: true });
}

export function mockExitThrow(): ReturnType<typeof spyOn> {
  return spyOn(process, 'exit').mockImplementation((code?: number) => {
    throw new ExitError(code ?? 0);
  });
}
