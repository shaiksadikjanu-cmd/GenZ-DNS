// Storage factory — single entry point.
// To add a new backend later, this is the ONLY file that changes.

import { FirestoreAdapter } from './FirestoreAdapter.js';

let _instance = null;

export function getStorage(config = {}) {
  if (_instance) return _instance;
  _instance = new FirestoreAdapter(config);
  return _instance;
}

export function resetStorage() {
  _instance = null;
}
