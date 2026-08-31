import { apiRequest } from './api'

export type HealthResponse = {
  status: string
}

export function getHealth() {
  return apiRequest<HealthResponse>('/api/v1/health')
}
