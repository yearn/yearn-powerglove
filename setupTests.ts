import '@testing-library/jest-dom'

// Keep the constructor usable after individual suites restore their spies.
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
