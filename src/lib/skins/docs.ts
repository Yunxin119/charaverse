/** Selector cheat-sheet and starter CSS presets for the skin editor. */
export const SELECTOR_GROUPS: { label: string; items: { selector: string; desc: string }[] }[] = [
  { label: '整体布局', items: [
    { selector: '#cv_chat_root', desc: '整个聊天页面根容器（所有规则都会被限定在它里面）' },
    { selector: '#cv_background_image', desc: '聊天背景图层' },
    { selector: '#cv_background_overlay', desc: '背景遮罩层' },
    { selector: '#cv_chat_header', desc: '顶部栏容器' },
    { selector: '#cv_chat_body', desc: '消息主体滚动区域' },
    { selector: '#cv_messages_container', desc: '消息列表容器' },
  ] },
  { label: '顶部栏', items: [{ selector: '#cv_back_button', desc: '返回按钮' }] },
  { label: '消息气泡', items: [
    { selector: '.cv_message_row', desc: '消息行容器' },
    { selector: '.cv_message_row_ai / .cv_message_row_user', desc: 'AI / 用户消息行' },
    { selector: '.cv_message_bubble', desc: '所有消息气泡' },
    { selector: '.cv_ai_message_bubble', desc: 'AI 消息气泡' },
    { selector: '.cv_user_message_bubble', desc: '用户消息气泡' },
    { selector: '.cv_message_avatar', desc: '消息头像' },
    { selector: '.cv_ai_avatar / .cv_user_avatar', desc: 'AI / 用户头像' },
    { selector: '.cv_message_selected', desc: '被选中的消息气泡' },
    { selector: '.cv-markdown', desc: '气泡内的 Markdown 内容' },
  ] },
  { label: '输入框', items: [
    { selector: '#cv_chat_input_container', desc: '输入框外层容器' },
    { selector: '#cv_chat_input_box', desc: '输入框框体' },
    { selector: '#cv_chat_input_textarea', desc: '输入框文本域' },
    { selector: '#cv_send_button', desc: '发送 / 停止按钮' },
  ] },
  { label: '消息操作', items: [{ selector: '.cv_message_actions_box', desc: '消息操作按钮组' }] },
  { label: '视觉小说模式', items: [
    { selector: '#cv_chat_column[data-layout="novel"]', desc: '视觉小说模式下的聊天主列（用它限定只在该模式生效的规则）' },
    { selector: '#cv_background_image[data-source="avatar"]', desc: '用角色头像充当的背景（没有自定义背景时）' },
    { selector: '#cv_vn_stage', desc: '舞台（图片之上、对话框之下的整块区域）' },
    { selector: '#cv_vn_textbox', desc: '底部对话框' },
    { selector: '#cv_vn_nametag', desc: '对话框左上角的角色名牌' },
    { selector: '#cv_vn_user_line', desc: '对话框上方的用户台词' },
    { selector: '#cv_vn_text', desc: '对话框正文（角色回复）' },
    { selector: '#cv_vn_controls', desc: '对话框底部的操作行（切换候选 / 重新生成 / 续写 / 记录）' },
    { selector: '#cv_layout_button', desc: '顶部栏的布局切换按钮' },
  ] },
  { label: '评论区（电脑版）', items: [
    { selector: '#cv_chat_row', desc: '聊天列 + 评论栏的横向容器' },
    { selector: '#cv_chat_column', desc: '聊天主列' },
    { selector: '#cv_comments_panel', desc: '右侧评论栏（仅已发布角色）' },
    { selector: '#cv_comments_button', desc: '顶部栏的评论开关' },
  ] },
]

export const CSS_PRESETS: { name: string; css: string }[] = [
  { name: '紫色梦幻', css: `/* 紫色梦幻 */
#cv_chat_root { background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%) !important; }
#cv_background_overlay { background: linear-gradient(180deg, rgba(118,75,162,.1), rgba(102,126,234,.15)); }
#cv_chat_header > div { background: rgba(255,255,255,.75) !important; border-color: rgba(255,255,255,.5) !important; }
.cv_ai_message_bubble { background: linear-gradient(135deg,#fff 0%,#faf5ff 100%) !important; border: 1px solid rgba(168,85,247,.2) !important; box-shadow: 0 4px 20px rgba(168,85,247,.1); border-radius: 20px !important; color: #2d1b4e !important; }
.cv_user_message_bubble { background: linear-gradient(135deg,#667eea 0%,#764ba2 100%) !important; border-radius: 20px !important; box-shadow: 0 4px 15px rgba(102,126,234,.3); }
#cv_chat_input_box { background: rgba(255,255,255,.85) !important; box-shadow: none !important; }
#cv_send_button { background: linear-gradient(135deg,#667eea 0%,#764ba2 100%) !important; }
` },
  { name: '极简黑白', css: `/* 极简黑白 */
#cv_chat_root { background: #fafafa !important; color: #111 !important; }
#cv_chat_header > div { background: #fff !important; border: 1px solid #e5e5e5 !important; box-shadow: none !important; backdrop-filter: none; }
.cv_ai_message_bubble { background: #fff !important; border: 1px solid #e5e5e5 !important; border-radius: 6px !important; box-shadow: none !important; color: #111 !important; backdrop-filter: none; }
.cv_user_message_bubble { background: #000 !important; color: #fff !important; border-radius: 6px !important; box-shadow: none !important; }
#cv_chat_input_box { background: #f5f5f5 !important; border: 1px solid #e5e5e5 !important; border-radius: 10px !important; box-shadow: none !important; }
#cv_send_button { background: #000 !important; box-shadow: none !important; }
` },
  { name: '暖阳橙调', css: `/* 暖阳橙调 */
#cv_chat_root { background: linear-gradient(180deg, #fff4e6 0%, #ffe0b3 100%) !important; }
#cv_chat_header > div { background: rgba(255,244,230,.85) !important; border-color: rgba(255,153,51,.2) !important; }
.cv_ai_message_bubble { background: #fff !important; border: 1px solid rgba(255,153,51,.25) !important; border-radius: 18px 18px 18px 4px !important; box-shadow: 0 3px 15px rgba(255,153,51,.1); color: #4a2c0a !important; }
.cv_user_message_bubble { background: linear-gradient(135deg,#ff9a44 0%,#fc6076 100%) !important; border-radius: 18px 18px 4px 18px !important; box-shadow: 0 3px 12px rgba(252,96,118,.3); }
#cv_chat_input_box { background: rgba(255,244,230,.9) !important; }
#cv_send_button { background: linear-gradient(135deg,#ff9a44 0%,#fc6076 100%) !important; }
` },
  { name: '碳黑霓虹', css: `/* 碳黑霓虹 · 搭配深色美化卡 */
#cv_chat_root { background: #0c0c0e !important; color: #f5f7fa !important; }
#cv_background_overlay { background: radial-gradient(800px 400px at 50% -10%, rgba(255,204,153,.12), transparent 60%); }
#cv_chat_header > div { background: rgba(20,20,22,.85) !important; border: 1px solid rgba(255,204,153,.15) !important; color: #f5f7fa; }
.cv_ai_message_bubble { background: rgba(12,12,14,.8) !important; border: 1px solid rgba(255,204,153,.15) !important; border-radius: 14px !important; color: #f5f7fa !important; box-shadow: inset 0 1px 0 rgba(255,255,255,.04); }
.cv_user_message_bubble { background: rgba(255,204,153,.14) !important; border: 1px solid rgba(255,204,153,.35) !important; color: #ffcc99 !important; border-radius: 14px !important; box-shadow: none !important; }
.cv_message_avatar { border-radius: 8px !important; box-shadow: 0 0 0 1px rgba(255,204,153,.25) !important; }
#cv_chat_input_box { background: rgba(20,20,22,.9) !important; border: 1px solid rgba(255,204,153,.18) !important; box-shadow: none !important; color: #f5f7fa; }
#cv_chat_input_textarea { color: #f5f7fa !important; }
#cv_send_button { background: #ffcc99 !important; color: #1a1208 !important; box-shadow: 0 0 20px rgba(255,204,153,.35) !important; }
` },
]

export const SAMPLE_AI_MESSAGE = `雨还没停。*她把杯子往你那边推了推。*「你要是不急着走，我这儿还有半壶热茶——虽然不太会泡。」

<div style="margin-top:10px;padding:10px 12px;border-radius:12px;background:rgba(0,0,0,.35);border:1px solid rgba(255,204,153,.3);font-family:ui-monospace,Menlo,monospace;font-size:12px;color:#ffcc99;letter-spacing:.5px">
  <div style="opacity:.6;font-size:10px;letter-spacing:2px">STATUS</div>
  <div>☁ 冷雨 4°C · 02:45 · 好感 ▮▮▮▯▯</div>
</div>`
