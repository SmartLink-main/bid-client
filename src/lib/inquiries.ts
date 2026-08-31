import { apiRequest } from './api'

export type InquiryStatus = 'pending' | 'answered'

export type Inquiry = {
  id: string
  title: string
  content: string
  answer: string | null
  status: InquiryStatus
  created_at: string
  updated_at: string
  answered_at: string | null
}

export type InquiryListResponse = {
  total: number
  limit: number
  offset: number
  items: Inquiry[]
}

export type AdminInquiry = Inquiry & {
  user: {
    id: string
    login_id: string | null
    name: string | null
  }
}

export type AdminInquiryListResponse = {
  total: number
  limit: number
  offset: number
  items: AdminInquiry[]
}

export type InquiryListParams = {
  limit?: number
  offset?: number
  signal?: AbortSignal
}

export function createInquiry(
  payload: { title: string; content: string },
  signal?: AbortSignal,
) {
  return apiRequest<Inquiry>('/api/v1/inquiries', {
    method: 'POST',
    auth: 'bearer',
    body: JSON.stringify(payload),
    signal,
  })
}

export function getMyInquiries({
  limit = 50,
  offset = 0,
  signal,
}: InquiryListParams = {}) {
  const searchParams = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  })
  return apiRequest<InquiryListResponse>(
    `/api/v1/inquiries?${searchParams}`,
    { auth: 'bearer', signal },
  )
}

export function getAdminInquiries({
  limit = 50,
  offset = 0,
  signal,
}: InquiryListParams = {}) {
  const searchParams = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  })
  return apiRequest<AdminInquiryListResponse>(
    `/api/v1/admin/inquiries?${searchParams}`,
    { auth: 'bearer', signal },
  )
}

export function answerInquiry(inquiryId: string, answer: string) {
  return apiRequest<AdminInquiry>(
    `/api/v1/admin/inquiries/${encodeURIComponent(inquiryId)}/answer`,
    {
      method: 'PUT',
      auth: 'bearer',
      body: JSON.stringify({ answer }),
    },
  )
}
