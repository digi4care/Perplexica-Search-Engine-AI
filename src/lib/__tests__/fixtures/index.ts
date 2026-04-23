/**
 * Test fixtures and mock factories for smoke tests.
 *
 * These are lightweight stubs that satisfy the shape of real dependencies
 * without hitting external services. They will evolve into proper port-interface
 * mocks as the hexagonal refactoring progresses.
 */
export { createMockSession } from './mockSession';
export { createMockSearchBackend } from './mockSearchBackend';
