# AICC GPT Bridge Chrome Extension

这是 AICC-V2 GPT Bridge 001B 的本地 Chrome Manifest V3 适配器。它只传输
`AICC_EXECUTION_V1` 文本到现有 AICC Inbox，并把精确关联的
`AICC_RUN_REPORT_V1` 文本插入当前 ChatGPT composer。它不启动 Codex、不判断
授权、不访问 shell，也不会点击 ChatGPT 原生发送按钮。

## Owner 安装

1. 打开 `chrome://extensions`
2. 开启 Developer mode / 开发者模式
3. 点击 **Load unpacked / 加载已解压的扩展**
4. 选择本目录：`web-adapter/chrome-extension/`
5. 确认 AICC Local Service 已运行在 `127.0.0.1:1420`
6. 打开或刷新 `https://chatgpt.com/`
7. 确认页面出现「发送到 AICC」和「插入运行报告」

无需 npm 或浏览器扩展构建命令。AICC Local Service 不可用时，扩展会显示可读
失败原因；001A 的剪贴板导入与复制报告回退仍可独立使用。

仓库验证流程会自动把上级 canonical `web-adapter/chatgpt-dom.js` 同步到本目录；
Owner 不需要手动复制任何文件。

插入报告后，Owner 必须手动点击 ChatGPT 原生发送按钮。
