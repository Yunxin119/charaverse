'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Settings, Lock, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ApiPoolManager } from '../app/components/ApiPoolManager'
import { RelayServiceManager } from './RelayServiceManager'

interface ApiManagerModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ApiManagerModal({ isOpen, onClose }: ApiManagerModalProps) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Modal Content */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{
              type: 'spring',
              damping: 25,
              stiffness: 200,
              duration: 0.3
            }}
            className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 rounded-t-2xl shadow-2xl z-50 max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex-shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                      API 管理
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      管理你的AI模型接口配置
                    </p>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-9 w-9 p-0 rounded-full"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Quick Info */}
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex items-start space-x-2">
                  <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    API配置仅存储在本地设备，支持多个API轮询和故障转移
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6" style={{ maxHeight: 'calc(90vh - 200px)' }}>
              <div className="space-y-6 py-6">
                {/* API Pool Managers */}
                <div className="space-y-4">
                  <ApiPoolManager provider="deepseek" />
                  <ApiPoolManager provider="gemini" />
                  <ApiPoolManager provider="openai" />
                  <ApiPoolManager provider="custom" />
                </div>

                {/* 中转服务管理 */}
                <RelayServiceManager />

                {/* Help Section */}
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                  <h3 className="font-medium text-slate-900 dark:text-white mb-3 flex items-center">
                    <Lock className="w-4 h-4 mr-2" />
                    使用说明
                  </h3>
                  <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                    <div className="flex items-start space-x-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                      <p><strong>单个模式：</strong>只使用第一个激活的API</p>
                    </div>
                    <div className="flex items-start space-x-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 flex-shrink-0" />
                      <p><strong>多选模式：</strong>优先使用健康的API，故障时自动切换</p>
                    </div>
                    <div className="flex items-start space-x-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-2 flex-shrink-0" />
                      <p><strong>轮询模式：</strong>按优先级(数字越大优先级越高)轮流使用API</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 px-6 py-4">
              <div className="flex justify-end">
                <Button
                  onClick={onClose}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                >
                  完成
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}