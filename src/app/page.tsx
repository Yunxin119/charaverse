'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { 
  Users, 
  MessageSquare, 
  Sparkles, 
  Plus,
  TrendingUp,
  Clock,
  Heart,
  Zap,
  Edit,
  MessageCircle
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAppSelector } from './store/hooks'

export default function DashboardPage() {
  const { user, loading } = useAppSelector((state) => state.auth)
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  if (loading) {
    return null // AuthCheck component will handle loading state
  }

  if (!user) {
    return null // Will redirect to login
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        duration: 0.3
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4 }
    }
  }

  const stats = [
    {
      title: "我的角色",
      value: "3",
      description: "已创建的AI角色",
      icon: Users,
      color: "from-blue-500 to-cyan-500",
      href: "/characters"
    },
    {
      title: "对话次数",
      value: "12",
      description: "本月聊天次数",
      icon: MessageSquare,
      color: "from-green-500 to-emerald-500",
      href: "/chat"
    },
    {
      title: "获得点赞",
      value: "8",
      description: "角色收获的点赞",
      icon: Heart,
      color: "from-pink-500 to-rose-500",
      href: "/characters"
    },
    {
      title: "创作灵感",
      value: "∞",
      description: "无限的可能性",
      icon: Sparkles,
      color: "from-purple-500 to-violet-500",
      href: "/characters/new"
    }
  ]

  const recentCharacters = [
    {
      id: 1,
      name: "艾莉亚",
      description: "温柔的精灵法师",
      avatar: "/placeholder-character-1.jpg",
      lastChat: "2小时前",
      isPublic: true
    },
    {
      id: 2,
      name: "雷克斯",
      description: "勇敢的龙骑士",
      avatar: "/placeholder-character-2.jpg",
      lastChat: "1天前",
      isPublic: false
    },
    {
      id: 3,
      name: "露娜",
      description: "神秘的占星师",
      avatar: "/placeholder-character-3.jpg",
      lastChat: "3天前",
      isPublic: true
    }
  ]

  const quickActions = [
    {
      title: "创建新角色",
      description: "开始你的新故事",
      icon: Plus,
      href: "/characters/new",
      color: "bg-slate-900 hover:bg-slate-800"
    },
    {
      title: "浏览社区",
      description: "发现精彩角色",
      icon: TrendingUp,
      href: "/explore",
      color: "bg-blue-600 hover:bg-blue-700"
    },
    {
      title: "继续对话",
      description: "与角色聊天",
      icon: Zap,
      href: "/chat",
      color: "bg-green-600 hover:bg-green-700"
    }
  ]

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* Welcome Section */}
      <motion.div variants={itemVariants}>
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-8 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
          <div className="relative z-10">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-bold">欢迎回到 CharaVerse</h2>
                <p className="text-slate-300 mt-2">在你的AI角色宇宙中继续创作和探索</p>
              </div>
            </div>
            <div className="mt-6 flex space-x-4">
              <Link href="/characters/new">
                <Button className="bg-white text-slate-900 hover:bg-slate-100">
                  <Plus className="w-4 h-4 mr-2" />
                  创建角色
                </Button>
              </Link>
              <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
                <MessageSquare className="w-4 h-4 mr-2" />
                开始聊天
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <motion.div key={stat.title} variants={itemVariants}>
              <Link href={stat.href}>
                <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 group-hover:text-slate-900 transition-colors">
                          {stat.title}
                        </p>
                        <p className="text-3xl font-bold text-slate-900 mt-2">
                          {stat.value}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {stat.description}
                        </p>
                      </div>
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Characters */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>最近的角色</CardTitle>
                  <CardDescription>你最近创建和使用的AI角色</CardDescription>
                </div>
                <Link href="/characters">
                  <Button variant="outline" size="sm">查看全部</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentCharacters.map((character) => (
                  <div key={character.id} className="flex items-center space-x-4 p-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={character.avatar} />
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                        {character.name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {character.name}
                        </p>
                        {character.isPublic && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            公开
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 truncate">
                        {character.description}
                      </p>
                    </div>
                    <div className="flex items-center text-xs text-slate-400">
                      <Clock className="w-3 h-3 mr-1" />
                      {character.lastChat}
                    </div>
                    <div className="flex space-x-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/characters/${character.id}/edit`}>
                          <Edit className="w-4 h-4 mr-2" />
                          编辑
                        </Link>
                      </Button>
                      <Button asChild size="sm">
                        <Link href={`/chat/new?characterId=${character.id}`}>
                          <MessageCircle className="w-4 h-4 mr-2" />
                          开始聊天
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle>快速操作</CardTitle>
              <CardDescription>常用功能快速访问</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {quickActions.map((action) => {
                  const Icon = action.icon
                  return (
                    <Link key={action.title} href={action.href}>
                      <Button 
                        className={`w-full justify-start h-auto p-4 ${action.color} text-white`}
                        variant="default"
                      >
                        <Icon className="w-5 h-5 mr-3" />
                        <div className="text-left">
                          <div className="font-medium">{action.title}</div>
                          <div className="text-xs opacity-90">{action.description}</div>
                        </div>
                      </Button>
                    </Link>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  )
}
