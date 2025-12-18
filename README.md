# 德州扑克 (Texas Hold'em)

> 🤖 **AI Generated Project**
>
> 本项目几乎完全由 AI 生成，践行 **[Vibe Coding](https://en.wikipedia.org/wiki/Vibe_coding)** 理念。
>
> - **AI Model**: Claude Opus 4.5
> - **IDE**: Cursor
> - **开发方式**: 通过自然语言描述需求，AI 自动生成代码，人类几乎不直接编写代码
>
> _"Vibe Coding" 由 Andrej Karpathy 提出 —— 完全拥抱 AI，只描述意图，让 AI 处理实现细节。_

---

一个基于 WebRTC 的多人在线德州扑克游戏，支持最多 9 人同时游戏。

![游戏预览](./public/preview.png)

## ✨ 功能特性

### 核心游戏

- 🎮 完整的德州扑克游戏规则
- 👥 支持 2-9 人同时游戏
- 🌐 基于 WebRTC 的 P2P 连接（无需后端服务器）
- 🎯 精确的牌型评估与比较
- 💰 小盲/大盲、加注规则完整实现
- 🏆 支持边池计算（多人 All-in 场景）

### 用户体验

- 💬 实时文字聊天（带气泡显示）
- 🎨 精美的赌场风格 UI
- ✨ 丰富的游戏动画效果
  - 加注时的金色光效
  - All-in 时的强烈震动效果
  - 胜利/失败的全局动画
- 🖼️ 48 种 Lucide 图标头像可选
- 📊 操作历史记录面板
- ❓ 牌型帮助与实时手牌分析
- 📱 响应式设计

### 技术亮点

- 🔗 分享房间链接直接加入
- 💾 玩家信息本地持久化
- 🎚️ 可拖拽调整侧边栏布局

## 🛠️ 技术栈

| 类别     | 技术                             |
| -------- | -------------------------------- |
| 前端框架 | Vue 3 + TypeScript               |
| 构建工具 | Vite                             |
| 样式     | TailwindCSS v4                   |
| 状态管理 | Pinia                            |
| WebRTC   | PeerJS (PeerJS Cloud 信令服务器) |
| 图标     | Lucide Icons                     |
| 路由     | Vue Router                       |

## 🚀 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build

# 预览生产构建
pnpm preview
```

## 🎮 游戏玩法

### 创建/加入房间

1. **创建房间**: 输入昵称，选择头像，点击"创建房间"
2. **加入房间**: 输入昵称和 6 位房间号，或通过分享链接直接加入
3. **开始游戏**: 房主在至少 2 人加入后点击"开始游戏"

### 游戏操作

| 操作          | 说明                            |
| ------------- | ------------------------------- |
| 弃牌 (Fold)   | 放弃当前手牌                    |
| 过牌 (Check)  | 不加注继续（仅当无需跟注时）    |
| 跟注 (Call)   | 跟上当前下注额                  |
| 加注 (Raise)  | 提高下注额（需 ≥ 上次加注增量） |
| 全下 (All-in) | 押上所有筹码                    |

## 📁 项目结构

```
texas-holdem/
├── src/
│   ├── components/
│   │   ├── chat/
│   │   │   └── ChatBox.vue         # 聊天框组件
│   │   ├── common/
│   │   │   └── AvatarPicker.vue    # 头像选择器
│   │   ├── game/
│   │   │   ├── ActionHistory.vue   # 操作历史记录
│   │   │   ├── ActionPanel.vue     # 操作面板（弃牌/加注等）
│   │   │   ├── Card.vue            # 扑克牌组件
│   │   │   ├── ChipStack.vue       # 筹码堆叠显示
│   │   │   ├── HelpModal.vue       # 帮助弹窗（牌型/分析）
│   │   │   ├── PlayerSeat.vue      # 玩家座位
│   │   │   ├── PokerTable.vue      # 牌桌
│   │   │   └── PotDisplay.vue      # 底池显示
│   │   └── lobby/
│   │       └── LobbyPanel.vue      # 大厅面板
│   ├── composables/
│   │   ├── use-chat.ts             # 聊天功能
│   │   ├── use-game.ts             # 游戏状态管理
│   │   └── use-peer.ts             # PeerJS 连接管理
│   ├── core/
│   │   ├── deck.ts                 # 牌组管理
│   │   ├── game-engine.ts          # 游戏引擎（核心逻辑）
│   │   ├── hand-evaluator.ts       # 牌型评估
│   │   └── types.ts                # TypeScript 类型定义
│   ├── stores/
│   │   ├── game-store.ts           # 游戏状态 Store
│   │   └── player-store.ts         # 玩家信息 Store
│   ├── utils/
│   │   └── avatars.ts              # 头像配置
│   ├── views/
│   │   ├── GameView.vue            # 游戏主视图
│   │   └── HomeView.vue            # 首页
│   ├── App.vue
│   ├── main.ts
│   └── style.css
├── index.html
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── vite.config.ts
```

## 🃏 游戏规则

### 牌型大小（从高到低）

| 排名 | 牌型       | 说明                             |
| ---- | ---------- | -------------------------------- |
| 1    | 皇家同花顺 | A K Q J 10 同花色                |
| 2    | 同花顺     | 五张连续同花色                   |
| 3    | 四条       | 四张相同点数                     |
| 4    | 葫芦       | 三条 + 一对                      |
| 5    | 同花       | 五张同花色                       |
| 6    | 顺子       | 五张连续点数（A 可作最大或最小） |
| 7    | 三条       | 三张相同点数                     |
| 8    | 两对       | 两个对子                         |
| 9    | 一对       | 两张相同点数                     |
| 10   | 高牌       | 最大单张                         |

### 游戏阶段

```
翻牌前 (Preflop)  →  翻牌 (Flop)  →  转牌 (Turn)  →  河牌 (River)  →  摊牌 (Showdown)
    发2张底牌         发3张公共牌      发第4张公共牌    发第5张公共牌      比较牌型大小
```

### 特殊规则

- **最小加注**: 加注金额必须 ≥ 上次加注的增量
- **All-in 对决**: 所有活跃玩家都 All-in 后，直接发完公共牌并摊牌
- **边池**: 当筹码不同的玩家 All-in 时，自动计算边池

## ⚠️ 注意事项

- 使用 PeerJS Cloud 免费服务，适合小规模使用
- 基于 Host 模式，创建房间的玩家负责游戏逻辑计算
- 需要稳定的网络连接以保证游戏体验
- 房主断开连接会导致游戏中断

## 📄 License

MIT
