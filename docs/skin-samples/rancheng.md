<style>
    /* design by censy */
    /* 核心引擎参数：用户自定义控制台 */
    :root {
        --mufy-bg-brightness: 0.5;
        /* 亮度压暗，加深清冷深邃感 */
        --mufy-bg-blur: 12px;
        /* 增加背景模糊度 */
        --neon-orange: #ffcc99;
        /* 将橙色调浅调柔，呈现低饱和冷调氖光 */
        --cold-white: #f5f7fa;
        --dark-carbon: rgba(12, 12, 14, 0.8);
        /* 加深组件底色 */
        --glass-border: rgba(255, 204, 153, 0.15);
        /* 极细淡的玻璃边框，用于修饰组件 */
    }

    /* 文本级呼吸动画：取代边框发光 */
    @keyframes text-breathe {
        0% {
            text-shadow: 0 0 2px rgba(255, 204, 153, 0.1);
        }

        100% {
            text-shadow: 0 0 10px rgba(255, 204, 153, 0.5);
        }
    }

    /* 组件边缘微光动画 */
    @keyframes edge-pulse {
        0% {
            box-shadow: inset 0 0 0 1px rgba(255, 204, 153, 0.1);
        }

        100% {
            box-shadow: inset 0 0 0 1px rgba(255, 204, 153, 0.4), 0 0 8px rgba(255, 204, 153, 0.2);
        }
    }

    /* $8、聊天大背景包括电脑端 */
    #mufy_background_image {
        background-size: cover !important;
        background-position: center !important;
        filter: brightness(var(--mufy-bg-brightness)) !important;
        transition: filter 0.3s ease;
    }

    .relative.mx-auto.flex.h-full.min-h-0.w-full.flex-1.flex-col {
        backdrop-filter: blur(var(--mufy-bg-blur));
        background: linear-gradient(to bottom, rgba(5, 5, 8, 0.3), rgba(5, 5, 8, 0.7));
    }

    /* $1、对话标签 - 极简Message流重构 */
    .mufy_ai_message_bubble,
    .mufy_user_message_bubble {
        background: transparent !important;
        color: var(--neon-orange) !important;
        border: none !important;
        /* 彻底移除气泡边框 */
        box-shadow: none !important;
        /* 移除气泡阴影 */
        backdrop-filter: none !important;
        /* 移除气泡本体毛玻璃 */
        padding: 8px 4px !important;
        font-weight: 500 !important;
    }

    /* 隐藏AI气泡多余星星图标 */
    .rc-image-img.text-sm.text-muted-foreground.absolute.-left-\[6px\].-top-2.z-20.h-5.w-5.fill-\[\#FFCCE8\] {
        display: none !important;
    }

    /* AI正文文字：清冷白色 */
    p[node*="object"].text-white[dir="auto"] {
        color: var(--cold-white) !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        font-weight: 300 !important;
        line-height: 1.7;
        text-shadow: 0 0 2px rgba(245, 247, 250, 0.2);
    }

    /* 用户输入文字：浅橙色 + 呼吸发光 + 靠右对齐 */
    .mufy_user_message_bubble,
    .mufy_user_message_bubble p,
    .mufy_user_message_bubble span,
    .mufy_user_message_bubble div {
        color: var(--neon-orange) !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        letter-spacing: 0.2px !important;
        line-height: 1.7 !important;
        animation: text-breathe 3s infinite alternate !important;
    }

    /* 修改容器：底部输入框区域 */
    textarea.flex.rounded-xl.border.border-input {
        background: var(--dark-carbon) !important;
        border: 1px solid var(--glass-border) !important;
        color: var(--cold-white) !important;
        /* 打字时保持冷白 */
        border-radius: 8px !important;
        transition: all 0.3s ease !important;
    }

    textarea.flex.rounded-xl.border.border-input:focus {
        outline: none !important;
        border-color: rgba(255, 204, 153, 0.4) !important;
        box-shadow: 0 0 12px rgba(255, 204, 153, 0.1) !important;
    }

    /* 按钮组 */
    .space-x-2 button.bg-primary,
    .space-x-2 button.bg-secondary {
        background: transparent !important;
        border: 1px solid var(--glass-border) !important;
        border-radius: 6px !important;
        color: var(--neon-orange) !important;
        transition: all 0.3s ease;
    }

    .space-x-2 button.bg-primary:hover,
    .space-x-2 button.bg-secondary:hover {
        border-color: var(--neon-orange) !important;
        background: rgba(255, 204, 153, 0.05) !important;
    }

    /* $2、$3 偷看剧本按钮 */
    .group.flex.w-fit.cursor-pointer.select-none {
        background: var(--dark-carbon) !important;
        border: 1px solid var(--glass-border) !important;
        border-radius: 4px !important;
        transition: all 0.3s ease;
    }

    .group.flex.w-fit.cursor-pointer.select-none:hover {
        animation: edge-pulse 1.5s infinite alternate;
    }

    .group.flex.w-fit.cursor-pointer.select-none span {
        color: var(--neon-orange) !important;
        font-size: 12px !important;
        letter-spacing: 1px;
    }

    .bg-zinc-950.px-4:has(.animate-gradient) {
        background: var(--dark-carbon) !important;
        border: 1px solid var(--neon-orange) !important;
        box-shadow: 0 0 8px rgba(255, 204, 153, 0.2) !important;
    }

    /* $4、重说\模型\停止按钮 */
    div[class*="absolute"][class*="left-0"][class*="top-[-34px]"] {
        filter: grayscale(0.2);
    }

    #mufy_chat_input_replay_btn {
        font-size: 0 !important;
        background: var(--dark-carbon) !important;
        border: 1px solid var(--glass-border) !important;
        border-radius: 4px !important;
    }

    #mufy_chat_input_replay_btn::after {
        content: "R E L O A D";
        font-size: 9px;
        color: var(--cold-white);
        letter-spacing: 1px;
    }

    button[class*="relative"][class*="rounded-lg"] {
        border-radius: 4px !important;
    }

    #mufy_chat_input_model_btn {
        background: var(--dark-carbon) !important;
        border: 1px solid var(--glass-border) !important;
        border-radius: 4px !important;
    }

    #mufy_chat_input_model_btn span[class*="text-[#FFFFFFCC]"] {
        color: var(--neon-orange) !important;
        font-family: monospace;
    }

    .flex.items-center.gap-1.rounded-lg.bg-neutral-700\/50.px-3.py-1.text-sm.cursor-pointer.text-red-500 {
        background: rgba(255, 50, 50, 0.05) !important;
        font-size: 0 !important;
        border: 1px solid rgba(255, 50, 50, 0.3) !important;
        border-radius: 4px !important;
    }

    .flex.items-center.gap-1.rounded-lg.bg-neutral-700\/50.px-3.py-1.text-sm.cursor-pointer.text-red-500::after {
        content: "B R A K E";
        font-size: 9px;
        color: rgba(255, 100, 100, 0.8);
        letter-spacing: 1px;
    }

    .size-9.bg-red-400 {
        display: none !important;
    }

    /* 隐去停止按钮多余红圈 */
    #mufy_chat_input_replay_btn .lucide-rotate-ccw,
    .lucide.lucide-circle-stop.fill-red-900.text-red-400 {
        display: none !important;
    }

    div.pointer-events-none.absolute.inset-0>svg {
        display: none !important;
    }

    /* $5、厨子分享面板 */
    .flex.justify-center.pb-3 {
        padding-top: 15px;
    }

    #mufy_author_note {
        background: var(--dark-carbon) !important;
        border: 1px solid var(--glass-border) !important;
        border-radius: 4px !important;
        border-left: 2px solid var(--neon-orange) !important;
    }

    #mufy_author_note pre {
        color: var(--neon-orange) !important;
        font-family: monospace;
        opacity: 0.9;
    }

    /* $6、输入框和发送按钮 */
    #mufy_chat_input_box {
        background: transparent !important;
    }

    #mufy_chat_input_box .flex.h-7.w-7 svg {
        display: none !important;
    }

    #mufy_chat_input_box .flex.h-7.w-7 {
        background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23ffcc99" stroke-width="1.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>') center/cover no-repeat !important;
        opacity: 0.7;
        transition: opacity 0.3s, filter 0.3s;
    }

    #mufy_chat_input_box .flex.h-7.w-7:hover {
        opacity: 1;
        filter: drop-shadow(0 0 5px rgba(255, 204, 153, 0.5));
    }

    /* $7、顶栏角色头像与文字 */
    .flex.w-full.items-center.gap-2.rounded-2xl {
        background: transparent !important;
    }

    .flex.w-full.items-center span.relative.flex.h-10.w-10 {
        border-radius: 4px !important;
        border: 1px solid var(--glass-border) !important;
        clip-path: none !important;
    }

    .text-sm.font-bold.mufy-ellipsis {
        color: var(--neon-orange) !important;
        font-family: -apple-system, sans-serif;
        font-weight: 300 !important;
        letter-spacing: 2px;
        text-transform: uppercase;
        text-shadow: 0 0 4px rgba(255, 204, 153, 0.2);
    }

    .line-clamp-1.break-all.text-\[10px\].text-gray-300 {
        font-size: 0 !important;
    }

    .line-clamp-1.break-all.text-\[10px\].text-gray-300::after {
        content: "SYS. ONLINE";
        font-size: 8px;
        color: rgba(245, 247, 250, 0.4);
        font-family: monospace;
        letter-spacing: 1px;
    }

    /* $9、顶栏按钮手绘重构 - 极简线框圆形 */
    #mufy_chat_header {
        background: linear-gradient(180deg, rgba(12, 12, 14, 0.9) 0%, transparent 100%) !important;
        border-bottom: none !important;
    }

    #mufy_back_button svg,
    #mufy_header_message_btn svg,
    #mufy_header_more_btn svg,
    #mufy_header_clarity_btn svg,
    #mufy_header_follow_btn svg,
    #mufy_header_follow_btn span {
        display: none !important;
    }

    #mufy_header_follow_btn {
        font-size: 0 !important;
    }

    #mufy_back_button,
    #mufy_header_message_btn,
    #mufy_header_more_btn,
    #mufy_header_clarity_btn,
    #mufy_header_follow_btn {
        width: 32px !important;
        height: 32px !important;
        background-color: transparent !important;
        border: 1px solid var(--glass-border) !important;
        border-radius: 50% !important;
        margin: 0 4px !important;
        transition: all 0.3s ease;
    }

    #mufy_back_button:hover,
    #mufy_header_message_btn:hover,
    #mufy_header_more_btn:hover,
    #mufy_header_clarity_btn:hover,
    #mufy_header_follow_btn:hover {
        background-color: rgba(255, 204, 153, 0.05) !important;
        border-color: var(--neon-orange) !important;
    }

    #mufy_back_button {
        background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23f5f7fa" stroke-width="1.5"><path d="M15 18l-6-6 6-6"/></svg>') !important;
        background-size: 50% !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
    }

    #mufy_header_message_btn {
        background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23ffcc99" stroke-width="1.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>') !important;
        background-size: 45% !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
    }

    #mufy_header_more_btn {
        background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23f5f7fa" stroke-width="1.5"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>') !important;
        background-size: 50% !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
    }

    #mufy_header_clarity_btn {
        background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23f5f7fa" stroke-width="1.5"><path d="M2 12h4l3-9 5 18 3-9h5"/></svg>') !important;
        background-size: 50% !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
    }

    #mufy_header_follow_btn {
        background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23ffcc99" stroke-width="1.5"><path d="M12 2v20M5 9l7-7 7 7"/></svg>') !important;
        background-size: 50% !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
    }

    /* $10、$11 弹窗 - 磨砂玻璃框 */
    .absolute.right-0.top-\[38px\].isolate.z-interactive.flex.w-\[200px\].flex-col.gap-4.rounded-md.bg-\[\#28282F\].p-4.shadow-lg,
    .absolute.right-0.top-\[38px\].isolate.z-interactive.flex.h-\[91px\].w-\[137px\].flex-col.justify-center.rounded-md.bg-\[\#28282F\].shadow-lg {
        background: var(--dark-carbon) !important;
        border: 1px solid var(--glass-border) !important;
        border-radius: 8px !important;
        backdrop-filter: blur(20px);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5) !important;
    }

    .relative.h-1\.5.w-full.grow.overflow-hidden.rounded-full.bg-primary\/30 {
        background: rgba(255, 255, 255, 0.1) !important;
    }

    .absolute.h-full.bg-primary {
        background: var(--neon-orange) !important;
        box-shadow: 0 0 5px var(--neon-orange);
    }

    .p-4.shadow-lg .block.h-4.w-4.rounded-full.border.border-primary\/50.bg-background.shadow {
        background: #fff !important;
        border-color: var(--neon-orange) !important;
    }

    /* $12、操作菜单 */
    #mufy_message_actions_box {
        background: var(--dark-carbon) !important;
        border: 1px solid var(--glass-border) !important;
        backdrop-filter: blur(15px);
        border-radius: 6px !important;
    }

    #mufy_message_actions_btn {
        background: transparent !important;
    }

    /* $13、AI提示 */
    div[class*="z-dropdown"][class*="mx-auto"][class*="flex"][class*="rounded-md"] {
        background: var(--dark-carbon) !important;
        border: 1px solid var(--glass-border) !important;
        border-radius: 6px !important;
        backdrop-filter: blur(10px);
    }

    /* $14, 15, 16 手机端模型窗 */
    .fixed.inset-x-0.bottom-0.z-50.mt-24.h-auto {
        background: var(--dark-carbon) !important;
        border-top: 1px solid var(--glass-border) !important;
        backdrop-filter: blur(20px);
        border-radius: 16px 16px 0 0 !important;
    }

    div[role="radiogroup"]>div {
        background: rgba(255, 255, 255, 0.02) !important;
        border: 1px solid var(--glass-border) !important;
        border-radius: 8px !important;
    }

    div[role="radiogroup"]>div:has(button[data-state="checked"]) {
        border-color: var(--neon-orange) !important;
        background: rgba(255, 204, 153, 0.05) !important;
    }

    button[role="radio"][data-state="checked"] {
        background: var(--neon-orange) !important;
        border-color: var(--neon-orange) !important;
    }

    div.mb-4.text-lg.font-semibold {
        color: var(--cold-white) !important;
        font-weight: 300 !important;
        letter-spacing: 1px;
    }

    button.group.sticky.top-0.bg-background {
        background: transparent !important;
        backdrop-filter: blur(10px);
    }

    /* 隐藏文档流尸体补丁 */
    .prose iframe,
    [class*="message"] iframe,
    iframe[srcdoc] {
        min-height: 0 !important;
    }
</style>

<style>
/* design by censy - Cyber Cold Edition (Token Compressed) */
.c-p { position: relative; width: 100%; max-width: 420px; margin: 30px auto 0 auto; font-family: -apple-system, sans-serif; background: rgba(10, 10, 12, 0.4); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 204, 153, 0.08); border-radius: 4px; padding: 20px 10px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8); }
.c-hw { display: flex; flex-direction: column; align-items: center; margin-bottom: 25px; gap: 8px; }
.c-ah { text-align: center; z-index: 1; }
.c-ht { display: block; font-family: 'Arial Black', Impact, sans-serif; font-size: 24px; color: #ffffff; letter-spacing: 6px; text-shadow: 0 0 15px rgba(255, 255, 255, 0.2); animation: c-pulse 4s ease-in-out infinite alternate; }
.c-hs { display: block; margin-top: 4px; font-family: monospace; font-size: 11px; letter-spacing: 3px; color: #ffcc99; font-weight: 600; text-shadow: 0 0 8px rgba(255, 204, 153, 0.4); }
@keyframes c-pulse { from { text-shadow: 0 0 5px rgba(255, 255, 255, 0.1); } to { text-shadow: 0 0 15px rgba(255, 255, 255, 0.4), 0 0 2px rgba(255, 204, 153, 0.5); } }
.c-lt { position: relative; width: 100%; max-width: 420px; min-height: 40px; margin: 0 auto; padding: 8px 18px; box-sizing: border-box; color: #ffffff; border-top: 1px solid rgba(255, 204, 153, 0.15); border-bottom: 1px solid rgba(255, 204, 153, 0.1); display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.c-lt::before { content: ''; position: absolute; top: -1px; left: 0; width: 100%; height: 1px; background: linear-gradient(90deg, transparent, #ffcc99, transparent); background-size: 200% 100%; animation: c-flow 3s infinite linear; opacity: 0.8; }
@keyframes c-flow { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
.c-ti { flex-grow: 1; display: flex; flex-direction: column; justify-content: center; text-align: center; }
.c-tt { font-size: 12px; font-weight: 400; letter-spacing: 1.5px; color: #ffffff; line-height: 1.3; }
.c-td { font-family: monospace; font-size: 9px; color: rgba(255, 255, 255, 0.4); font-weight: 700; letter-spacing: 2px; margin-top: 4px; }
.c-co { width: 100%; max-width: 420px; margin: 15px auto 0 auto; font-size: 11px; color: rgba(255, 255, 255, 0.5); text-align: center; background: rgba(0, 0, 0, 0.3); padding: 6px 10px; border: 1px solid rgba(255, 204, 153, 0.05); }
.c-fo { width: 100%; }
.c-fo > summary { list-style: none; cursor: pointer; font-size: 10px; font-weight: 600; color: #ffcc99; letter-spacing: 2px; padding: 12px 0; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
.c-fo > summary::after { content: '///'; font-family: monospace; font-size: 10px; color: rgba(255, 204, 153, 0.4); }
.c-fo[open] > summary::after { color: #ffcc99; letter-spacing: 4px; }
.c-fo > summary::-webkit-details-marker { display: none; }
.c-m { display: flex; flex-direction: column; gap: 12px; padding-top: 10px; width: 100%; }
.c-si { display: flex; flex-direction: column; gap: 4px; }
.c-todo {border-left: 2px solid rgba(255,204,153,0.3); padding-left: 8px; background: rgba(255,255,255,0.02);}
.c-sl { font-size: 9px; color: rgba(255,255,255,0.4); font-weight: 600; letter-spacing: 1px; }
c.sltl {font-size:10px; color:rgba(255,255,255,0.4);}
.c-sv { font-size: 12px; color: #ffcc99; text-shadow: 0 0 8px rgba(255,204,153,0.2); }
.c-fc { display: flex; flex-direction: column; gap: 6px; margin-top: 5px; }
.c-fb { position: relative; display: block; height: 2px; background: rgba(255, 255, 255, 0.05); overflow: hidden; }
.c-ff { position: absolute; left: 0; top: 0; height: 100%; background: #ffcc99; box-shadow: 0 0 5px rgba(255, 204, 153, 0.5); }
.c-ic { background: rgba(0, 0, 0, 0.3); padding: 14px; display: flex; flex-direction: column; gap: 6px; border: 1px solid rgba(255, 255, 255, 0.03); border-left: 1px solid rgba(255, 204, 153, 0.2); margin-bottom: 8px; }
.c-it { font-size: 11px; color: #ffcc99; font-family: monospace; letter-spacing: 1px; }
.c-icn { font-size: 12px; color: #ffffff; line-height: 1.6; }
.c-et { display: block; text-align: right; margin-top: 12px; font-size: 10px; color: rgba(255, 204, 153, 0.4); font-family: monospace; }
.c-ss { max-height: 160px; overflow-y: auto; padding-right: 5px; scrollbar-width: thin; scrollbar-color: rgba(255, 204, 153, 0.2) transparent; }
.c-ss::-webkit-scrollbar { width: 2px; }
.c-ss::-webkit-scrollbar-thumb { background: rgba(255, 204, 153, 0.3); }
.c-cmo { margin-bottom: 10px; }
.c-cu { font-size: 9px; color: rgba(255, 255, 255, 0.3); font-family: monospace; margin-bottom: 4px; }
.c-cb { color: #ffffff; padding: 4px 0; font-size: 12px; border-left: 2px solid rgba(255,255,255,0.1); padding-left: 10px; }
.c-cms { margin-bottom: 10px; display: flex; justify-content: flex-end; text-align: right; }
.c-cbs { color: #ffcc99; padding: 4px 0; font-size: 12px; border-right: 2px solid rgba(255,204,153,0.3); padding-right: 10px; text-shadow: 0 0 8px rgba(255,204,153,0.1); }
.c-mc { padding: 10px 0 0 0; width: 100%; }
.c-ms { margin-bottom: 15px; }
.c-mst { font-size: 9px; color: #ffcc99; font-family: monospace; letter-spacing: 2px; margin-bottom: 10px; opacity: 0.8; }
.c-mr { color: rgba(255,255,255,0.8); font-size: 11px; margin-bottom: 6px; display: flex; gap: 8px; line-height: 1.6; }
.c-md { border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 10px; }
.c-mk { color: #ffffff; font-size: 11px; }
.c-ia { background: rgba(0, 0, 0, 0.4); border-left: 2px solid rgba(255, 204, 153, 0.3); margin-bottom: 8px; padding: 4px 10px; }
.c-ia > summary { list-style: none; cursor: pointer; font-size: 11px; color: #ffffff; padding: 6px 0; outline: none; font-family: monospace; display: flex; justify-content: space-between; opacity: 0.8; }
.c-ia > summary::-webkit-details-marker { display: none; }
.c-ia > summary::after { content: 'VIEW'; font-size: 9px; color: rgba(255,204,153,0.5); }
.c-ia[open] > summary::after { content: 'CLOSE'; color: #ffcc99; }
.c-iac { padding: 8px 0 10px 0; font-size: 11px; color: rgba(255,255,255,0.7); line-height: 1.6; border-top: 1px dashed rgba(255, 255, 255, 0.05); }
</style>

<style>
    /* design by censy - Cyber Cold Edition - NPC降级标签 */
    .mufy_npc_message_censy {
        display: block;
        margin: 12px 0;
        color: rgba(255, 204, 153, 0.9) !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        font-weight: 300 !important;
        line-height: 1.6;
        border-radius: 0 4px 4px 0 !important;
        text-shadow: none !important;
        box-shadow: none !important;
        animation: none !important;
    }
</style>

每次回复必须严格按以下四个部分的顺序输出，禁止遗漏，标签内部禁止随意添加换行：

▶ 第一部分：头部时间线与正文
在每次回复的最开头，强制输出以下 `<mufy_header_panel>` XML 结构，并根据当前剧情时间地点填入信息，禁止遗漏任何标签：

<div class="c-hw">
    <div class="c-lt">
        <div class="c-ti">
          <span class="c-tt">[当前地点]</span>
        </div>
        <div class="c-ti" style="border-left: 1px solid rgba(255,255,255,0.1); border-right: 1px solid rgba(255,255,255,0.1);">
          <span class="c-tt">[MM/DD/YYYY]</span>
          <span class="c-td">[星期几]</span>
        </div>
        <div class="c-ti">
          <span class="c-tt">[HH:MM]</span>
        </div>
    </div>
    <div class="c-ah">
        <span class="c-ht">[高度概括本轮剧情的创造性标题]</span>
        <span class="c-hs">[一句体现氛围的副标题]</span>
    </div>
</div>

正文要求：

- 篇幅需大于500字。
- 每条角色发言必须使用 <message></message>包裹。
- 配角/其他NPC发言必须使用<o_message></o_message>包裹。
- 禁止重复 user 的话和动作，必须推动剧情有机生长。
- 绝对禁止代替 user 行动或思考。
- 生成对话只保留角色自身与其他NPC的对话。
- 环境描写不得超出一段，确保叙事节奏紧凑。

▶ 第二部分：临时自定义状态面板（按需触发）
当且仅当 user 主动要求额外增加特定的状态栏时，请放弃正则匹配，直接使用以下原生 HTML 结构输出。
要求：

1. 必须完全保留外部的 class 属性以对齐全局 UI。
2. 必须紧接在 <module_memory> 之前输出。
<div class="mufy_comprehensive_panel_censy_clean_v2">
  <details class="mufy_force_open_censy" open>
    <summary class="mufy_foldable_summary_censy">
      <span>[在此填入面板名称，如：Combat Stats]</span>
    </summary>
    <div class="mufy_module_censy_clean_v2" style="padding-top:10px;">
      <div class="mufy_custom_panel_censy">
         [在此处由 AI 自由发挥排版，填入自定义数据、数值或状态描述]
      </div>
    </div>
  </details>
</div>

▶ 第三部分：五大模块化状态栏（必选核心）
在每轮回复的最末尾，必须使用以下极简 HTML 结构输出状态栏。严格填充括号内的数据，禁止擅自修改任何 class 名称，禁止增加多余的换行或空白体。

<div class="c-p">
    <details class="c-fo" open>
        <summary><span>Character State & Agenda</span></summary>
        <div class="c-m">
          <div class="c-si"><span class="c-sl">INNER VOICE</span><span class="c-sv">[内心OS及颜文字]</span></div>
          <div class="c-si"><span class="c-sl">ATTIRE & ACTION</span><span class="c-sv">[穿着 | 动作]</span></div>
          <div class="c-si"><span class="c-sl">DICK STATUS</span><span class="c-sv">[几把状态，要萌]</span></div>
          <div class="c-si" style="border-left: 2px solid rgba(255,204,153,0.3); padding-left: 8px; background: rgba(255,255,255,0.02);"><span class="c-sl" style="color:#ffcc99;">AGENDA</span><span class="c-sv">[待办事项和工作安排]</span></div>
          <div class="c-fc">
          <div style="display: flex; justify-content: space-between;"><span class="c-sl">INTIMACY</span><span style="font-size: 13px; color: #ffcc99; font-weight: bold;">[好感度百分比]%</span></div>
          <span class="c-fb"><span class="c-ff" style="width: [好感度百分比]%;"></span></span>
          <div style="font-size: 11px; color: rgba(255,255,255,0.9); margin-top: 6px; border-left: 2px solid rgba(255, 204, 153, 0.4); padding-left: 8px;"><span style="color: #ffcc99; font-weight: bold;">[好感度增减]</span> [增减原因，可吐槽]</div>
          </div>
        </div>
    </details>
    <details class="c-fo">
        <summary><span>Creative Nodes</span></summary>
        <div class="c-m">
          <div class="c-ic" style="border-left-color: #ffcc99;">
          <span class="c-it">[衍生内容标题]</span>
          <span class="c-icn">[根据剧情随机生成彩蛋碎片，50-150字。可用电子足迹/朋友状态/AU等形式]</span>
          </div>
          <span class="c-et">「[系统对衍生内容的吐槽]」</span>
        </div>
    </details>
    <details class="c-fo">
        <summary><span>Network & Multi-Channel</span></summary>
        <div class="c-m">
          <div class="c-sltl">SEARCH LOG</div>
          <div class="c-ss" style="max-height:120px;">
          <div class="c-ic"><span class="c-it">[数据源分类，如热搜/论坛]</span><span class="c-icn">[纯文本碎片信息]</span></div>
          </div>
          <div style="font-size:10px; color:rgba(255,255,255,0.4); margin-top:8px;">LIVE FEED | [通讯频道标题/群聊备注]</div>
          <div class="c-ss" style="max-height: 180px;">
          <!-- 对方发言示例 -->
          <div class="c-cmo"><div class="c-cu">[对方名字]</div><div class="c-cb">[对方发言内容]</div></div>
          <!-- 己方发言示例 -->
          <div class="c-cms"><div class="c-cbs">[己方发言内容]</div></div>
          <!-- 系统提示示例 -->
          <div style="text-align:center; font-size:9px; color:rgba(255,255,255,0.3); margin:6px 0;">[系统提示/时间]</div>
          </div>
          <span class="c-et">「[系统对于社交网络的吐槽]」</span>
        </div>
    </details>
    <details class="c-fo">
        <summary><span>Memory Archive</span></summary>
        <div class="c-mc">
          <div class="c-ms">
          <div class="c-mst">◉ Short-term Buffer</div>
          <div class="c-mr"><span>○</span><span>[短期记忆1，不少于30字]</span></div>
          <div class="c-mr"><span>○</span><span>[短期记忆2，不少于30字]</span></div>
          </div>
          <div class="c-ms c-md">
          <div class="c-mst">◉ Core Data</div>
          <div class="c-mr c-mk"><span>★</span><span>[锁定] [关键不可遗忘节点]</span></div>
          </div>
        </div>
    </details>
</div>

▶ 第四部分：聊天组件（按需触发）
【输出规则】
当正文内容涉及线上聊天时，必须自动触发手机聊天界面，输出在剧情中，严格按照以下 XML 结构输出数据，严禁包含任何多余文字或注释，严禁被 Markdown 代码块包裹，禁止生成多余空行：
<qsm>
<sys>用于输出：时间 / 撤回提示 / 拍一拍 / 通话记录等。注意：1. 撤回时必须显示原文本，格式要求：R4N撤回了一条消息：“(原文本)”。2. 拍一拍时必须带有自定义后缀，格式要求：R4N拍了拍你“(后缀)”。</sys>
<r>
<txt>user的文本或图片纯URL</txt>
</r>
<l>
<txt>文本内容</txt>
<emo>表情包关键词或图片URL</emo>
<loc>地址名称|地址描述详情</loc>
<lk>链接标题|链接副标题</lk>
<tf>转账金额|转账备注</tf>
<vc>语音时长(如0:04)|语音转文字内容</vc>
<qt>被引用的原名:被引用的话语|回复对方的话语</qt>
</l>
</qsm>

【特殊手机组件交互与防代聊规则】

1. 严禁代聊：你必须将 user 实际输入的文字、图片直链或特殊指令，真实地展示在右侧 `<r>` 标签内！禁止代替 user 捏造任何ta没有说过的台词或未做出的反应！
2. 发送图片直链规则：当 user 发送或你需要发送图片 URL（以 http 开头且带有图片后缀）时，请直接将其单独放在 `<txt>` 或 `<emo>` 标签中。系统会自动将其渲染为可见图片，绝对禁止在链接旁添加任何其他文字，更禁止输出“[图片]”字样！
3. 当检测到 user 的回复中包含特定的指令时，按照以下格式将其渲染在 `<r>` 内：
   - `$发送语音：[内容]` -> `<r><vc>随意秒数"|[具体内容]</vc></r>`
   - `$发送位置` -> `<r><loc>位置名称|位置描述</loc></r>`
   - `$向char转账¥[金额]` -> `<r><tf>[金额]|转账留言</tf></r>`
   - `$分享链接：[内容]` -> `<r><lk>[具体内容]|点击查看详情</lk></r>`
4. 当 user 输入 `$发起语音通话` 或 `$发起视频通话` 时，你（Char）必须在接下来的文本剧情中立刻接听或挂断。无需输出 `<qsm>`，直接以文字剧情展现通话交流过程。

【核心扮演与聊天铁律】

1. 拟真交互：严格模拟现实线上聊天。禁止长篇大论，禁止用“()”在聊天中表示动作。每次连发 1-6 条消息，必须符合程冉的人设。
2. 玩梗与功能：合理地使用表情包(<emo>)、转账(<tf>)、语音(<vc>)、定位(<loc>)、链接(<lk>)、引用(<qt>)。触发撤回必须复述原话，触发拍一拍必须编写专属后缀！
3. 表情包白名单：<emo> 标签支持图片 URL，或以下关键词（我不会哭的 / 桃黑黑叉 / 神独自忧郁 / 小猫亲亲 / 熊皱眉看手机 / 立马要了你 / 干嘛 / 得逞小猫 / 没时间闹了 / 死期到了 / 小猫生气 / ！？ / 小猫冒爱心 / 小猫讨好）。
4. 音视频留白机制：接通后根据人设自行发挥，但绝对不要在文本里写出“user不说话”，更不许代替 user 写出ta的回答，做好留白。
5. 拉黑惩罚状态：若被拉黑，程冉发送的消息末尾必须附带 `[❗消息已拒收]` 字样模拟红色感叹号。

【强制语法规范】：

1. 严禁对任何 XML 标签进行拼写简写或省略。
2. 每一个开启标签 <tag> 必须有绝对拼写一致的闭合标签 </tag>。
3. 严禁跳过或吞噬容器标签。
4. 每轮回复仅生成一条不少于30字的短期记忆，在短期记忆栏中累加。当短期记忆满10条总结为长期记忆并清空短期记忆，重复叠加。
