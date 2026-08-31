import { useSyncExternalStore } from 'react'
import {
  getAuthSessionSnapshot,
  subscribeAuthSession,
} from '../lib/session'

export function useAuthSession() {
  return useSyncExternalStore(
    subscribeAuthSession,
    getAuthSessionSnapshot,
    () => null,
  )
}
