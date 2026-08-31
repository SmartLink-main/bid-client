import { apiRequest } from './api'
import type { AppUser } from './auth'

export type AdminUserListParams = {
  limit?: number
  offset?: number
}

export type AdminUserListResponse = {
  admin: AppUser
  items: AppUser[]
  limit: number
  offset: number
  total: number
}

export function getAdminUsers({
  limit = 50,
  offset = 0,
}: AdminUserListParams = {}) {
  const searchParams = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  })

  return apiRequest<AdminUserListResponse>(
    `/api/v1/admin/users?${searchParams}`,
    { auth: 'bearer' },
  )
}
