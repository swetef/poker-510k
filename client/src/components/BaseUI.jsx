// BaseUI.jsx 现在主要作为组件导出入口
// 具体的组件逻辑已经拆分到 ui/ 目录下
// 这样可以大幅减少单个文件的长度，便于 AI 阅读和维护

export { Card, MiniCard } from './ui/Card.jsx';
export { GameLogPanel } from './ui/GameLogPanel.jsx';
export { PlayerAvatar } from './ui/PlayerAvatar.jsx';