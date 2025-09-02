'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Download, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BeforeInstallPromptEvent extends Event {
  platforms: string[]
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  prompt(): Promise<void>
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // 检查是否已经是PWA模式或已安装
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    const isInWebAppiOS = (window.navigator as any).standalone === true
    
    if (isStandalone || isInWebAppiOS) {
      setIsInstalled(true)
      return
    }

    // 监听 beforeinstallprompt 事件
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      
      // 延迟显示提示（可以根据用户行为来决定何时显示）
      setTimeout(() => {
        setShowPrompt(true)
      }, 3000)
    }

    // 监听应用安装事件
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setShowPrompt(false)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    try {
      await deferredPrompt.prompt()
      const choiceResult = await deferredPrompt.userChoice
      
      if (choiceResult.outcome === 'accepted') {
        console.log('用户接受了安装提示')
      } else {
        console.log('用户拒绝了安装提示')
      }
      
      setDeferredPrompt(null)
      setShowPrompt(false)
    } catch (error) {
      console.error('安装提示出错:', error)
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    // 24小时内不再显示
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString())
  }

  // 检查是否应该显示提示
  const shouldShowPrompt = () => {
    if (isInstalled || !showPrompt || !deferredPrompt) return false
    
    const dismissed = localStorage.getItem('pwa-prompt-dismissed')
    if (dismissed) {
      const dismissedTime = parseInt(dismissed)
      const dayInMs = 24 * 60 * 60 * 1000
      if (Date.now() - dismissedTime < dayInMs) {
        return false
      }
    }
    
    return true
  }

  if (!shouldShowPrompt()) {
    return null
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 bg-white rounded-lg shadow-lg border border-slate-200 p-4 z-50"
      >
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 mb-1">
              安装 CharaVerse
            </h3>
            <p className="text-xs text-slate-600 mb-3">
              将应用安装到主屏幕，获得更好的使用体验，支持离线访问。
            </p>
            
            <div className="flex space-x-2">
              <Button
                size="sm"
                onClick={handleInstallClick}
                className="h-8 px-3 text-xs bg-blue-500 hover:bg-blue-600"
              >
                <Download className="w-3 h-3 mr-1" />
                安装
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                className="h-8 px-3 text-xs text-slate-500 hover:text-slate-700"
              >
                稍后
              </Button>
            </div>
          </div>
          
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            className="p-1 h-6 w-6 text-slate-400 hover:text-slate-600"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// iOS Safari 安装提示组件
export function IOSInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    // 检查是否是iOS Safari但不是PWA模式
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const isInWebApp = (window.navigator as any).standalone === true
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)
    
    if (isIOS && !isInWebApp && isSafari) {
      // 延迟显示提示
      setTimeout(() => {
        const dismissed = localStorage.getItem('ios-install-prompt-dismissed')
        if (!dismissed || Date.now() - parseInt(dismissed) > 7 * 24 * 60 * 60 * 1000) {
          setShowPrompt(true)
        }
      }, 5000)
    }
  }, [])

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('ios-install-prompt-dismissed', Date.now().toString())
  }

  if (!showPrompt) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        transition={{ duration: 0.3 }}
        className="fixed bottom-4 left-4 right-4 bg-white rounded-lg shadow-lg border border-slate-200 p-4 z-50"
      >
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 mb-1">
              添加到主屏幕
            </h3>
            <p className="text-xs text-slate-600 mb-2">
              点击下方分享按钮 <span className="font-mono text-blue-600">⏫</span>，然后选择"添加到主屏幕"来安装 CharaVerse
            </p>
            
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              className="h-8 px-3 text-xs text-slate-500 hover:text-slate-700"
            >
              我知道了
            </Button>
          </div>
          
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            className="p-1 h-6 w-6 text-slate-400 hover:text-slate-600"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}