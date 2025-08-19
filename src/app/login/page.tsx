'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { signIn, signUp, clearError } from '../store/authSlice'
import { Loader2, Mail, Lock, User, Sparkles } from 'lucide-react'

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  const dispatch = useAppDispatch()
  const { user, loading, error } = useAppSelector((state) => state.auth)
  const router = useRouter()

  useEffect(() => {
    if (user) {
      router.push('/')
    }
  }, [user, router])

  useEffect(() => {
    return () => {
      dispatch(clearError())
    }
  }, [dispatch])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (isSignUp && password !== confirmPassword) {
      return
    }

    try {
      if (isSignUp) {
        await dispatch(signUp({ email, password, username })).unwrap()
      } else {
        await dispatch(signIn({ email, password })).unwrap()
      }
    } catch (err) {
      // Error is handled in the slice
    }
  }

  const containerVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.6,
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 0.4
      }
    }
  }

  const logoVariants = {
    hidden: { scale: 0.8, opacity: 0 },
    visible: { 
      scale: 1, 
      opacity: 1,
      transition: { 
        duration: 0.8,
        delay: 0.2
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-4">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-md"
      >
        {/* Logo and Title */}
        <motion.div 
          variants={logoVariants}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 mb-4 shadow-lg">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">CharaVerse</h1>
          <p className="text-slate-600">进入你的 AI 角色扮演宇宙</p>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardHeader className="space-y-4 pb-6">
              <div className="text-center">
                <CardTitle className="text-2xl font-semibold text-slate-900">
                  {isSignUp ? '创建账户' : '欢迎回来'}
                </CardTitle>
                <CardDescription className="text-slate-600 mt-2">
                  {isSignUp 
                    ? '开始你在 AI 宇宙中的旅程' 
                    : '登录以继续你的冒险'
                  }
                </CardDescription>
              </div>
            </CardHeader>
            
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <motion.div variants={itemVariants} className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                    邮箱地址
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-12 border-slate-200 focus:border-slate-400 focus:ring-slate-400 bg-white/50"
                      placeholder="your@email.com"
                      required
                    />
                  </div>
                </motion.div>

                {isSignUp && (
                  <motion.div 
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-2"
                  >
                    <Label htmlFor="username" className="text-sm font-medium text-slate-700">
                      用户名
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <Input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="pl-10 h-12 border-slate-200 focus:border-slate-400 focus:ring-slate-400 bg-white/50"
                        placeholder="设置你的用户名"
                        required={isSignUp}
                      />
                    </div>
                  </motion.div>
                )}

                <motion.div variants={itemVariants} className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                    密码
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 h-12 border-slate-200 focus:border-slate-400 focus:ring-slate-400 bg-white/50"
                      placeholder="输入您的密码"
                      required
                    />
                  </div>
                </motion.div>

                {isSignUp && (
                  <motion.div 
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-2"
                  >
                    <Label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">
                      确认密码
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10 h-12 border-slate-200 focus:border-slate-400 focus:ring-slate-400 bg-white/50"
                        placeholder="确认您的密码"
                        required
                      />
                    </div>
                    {isSignUp && password !== confirmPassword && confirmPassword && (
                      <p className="text-sm text-red-500">密码不匹配</p>
                    )}
                  </motion.div>
                )}

                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="bg-red-50 border border-red-200 rounded-lg p-3"
                  >
                    <p className="text-sm text-red-600">{error}</p>
                  </motion.div>
                )}

                <motion.div variants={itemVariants} className="space-y-4">
                  <Button
                    type="submit"
                    disabled={loading || (isSignUp && password !== confirmPassword)}
                    className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {isSignUp ? '创建账户中...' : '登录中...'}
                      </>
                    ) : (
                      <>
                        <User className="mr-2 h-4 w-4" />
                        {isSignUp ? '创建账户' : '登录'}
                      </>
                    )}
                  </Button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignUp(!isSignUp)
                        dispatch(clearError())
                        setConfirmPassword('')
                        setUsername('')
                      }}
                      className="text-sm text-slate-600 hover:text-slate-900 transition-colors duration-200"
                    >
                      {isSignUp 
                        ? '已有账户？立即登录' 
                        : '还没有账户？立即注册'
                      }
                    </button>
                  </div>
                </motion.div>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div 
          variants={itemVariants}
          className="mt-8 text-center text-sm text-slate-500"
        >
          <p>继续使用即表示您同意我们的服务条款</p>
        </motion.div>
      </motion.div>
    </div>
  )
} 