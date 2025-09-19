import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { supabase, type User } from '../lib/supabase'

interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
}

// 从 localStorage 获取持久化的用户状态
const getInitialUser = (): User | null => {
  if (typeof window === 'undefined') return null
  try {
    const savedUser = localStorage.getItem('charaverse_user')
    return savedUser ? JSON.parse(savedUser) : null
  } catch {
    return null
  }
}

const initialState: AuthState = {
  user: getInitialUser(),
  loading: getInitialUser() === null, // 如果有持久化用户状态，则不需要 loading
  error: null,
}

// Async thunks for auth operations
export const signIn = createAsyncThunk(
  'auth/signIn',
  async ({ email, password }: { email: string; password: string }) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    if (error) throw error
    return data.user
  }
)

export const signUp = createAsyncThunk(
  'auth/signUp',
  async ({ email, password, username }: { email: string; password: string; username: string }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    
    if (error) throw error

    // 如果注册成功，创建用户资料
    if (data.user) {
      // 确保username不为空
      const trimmedUsername = username?.trim()
      if (!trimmedUsername) {
        throw new Error('用户名不能为空')
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          username: trimmedUsername,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      if (profileError) {
        console.error('创建用户资料失败:', profileError)
        // 抛出错误，因为没有用户资料会导致显示问题
        throw new Error('创建用户资料失败，请重试')
      }
    }

    return data.user
  }
)

export const signOut = createAsyncThunk('auth/signOut', async () => {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
})

export const checkAuth = createAsyncThunk('auth/checkAuth', async () => {
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      // Sign In
      .addCase(signIn.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(signIn.fulfilled, (state, action) => {
        state.loading = false
        state.user = action.payload
        // 持久化用户状态
        if (typeof window !== 'undefined' && action.payload) {
          localStorage.setItem('charaverse_user', JSON.stringify(action.payload))
        }
      })
      .addCase(signIn.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Sign in failed'
      })
      // Sign Up
      .addCase(signUp.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(signUp.fulfilled, (state, action) => {
        state.loading = false
        state.user = action.payload
        // 持久化用户状态
        if (typeof window !== 'undefined' && action.payload) {
          localStorage.setItem('charaverse_user', JSON.stringify(action.payload))
        }
      })
      .addCase(signUp.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Sign up failed'
      })
      // Sign Out
      .addCase(signOut.fulfilled, (state) => {
        state.user = null
        // 清除持久化的用户状态
        if (typeof window !== 'undefined') {
          localStorage.removeItem('charaverse_user')
        }
      })
      // Check Auth
      .addCase(checkAuth.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(checkAuth.fulfilled, (state, action) => {
        state.user = action.payload
        state.loading = false
        // 持久化用户状态
        if (typeof window !== 'undefined') {
          if (action.payload) {
            localStorage.setItem('charaverse_user', JSON.stringify(action.payload))
          } else {
            localStorage.removeItem('charaverse_user')
          }
        }
      })
      .addCase(checkAuth.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Authentication check failed'
      })
  },
})

export const { clearError } = authSlice.actions
export default authSlice.reducer 