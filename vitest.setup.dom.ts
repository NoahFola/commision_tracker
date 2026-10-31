/**
 * Registers @testing-library/jest-dom matchers with Vitest.
 * Only relevant for tests that use the happy-dom environment
 * (the three UI test files); harmless everywhere else.
 */
import '@testing-library/jest-dom/vitest';
