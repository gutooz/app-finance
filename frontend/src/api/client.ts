import axios from 'axios'
import { useStore } from '../store/useStore'

const configuredApiUrl = import.meta.env.VITE_API_URL || ''
const isLocalApiUrl = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(configuredApiUrl)
const apiBaseURL = import.meta.env.DEV
  ? configuredApiUrl || 'http://localhost:8000'
  : isLocalApiUrl
    ? ''
    : configuredApiUrl

const api = axios.create({
  baseURL: apiBaseURL,
})

// Attach JWT to every request, reading from the persisted store
api.interceptors.request.use((config) => {
  const token = useStore.getState().session?.access_token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Auto-logout on 401
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      useStore.getState().clear()
    }
    return Promise.reject(err)
  }
)

export default api

// --- Auth ---
export const registerUser = (data: { email: string; password: string; name: string; monthly_income: number; gender?: 'male' | 'female' }) =>
  api.post('/auth/register', data).then(r => r.data)

export const loginUser = (data: { email: string; password: string }) =>
  api.post('/auth/login', data).then(r => r.data)

export const getMe = () => api.get('/auth/me').then(r => r.data)

export const updateProfile = (data: { name: string; monthly_income: number; gender?: 'male' | 'female' }) =>
  api.put('/auth/profile', data).then(r => r.data)

export const updateEmail = (email: string) =>
  api.put('/auth/email', { email }).then(r => r.data)

export const updatePassword = (password: string) =>
  api.put('/auth/password', { password }).then(r => r.data)

// --- Telegram ---
export const createTelegramLink = () =>
  api.post('/telegram/link-token').then(r => r.data as { token: string; bot_url: string; expires_in_minutes: number })

// --- WhatsApp ---
export const createWhatsAppLink = () =>
  api.post('/whatsapp/link-token').then(r => r.data as { token: string; message: string; whatsapp_url: string | null; expires_in_minutes: number })

export const getTelegramCompletionProfile = (token: string) =>
  api.get('/telegram/complete-profile', { params: { token } }).then(r => r.data)

export const completeTelegramProfile = (data: {
  token: string; email: string; password: string; name: string; monthly_income: number; gender?: 'male' | 'female'
}) => api.post('/telegram/complete-profile', data).then(r => r.data)

// --- Couple ---
export const createCouple = (split_mode: string) =>
  api.post('/couples/', { split_mode }).then(r => r.data)

export const joinCouple = (invite_token: string, split_mode: string) =>
  api.post('/couples/join', { invite_token, split_mode }).then(r => r.data)

export const getMyCouple = () => api.get('/couples/me').then(r => r.data)

// --- Expenses ---
export const addExpense = (coupleId: string | number, data: {
  paid_by_id?: string; amount: number; category: string
  description?: string; split_type: string; date?: string
}) => api.post(`/couples/${coupleId}/expenses/`, data).then(r => r.data)

export const getExpenses = (coupleId: string | number, month?: number, year?: number) =>
  api.get(`/couples/${coupleId}/expenses/`, { params: { month, year } }).then(r => r.data)

export const deleteExpense = (coupleId: string | number, id: string | number) =>
  api.delete(`/couples/${coupleId}/expenses/${id}`).then(r => r.data)

// --- Bills ---
export const addBill = (coupleId: string | number, data: { name: string; amount: number; due_day: number }) =>
  api.post(`/couples/${coupleId}/bills/`, data).then(r => r.data)

export const getBills = (coupleId: string | number, month?: number, year?: number) =>
  api.get(`/couples/${coupleId}/bills/`, { params: { month, year } }).then(r => r.data)

export const toggleBill = (coupleId: string | number, billId: string | number) =>
  api.post(`/couples/${coupleId}/bills/${billId}/pay`).then(r => r.data)

export const deleteBill = (coupleId: string | number, billId: string | number) =>
  api.delete(`/couples/${coupleId}/bills/${billId}`).then(r => r.data)

// --- Goals ---
export const createGoal = (coupleId: string | number, data: { name: string; target_amount: number; emoji?: string; deadline?: string }) =>
  api.post(`/couples/${coupleId}/goals/`, data).then(r => r.data)

export const getGoals = (coupleId: string | number) =>
  api.get(`/couples/${coupleId}/goals/`).then(r => r.data)

export const contributeGoal = (coupleId: string | number, goalId: string | number, data: { amount: number; note?: string }) =>
  api.post(`/couples/${coupleId}/goals/${goalId}/contribute`, data).then(r => r.data)

export const deleteGoal = (coupleId: string | number, goalId: string | number) =>
  api.delete(`/couples/${coupleId}/goals/${goalId}`).then(r => r.data)

// --- Summary ---
export const getSummary = (coupleId: string | number, month?: number, year?: number) =>
  api.get(`/couples/${coupleId}/summary/`, { params: { month, year } }).then(r => r.data)

// --- Admin ---
export const getAdminStats = () => api.get('/admin/stats').then(r => r.data)
