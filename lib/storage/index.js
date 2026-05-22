// Storage factory — single entry point.
// When you add a new backend later, this file is the ONLY place to change.

import { FirestoreAdapter } from './FirestoreAdapter.js';

let _instance = null;

export function getStorage(config = {}) {
  if (_instance) return _instance;
  // Today: always Firestore. Tomorrow: read config.backend and switch.
  _instance = new FirestoreAdapter(config);
  return _instance;
}

// Reset cached instance — useful for tests or backend switches at runtime.
export function resetStorage() {
  _instance = null;
}
