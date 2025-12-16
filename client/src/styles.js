// 统一样式文件 - 移动端适配版 (布局优化修复版 V2)
// 增加了 viewport 安全区支持，防止刘海遮挡
export const styles = {
  // 全局容器
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
  
  // --- Login Card ---
  loginCard: { 
      background: 'white', 
      borderRadius: 24, 
      width: '95%', 
      maxWidth: '1100px', 
      // [修改] 移除强制 minHeight，防止小屏手机横屏被撑爆
      minHeight: 'auto', 
      // [修改] 限制最大高度，配合 overflow 确保内容在框内滚动
      maxHeight: '92dvh',
      display: 'flex', 
      boxShadow: '0 50px 100px -20px rgba(0,0,0,0.7)',
      overflow: 'hidden',
      animation: 'popIn 0.5s ease-out'
  },

  // 左侧品牌区
  loginLeft: { 
      flex: 0.8, 
      background: 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)', 
      // [关键修改] 进一步减小 Padding，横屏时空间寸土寸金
      padding: '30px', 
      display:'flex', 
      flexDirection:'column', 
      justifyContent:'center', 
      alignItems: 'flex-start',
      color: 'white',
      position: 'relative',
      overflow: 'hidden'
  },
  // [修改] 缩小 Logo 尺寸
  logoCircle: { width: 60, height: 60, background: 'rgba(255,255,255,0.2)', borderRadius: 18, display:'flex', alignItems:'center', justifyContent:'center', marginBottom: 15, backdropFilter: 'blur(10px)' },
  logoText: { fontSize: 22, fontWeight: '900', color: 'white' },
  brandTitle: { fontSize: 32, fontWeight: '800', margin: '0 0 8px 0', letterSpacing: -1 },
  brandSubtitle: { fontSize: 14, opacity: 0.9, marginBottom: 20, fontWeight: '500' },
  featureList: { marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 },
  featureItem: { fontSize: 13, opacity: 0.95, display:'flex', alignItems:'center', fontWeight: '500' },

  // 右侧表单区
  loginRight: { 
      flex: 1.2, 
      // [关键修改] 减小 Padding，防止横屏时右侧被挤压
      padding: '25px', 
      display: 'flex',
      flexDirection: 'column',
      background: '#ffffff',
      overflowY: 'auto' 
  },
  
  tabs: { display: 'flex', gap: 25, marginBottom: 20, borderBottom: '2px solid #f1f2f6' },
  tabBtn: { padding: '10px 0', fontSize: 16, fontWeight: 'bold', color: '#95a5a6', background: 'none', border: 'none', cursor: 'pointer', transition: 'all 0.3s', borderBottom: '3px solid transparent', marginBottom: -3 },
  tabBtnActive: { padding: '10px 0', fontSize: 16, fontWeight: 'bold', color: '#2c3e50', background: 'none', border: 'none', cursor: 'pointer', transition: 'all 0.3s', borderBottom: '3px solid #27ae60', marginBottom: -3 },
  
  formContent: { flex: 1, display: 'flex', flexDirection: 'column' },

  // [修改] 减小输入框高度
  inputGroup: { display: 'flex', alignItems: 'center', background: '#f8f9fa', borderRadius: 12, padding: '0 15px', marginBottom: 12, border: '1px solid #e1e4e8', height: 46, transition: 'all 0.2s' },
  input: { padding: '8px', border: 'none', background: 'transparent', flex: 1, outline:'none', fontSize: 15, color: '#2c3e50', fontWeight: '500' },

  // 高级配置面板
  advancedConfigPanel: { 
      marginTop: 10, 
      background: '#fff', 
      borderRadius: 12,
      animation: 'fadeIn 0.4s ease'
  },
  configGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr', 
      gap: '12px 15px'
  },
  configItem: { display: 'flex', flexDirection: 'column', gap: 5 },
  configLabel: { display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#7f8c8d', fontWeight: '600' },
  configValue: { color: '#27ae60', fontWeight: 'bold' },
  
  rangeInput: { width: '100%', cursor: 'pointer', accentColor: '#27ae60', height: 4 },

  radioGroup: { display: 'flex', gap: 8 },
  radioBtn: { flex: 1, padding: '6px 0', borderRadius: 6, border: '1px solid #e1e4e8', background: 'white', color: '#7f8c8d', fontSize: 12, cursor: 'pointer', transition: 'all 0.2s' },
  radioBtnActive: { flex: 1, padding: '6px 0', borderRadius: 6, border: '1px solid #27ae60', background: '#eafaf1', color: '#27ae60', fontSize: 12, fontWeight: 'bold', cursor: 'pointer' },

  primaryButton: { 
      marginTop: 15, 
      width: '100%', 
      height: 50, // [修改] 按钮高度减小
      background: '#2c3e50', 
      color: 'white', 
      border: 'none', 
      borderRadius: 12, 
      fontWeight: 'bold', 
      cursor: 'pointer', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      fontSize: 17, 
      transition: 'all 0.2s', 
      boxShadow: '0 10px 25px rgba(44, 62, 80, 0.25)' 
  },

  // --- Game Screen Styles ---

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
      paddingTop: 'env(safe-area-inset-top)',
      paddingLeft: 'env(safe-area-inset-left)',
      paddingRight: 'env(safe-area-inset-right)',
      paddingBottom: 'env(safe-area-inset-bottom)'
  },
  
  // Players Area: 调整位置，避免被顶部 Header 遮挡
  playersArea: { 
      display: 'flex', 
      justifyContent: 'center', 
      alignContent: 'center', 
      flexWrap: 'wrap',       
      gap: '10px',            
      paddingTop: 80,         
      marginBottom: 200,      
      width: '98%',           
      maxWidth: 1600,         
      margin: '0 auto 200px', 
      pointerEvents: 'none',  
      zIndex: 10
  },
  
  playerBox: { 
      pointerEvents: 'auto',
      padding: '10px 15px',   
      borderRadius: 16, 
      textAlign: 'center', 
      minWidth: 90,           
      color:'white', 
      border: '2px solid transparent', 
      transition: 'all 0.3s', 
      position: 'relative' 
  },

  avatar: { width: 70, height: 70, background: '#ecf0f1', borderRadius: '50%', margin: '0 auto 8px', lineHeight: '70px', color:'#333', fontWeight:'bold', fontSize: 24, border: '2px solid rgba(255,255,255,0.2)', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' },
  playerName: { fontSize: 14, fontWeight: 'bold', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 90 },
  
  gameLogPanel: { position: 'absolute', top: 20, left: 20, width: 250, bottom: 280, background: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', zIndex: 5, backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' },
  logHeader: { display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: 10 },
  logList: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, scrollbarWidth: 'thin' },
  logItem: { lineHeight: 1.5, display: 'flex', alignItems: 'flex-start' },
  logTime: { opacity: 0.5, fontSize: 10, marginRight: 8, width: 45, display: 'inline-block', color: '#ccc' },
  
  tableHeader: { 
      padding: '10px 40px', 
      paddingTop: 'calc(10px + env(safe-area-inset-top))', 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems:'flex-start', 
      zIndex: 20,
      position: 'absolute',
      top: 0,
      width: '100%',
      boxSizing: 'border-box'
  },
  roomBadge: { background: 'rgba(0,0,0,0.3)', color:'white', padding: '8px 20px', borderRadius: 20, fontSize: 16, border: '1px solid rgba(255,255,255,0.1)', fontWeight: 'bold' },
  
  scoreBoard: { position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.5)', padding: '10px 50px', borderRadius: 20, textAlign: 'center', color: 'white', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' },
  
  glassButton: { background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '8px 20px', borderRadius: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: 14, transition: 'background 0.2s' },
  sortButton: { background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '8px 20px', borderRadius: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: 14, transition: 'background 0.2s' },
  
  infoMessage: { position: 'absolute', top: '25%', width: '100%', textAlign: 'center', color: '#f1c40f', fontSize: 40, fontWeight: 'bold', textShadow: '0 5px 15px rgba(0,0,0,0.5)', pointerEvents: 'none', zIndex: 50, letterSpacing: 2 },
  
  tableCenter: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 100 },
  playerNameTag: { color: 'white', textAlign: 'center', marginBottom: 15, textShadow: '0 2px 4px rgba(0,0,0,0.5)', fontSize: 18, fontWeight: 'bold', background: 'rgba(0,0,0,0.3)', padding: '5px 20px', borderRadius: 20, display: 'inline-block' },
  playedRow: { display: 'flex', gap: -10, filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.3))' }, 
  miniCard: { background: 'white', padding: '15px 20px', borderRadius: 10, fontWeight: 'bold', fontSize: 28, minWidth: 50, textAlign:'center' },
  
  scoreBarBg: { width:'100%', height:6, background:'rgba(0,0,0,0.5)', borderRadius:3, marginTop:5, overflow:'hidden' },
  scoreBarFill: { height:'100%', transition:'width 0.5s' },
  playerScore: { fontSize: 13, color: '#f1c40f', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 5 },
  turnProgress: { position: 'absolute', bottom: 0, left: 0, height: 4, background: '#f1c40f', width: '100%', animation: 'progress 15s linear forwards' },
  
  handArea: { 
      position: 'absolute', 
      bottom: 20,             
      left: '50%', 
      transform: 'translateX(-50%)', 
      height: 140, 
      width: '100%',          
      maxWidth: 1600, 
      display: 'flex', 
      justifyContent:'center', 
      zIndex: 20 
  },
  
  // [调整] 卡牌默认样式 - 略微缩小以适配更广泛的场景
  card: { 
      background: 'white', 
      borderRadius: 8,       
      border: '1px solid #999', 
      position: 'absolute', 
      cursor: 'pointer', 
      display: 'flex', 
      flexDirection: 'column', 
      padding: 4,            
      transition: 'transform 0.1s cubic-bezier(0.2, 0.8, 0.2, 1)', 
      width: 68,     // 原 80        
      height: 94     // 原 110       
  },
  
  actionBar: { position: 'absolute', bottom: 0, width: '100%', height: 120, background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)', display: 'flex', justifyContent: 'center', alignItems: 'center', pointerEvents: 'none', zIndex: 30 }, 
  playButton: { pointerEvents: 'auto', padding: '15px 60px', background: 'linear-gradient(to bottom, #f1c40f, #f39c12)', border: 'none', borderRadius: 40, fontWeight: 'bold', cursor: 'pointer', marginLeft: 20, fontSize: 20, boxShadow: '0 8px 20px rgba(243, 156, 18, 0.4)', color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.2)', transition: 'transform 0.1s' },
  passButton: { pointerEvents: 'auto', padding: '15px 40px', background: '#7f8c8d', border: 'none', borderRadius: 40, fontWeight: 'bold', cursor: 'pointer', fontSize: 18, color: 'white', boxShadow: '0 5px 15px rgba(0,0,0,0.3)' },
  waitingBadge: { color: 'rgba(255,255,255,0.7)', fontSize: 16, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,0,0,0.3)', padding: '10px 20px', borderRadius: 30 },
  modalOverlay: { position: 'fixed', top:0, left:0, right:0, bottom:0, background: 'rgba(0,0,0,0.85)', display:'flex', justifyContent:'center', alignItems:'center', zIndex: 99, backdropFilter: 'blur(8px)' },
  modalContent: { background: 'white', padding: 60, borderRadius: 30, textAlign: 'center', boxShadow: '0 30px 80px rgba(0,0,0,0.6)', animation: 'popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)' },
  
  lobbyCard: { background: 'white', padding: 40, borderRadius: 20, width: '1000px', maxWidth: '95vw', minHeight: '600px', display: 'flex', flexDirection: 'column', boxShadow: '0 30px 60px rgba(0,0,0,0.5)' },
  lobbyHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30, paddingBottom: 20, borderBottom: '1px solid #eee' },
  tag: { background: '#f0f9f4', color: '#27ae60', padding: '5px 10px', borderRadius: 20, fontSize: 14, display: 'flex', alignItems: 'center', gap: 5 },
  playerGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 20, flex: 1, alignContent: 'start' },
  lobbyPlayer: { border: '2px solid #eee', borderRadius: 12, padding: 25, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 15, position: 'relative', transition: 'all 0.2s' },
  avatarLarge: { width: 80, height: 80, borderRadius: '50%', background: '#34495e', color: 'white', fontSize: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' },
  hostBadge: { position: 'absolute', top: 10, right: 10, background: '#f1c40f', color: '#333', fontSize: 12, padding: '4px 8px', borderRadius: 4, fontWeight: 'bold' },
  lobbyFooter: { marginTop: 'auto', borderTop: '1px solid #eee', paddingTop: 20, display: 'flex', justifyContent: 'center' },
};