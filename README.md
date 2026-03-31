# 辉辉提词器

AI 口播文案生成 + 悬浮提词器，一个 App 搞定直播备播全流程。

## 功能

- **AI 文案生成**：输入主题，自动生成口播大纲 / 逐字稿 / 引导问题
- **智能改写**：粘贴别人的文案，用自己的话重新讲，重复率低于 10%
- **参考学习**：喂给 AI 好的文案，自动分析风格特点并模仿
- **风格偏好**：每次修改文案时自动提取偏好规则，越用越懂你
- **悬浮提词器**：系统级浮窗，切到相机录视频也能看到文字，支持：
  - 自动滚动（速度可调）
  - 字号调节
  - 镜像模式
  - 任意位置拖动
- **收藏管理**：好文案一键收藏，随时调出来用
- **自动选题**：留空主题，AI 根据行业和品牌自动推荐选题

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | 原生 HTML/CSS/JS，无框架 |
| 打包 | Capacitor 8.3 |
| 原生功能 | Android Service（悬浮窗）、EncryptedSharedPreferences（密钥存储） |
| AI 接口 | Moonshot / Kimi API（OpenAI 兼容格式） |
| 数据存储 | IndexedDB（本地，不上传） |

## 项目结构

```
www/                          # 前端代码
├── index.html                # 主界面 + 所有页面
├── js/
│   ├── api.js                # LLM 调用 + 业务逻辑
│   └── db.js                 # IndexedDB 数据层
android/                      # Android 原生工程
├── app/src/main/java/com/lilu/beiboagent/
│   ├── MainActivity.java
│   ├── FloatingTeleprompterService.java   # 悬浮提词器 Service
│   ├── TeleprompterPlugin.java            # Capacitor 桥接插件
│   └── SecureStoragePlugin.java           # 加密存储插件
```

## 核心设计

### Prompt 工程

系统 prompt 由 5 个模块动态组装：
1. 行业 + 品牌信息（用户配置）
2. 行文逻辑框架（可选）
3. 用户风格偏好（从历史反馈中自动学习）
4. 参考文案风格分析（AI 分析后注入）
5. 近 7 天已写主题（去重）

### 偏好学习闭环

用户修改文案 → AI 提取可复用的风格规则 → 写入偏好库 → 下次生成时注入 prompt

### 悬浮提词器

Android 前台 Service + SYSTEM_ALERT_WINDOW，TYPE_APPLICATION_OVERLAY 实现跨应用覆盖。半透明背景 + 白字黑影保证在相机画面上可读。

## 开发日志

完整开发过程记录在 [DEVLOG.md](DEVLOG.md)

## 构建

```bash
# 环境要求：Node.js 18+、JDK 21、Android SDK

# 安装依赖
npm install

# 同步到 Android
npx cap sync android

# 构建 APK
cd android && ./gradlew assembleRelease
```

## 作者

贾鹏辉 — AI 产品经理 / 培训讲师
