'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface StickerGuideProps {
  isOpen: boolean
  onClose: () => void
}

export default function StickerGuide({ isOpen, onClose }: StickerGuideProps) {
  const [currentStep, setCurrentStep] = useState(0)

  const steps = [
    {
      title: '🎉 表情包系统升级！',
      content: (
        <div className="space-y-3">
          <p>我们为你带来了更丰富的表情包体验：</p>
          <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
            <li>• 100+ 精选 emoji 表情</li>
            <li>• 自定义表情包上传</li>
            <li>• 智能最近使用记录</li>
            <li>• 一键删除管理</li>
          </ul>
        </div>
      )
    },
    {
      title: '😊 丰富的 Emoji',
      content: (
        <div className="space-y-3">
          <p>表情标签页包含超过100个精心分类的emoji：</p>
          <div className="grid grid-cols-8 gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            {['😀', '😂', '🥰', '😎', '🤔', '😢', '😠', '🥳', '❤️', '🔥', '✨', '👍', '👏', '🙏', '💪', '🎉'].map(emoji => (
              <span key={emoji} className="text-2xl text-center">{emoji}</span>
            ))}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            点击任意emoji直接发送到聊天中
          </p>
        </div>
      )
    },
    {
      title: '📁 自定义表情包',
      content: (
        <div className="space-y-3">
          <p>在"贴图"标签页中上传你的专属表情包：</p>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-center mb-3">
              <div className="w-16 h-16 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center">
                📁
              </div>
            </div>
            <p className="text-sm text-center text-gray-600 dark:text-gray-300">
              点击"上传表情包"按钮选择图片
            </p>
          </div>
          <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
            <li>• 支持 JPG、PNG、GIF 格式</li>
            <li>• 文件大小不超过 5MB</li>
            <li>• 可同时上传多个文件</li>
            <li>• 悬停显示删除按钮</li>
          </ul>
        </div>
      )
    },
    {
      title: '⏰ 最近使用',
      content: (
        <div className="space-y-3">
          <p>"最近"标签页自动记录你的表情包使用：</p>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="flex justify-center space-x-2 mb-2">
              {['😊', '👍', '🔥'].map(emoji => (
                <span key={emoji} className="text-2xl bg-white dark:bg-gray-600 rounded-lg p-2">{emoji}</span>
              ))}
            </div>
            <p className="text-xs text-center text-gray-500">
              最近使用的表情包
            </p>
          </div>
          <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
            <li>• 最多保存 20 个最近使用</li>
            <li>• 按使用时间排序</li>
            <li>• 包含 emoji 和自定义表情包</li>
          </ul>
        </div>
      )
    }
  ]

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full"
          onClick={e => e.stopPropagation()}
        >
          {/* 头部 */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              表情包使用指南
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 内容 */}
          <div className="p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  {steps[currentStep].title}
                </h3>
                <div className="text-gray-700 dark:text-gray-300">
                  {steps[currentStep].content}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* 底部导航 */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex space-x-2">
              {steps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentStep(index)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentStep 
                      ? 'bg-blue-500' 
                      : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center space-x-3">
              {currentStep > 0 && (
                <button
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition-colors"
                >
                  上一步
                </button>
              )}
              
              {currentStep < steps.length - 1 ? (
                <button
                  onClick={() => setCurrentStep(currentStep + 1)}
                  className="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors"
                >
                  下一步
                </button>
              ) : (
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition-colors"
                >
                  开始使用
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}