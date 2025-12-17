// 统一样式文件 - 移动端适配版
// [完整版] 包含所有原有布局、拇指热区、以及新增的滑动选牌支持和剩余牌数徽章
// [本次修复] 修复了弹窗无法点击的问题，以及横屏下弹窗显示不全的问题

export const styles = {
  // ============================
  // 全局容器
  // ============================
  container: { 
      height: '100dvh', // 使用 100dvh 自动适配动态地址栏
      width: '100vw', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      background: '#1e272e', 
      fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif', 
      backgroundImage: 'radial-gradient(circle at top right, #34495e 0%, #000000 100%)',
      overflow: 'hidden' 
  },
  
  // ============================
  // 登录页 (Login Screen)
  // ============================
  loginCard: { 
      background: 'white', 
      borderRadius: 24, 
      width: '95%', 
      maxWidth: '1100px', 
      minHeight: '600px', 
      maxHeight: '90vh',
      display: 'flex', 
      boxShadow: '0 50px 100px -20px rgba(0,0,0,0.7)',
      overflow: 'hidden',
      animation: 'popIn 0.5s ease-out'
  },

  // 左侧品牌区
  loginLeft: { 
      flex: 0.8, 
      background: 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)', 
      padding: '60px 50px', 
      display:'flex', 
      flexDirection:'column', 
      justifyContent:'center', 
      alignItems: 'flex-start',
      color: 'white',
      position: 'relative',
      overflow: 'hidden'
  },
  logoCircle: { width: 90, height: 90, background: 'rgba(255,255,255,0.2)', borderRadius: 24, display:'flex', alignItems:'center', justifyContent:'center', marginBottom: 25, backdropFilter: 'blur(10px)' },
  logoText: { fontSize: 28, fontWeight: '900', color: 'white' },
  brandTitle: { fontSize: 48, fontWeight: '800', margin: '0 0 15px 0', letterSpacing: -1.5 },
  brandSubtitle: { fontSize: 18, opacity: 0.9, marginBottom: 50, fontWeight: '500' },
  featureList: { marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 15 },
  featureItem: { fontSize: 15, opacity: 0.95, display:'flex', alignItems:'center', fontWeight: '500' },

  // 右侧表单区
  loginRight: { 
      flex: 1.2, 
      padding: '50px 60px', 
      display: 'flex',
      flexDirection: 'column',
      background: '#ffffff',
      overflowY: 'auto' 
  },
  
  tabs: { display: 'flex', gap: 35, marginBottom: 35, borderBottom: '2px solid #f1f2f6' },
  tabBtn: { padding: '12px 0', fontSize: 18, fontWeight: 'bold', color: '#95a5a6', background: 'none', border: 'none', cursor: 'pointer', transition: 'all 0.3s', borderBottom: '3px solid transparent', marginBottom: -3 },
  tabBtnActive: { padding: '12px 0', fontSize: 18, fontWeight: 'bold', color: '#2c3e50', background: 'none', border: 'none', cursor: 'pointer', transition: 'all 0.3s', borderBottom: '3px solid #27ae60', marginBottom: -3 },
  
  formContent: { flex: 1, display: 'flex', flexDirection: 'column' },

  inputGroup: { display: 'flex', alignItems: 'center', background: '#f8f9fa', borderRadius: 14, padding: '0 20px', marginBottom: 20, border: '1px solid #e1e4e8', height: 60, transition: 'all 0.2s' },
  input: { padding: '10px', border: 'none', background: 'transparent', flex: 1, outline:'none', fontSize: 17, color: '#2c3e50', fontWeight: '500' },

  // 高级配置面板
  advancedConfigPanel: { 
      marginTop: 15, 
      background: '#fff', 
      borderRadius: 12,
      animation: 'fadeIn 0.4s ease'
  },
  configGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr', 
      gap: '25px 35px'
  },
  configItem: { display: 'flex', flexDirection: 'column', gap: 10 },
  configLabel: { display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#7f8c8d', fontWeight: '600' },
  configValue: { color: '#27ae60', fontWeight: 'bold' },
  
  rangeInput: { width: '100%', cursor: 'pointer', accentColor: '#27ae60', height: 6 },

  radioGroup: { display: 'flex', gap: 10 },
  radioBtn: { flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid #e1e4e8', background: 'white', color: '#7f8c8d', fontSize: 13, cursor: 'pointer', transition: 'all 0.2s' },
  radioBtnActive: { flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid #27ae60', background: '#eafaf1', color: '#27ae60', fontSize: 13, fontWeight: 'bold', cursor: 'pointer' },

  primaryButton: { 
      marginTop: 25, 
      width: '100%', 
      height: 65, 
      background: '#2c3e50', 
      color: 'white', 
      border: 'none', 
      borderRadius: 14, 
      fontWeight: 'bold', 
      cursor: 'pointer', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      fontSize: 19, 
      transition: 'all 0.2s', 
      boxShadow: '0 10px 25px rgba(44, 62, 80, 0.25)' 
  },

  // ============================
  // 游戏界面 (Game Screen)
  // ============================

  gameTable: { 
      height: '100dvh', // 使用 100dvh
      width: '100vw', 
      background: '#1e3c29', 
      backgroundImage: 'radial-gradient(circle at center, #2d7a54 0%, #173b25 100%)', 
      position: 'relative', 
      overflow: 'hidden', 
      display: 'flex', 
      flexDirection: 'column', 
      userSelect: 'none',
      
      // [关键] 必须加上 border-box，防止宽度溢出
      boxSizing: 'border-box',

      paddingTop: 'env(safe-area-inset-top)',
      paddingLeft: 'max(15px, env(safe-area-inset-left))',
      paddingRight: 'max(15px, env(safe-area-inset-right))',
      paddingBottom: 'env(safe-area-inset-bottom)'
  },
  
  // 安全区域包装层
  gameSafeArea: {
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      width: '100%',
      height: '100%',
      boxSizing: 'border-box',
      paddingTop: 'env(safe-area-inset-top)',
      paddingLeft: 'max(15px, env(safe-area-inset-left))',
      paddingRight: 'max(15px, env(safe-area-inset-right))',
      paddingBottom: 'env(safe-area-inset-bottom)',
      display: 'flex',
      flexDirection: 'column',
      pointerEvents: 'none' 
  },

  playersArea: { 
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      pointerEvents: 'none',
      zIndex: 10
  },
  
  playerBox: { 
      pointerEvents: 'auto',
      padding: '2px 4px',   
      borderRadius: 8, 
      textAlign: 'center', 
      minWidth: 45,           
      color:'white', 
      border: '1px solid transparent', 
      transition: 'all 0.3s', 
      position: 'relative',
      backdropFilter: 'blur(3px)',
      boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
  },

  // [新增] 剩余牌数小徽章样式
  cardCountBadge: {
      position: 'absolute',
      top: -8,
      left: -8,
      background: '#e74c3c',
      color: 'white',
      borderRadius: '50%',
      width: 20,
      height: 20,
      fontSize: 12,
      fontWeight: 'bold',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: '2px solid #fff',
      boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
      zIndex: 25
  },

  avatar: { 
      width: 30, 
      height: 30, 
      background: '#ecf0f1', 
      borderRadius: '50%', 
      margin: '0 auto 2px', 
      lineHeight: '30px', 
      color:'#333', 
      fontWeight:'bold', 
      fontSize: 14, 
      border: '1px solid rgba(255,255,255,0.3)', 
      boxShadow: '0 2px 5px rgba(0,0,0,0.2)' 
  },

  playerName: { 
      fontSize: 10, 
      fontWeight: 'bold', 
      marginBottom: 1, 
      whiteSpace: 'nowrap', 
      overflow: 'hidden', 
      textOverflow: 'ellipsis', 
      maxWidth: 50 
  },
  
  // [修改] 左上角日志面板 (GameLogPanel) - 支持折叠动画
  gameLogPanel: { 
      position: 'absolute', 
      top: 50, 
      left: 10, 
      width: 200, 
      // 高度在 JSX 中动态控制，这里设默认值
      // height: 140, 
      
      // [关键修改] 背景默认改为更透明 (0.35)，组件内动态控制
      background: 'rgba(0, 0, 0, 0.35)', 
      
      borderRadius: 10, 
      padding: '8px 12px', 
      border: '1px solid rgba(255,255,255,0.1)',
      backdropFilter: 'blur(5px)',
      
      display: 'flex', 
      flexDirection: 'column', 
      zIndex: 5, 
      pointerEvents: 'auto', 
      boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
      
      // [关键修改] 增加过渡动画，让折叠更丝滑
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      overflow: 'hidden' // 防止折叠时内容溢出
  },
  
  logHeader: { 
      display: 'flex', 
      alignItems: 'center', 
      gap: 5, 
      fontSize: 12, 
      borderBottom: '1px solid rgba(255,255,255,0.2)', 
      paddingBottom: 4, 
      marginBottom: 4 
  }, 
  
  logList: { 
      flex: 1, 
      overflowY: 'auto', 
      display: 'flex', 
      flexDirection: 'column', 
      gap: 4, 
      fontSize: 12,
      // 增加透明度过渡
      transition: 'opacity 0.2s ease-in-out',
      maskImage: 'linear-gradient(to bottom, transparent, black 10%)',
      WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 10%)'
  },
  
  logItem: { 
      lineHeight: 1.4, 
      display: 'flex', 
      alignItems: 'flex-start', 
      color: '#ecf0f1',
      fontSize: 12,
      textShadow: '0 1px 1px rgba(0,0,0,0.8)'
  },
  
  logTime: { display: 'none' },
  
  tableHeader: { 
      padding: '4px 10px', 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems:'flex-start', 
      zIndex: 20,
      width: '100%',
      pointerEvents: 'none',
      boxSizing: 'border-box' 
  },
  
  roomBadgeContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 8, 
    pointerEvents: 'auto'
  },

  roomBadge: { 
    background: 'rgba(0,0,0,0.3)', 
    color:'white', 
    padding: '4px 8px', 
    borderRadius: 15, 
    fontSize: 11, 
    border: '1px solid rgba(255,255,255,0.1)', 
    fontWeight: 'bold',
    whiteSpace: 'nowrap'
  },
  
  scoreBoard: { 
      position: 'absolute', 
      top: '40%', 
      left: '50%', 
      transform: 'translate(-50%, -100%) scale(0.8)', 
      background: 'rgba(0,0,0,0.6)', 
      padding: '5px 20px', 
      borderRadius: 20, 
      textAlign: 'center', 
      color: 'white', 
      border: '1px solid rgba(255,255,255,0.2)', 
      backdropFilter: 'blur(5px)', 
      boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
      zIndex: 5 
  },
  
  glassButton: { pointerEvents: 'auto', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '8px 20px', borderRadius: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: 14, transition: 'background 0.2s' },
  sortButton: { pointerEvents: 'auto', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '8px 20px', borderRadius: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: 14, transition: 'background 0.2s' },
  
  infoMessage: { position: 'absolute', top: '25%', width: '100%', textAlign: 'center', color: '#f1c40f', fontSize: 40, fontWeight: 'bold', textShadow: '0 5px 15px rgba(0,0,0,0.5)', pointerEvents: 'none', zIndex: 50, letterSpacing: 2 },
  
  tableCenter: { 
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      zIndex: 1
  },
  
  playerNameTag: { color: 'white', textAlign: 'center', marginBottom: 5, textShadow: '0 2px 4px rgba(0,0,0,0.5)', fontSize: 14, fontWeight: 'bold', background: 'rgba(0,0,0,0.3)', padding: '2px 10px', borderRadius: 20, display: 'inline-block' },
  playedRow: { display: 'flex', gap: -10, filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.3))' }, 
  miniCard: { background: 'white', padding: '10px 15px', borderRadius: 8, fontWeight: 'bold', fontSize: 24, minWidth: 40, textAlign:'center' },
  
  scoreBarBg: { width:'100%', height:4, background:'rgba(0,0,0,0.5)', borderRadius:2, marginTop:2, overflow:'hidden' },
  scoreBarFill: { height:'100%', transition:'width 0.5s' },
  playerScore: { fontSize: 9, color: '#f1c40f', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, marginTop: 1 },
  turnProgress: { position: 'absolute', bottom: 0, left: 0, height: 4, background: '#f1c40f', width: '100%', animation: 'progress 15s linear forwards' },
  
  // HandArea
  handArea: { 
      position: 'absolute', 
      // [关键修改] 抬高底部距离，从 5px 改为 max(25px, env...) 
      // 避免 iOS 底部小黑条遮挡，解决“点击底部无反应”的问题
      bottom: 'max(25px, env(safe-area-inset-bottom))',              
      left: 65,
      right: 10, 
      height: 160,            
      display: 'flex', 
      justifyContent:'flex-start', 
      alignItems: 'flex-end', 
      zIndex: 20,
      touchAction: 'none', 
      pointerEvents: 'auto',
      paddingBottom: 10       
  },
  
  card: { 
      background: 'white', 
      borderRadius: 6,      
      border: '1px solid #999', 
      position: 'absolute', 
      cursor: 'pointer', 
      display: 'flex', 
      flexDirection: 'column', 
      padding: 4,            
      transition: 'transform 0.1s cubic-bezier(0.2, 0.8, 0.2, 1)', 
      width: 55,         
      height: 70 
  },
  
  actionBar: { position: 'absolute', bottom: 100, width: '100%', height: 60, display: 'flex', justifyContent: 'center', alignItems: 'center', pointerEvents: 'none', zIndex: 30 }, 
  playButton: { pointerEvents: 'auto', padding: '8px 30px', background: 'linear-gradient(to bottom, #f1c40f, #f39c12)', border: 'none', borderRadius: 40, fontWeight: 'bold', cursor: 'pointer', marginLeft: 20, fontSize: 16, boxShadow: '0 8px 20px rgba(243, 156, 18, 0.4)', color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.2)', transition: 'transform 0.1s' },
  passButton: { pointerEvents: 'auto', padding: '8px 25px', background: '#7f8c8d', border: 'none', borderRadius: 40, fontWeight: 'bold', cursor: 'pointer', fontSize: 14, color: 'white', boxShadow: '0 5px 15px rgba(0,0,0,0.3)' },
  waitingBadge: { color: 'rgba(255,255,255,0.7)', fontSize: 16, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,0,0,0.3)', padding: '10px 20px', borderRadius: 30 },
  
  // [修复 1] 弹窗遮罩：增加 pointerEvents: 'auto' 以解决按钮点击无反应的问题
  modalOverlay: { 
      position: 'fixed', 
      top:0, left:0, right:0, bottom:0, 
      background: 'rgba(0,0,0,0.85)', 
      display:'flex', 
      justifyContent:'center', 
      alignItems:'center', 
      zIndex: 99, 
      backdropFilter: 'blur(8px)',
      pointerEvents: 'auto' // 核心修复：允许接收点击事件
  },

  // [修复 2] 弹窗内容：增加 maxHeight 和 overflowY 以解决横屏显示不全的问题
  modalContent: { 
      background: 'white', 
      padding: 30, // 减小 Padding (原 60) 以适配小屏
      borderRadius: 24, // 稍微减小圆角 (原 30)
      textAlign: 'center', 
      boxShadow: '0 30px 80px rgba(0,0,0,0.6)', 
      animation: 'popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      
      // 新增响应式属性
      width: '90%',        // 默认宽度 90%
      maxWidth: 500,       // 最大宽度
      maxHeight: '85vh',   // 核心修复：限制高度不超过屏幕 85%
      overflowY: 'auto',   // 核心修复：内容过多时出现滚动条
      
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
  },
  
  // 大厅页 (Lobby)
  lobbyCard: { background: 'white', padding: 40, borderRadius: 20, width: '1000px', maxWidth: '95vw', minHeight: '600px', display: 'flex', flexDirection: 'column', boxShadow: '0 30px 60px rgba(0,0,0,0.5)' },
  lobbyHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30, paddingBottom: 20, borderBottom: '1px solid #eee' },
  tag: { background: '#f0f9f4', color: '#27ae60', padding: '5px 10px', borderRadius: 20, fontSize: 14, display: 'flex', alignItems: 'center', gap: 5 },
  playerGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 20, flex: 1, alignContent: 'start' },
  lobbyPlayer: { border: '2px solid #eee', borderRadius: 12, padding: 25, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 15, position: 'relative', transition: 'all 0.2s' },
  avatarLarge: { width: 80, height: 80, borderRadius: '50%', background: '#34495e', color: 'white', fontSize: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' },
  hostBadge: { position: 'absolute', top: 10, right: 10, background: '#f1c40f', color: '#333', fontSize: 12, padding: '4px 8px', borderRadius: 4, fontWeight: 'bold' },
  lobbyFooter: { marginTop: 'auto', borderTop: '1px solid #eee', paddingTop: 20, display: 'flex', justifyContent: 'center' },
};