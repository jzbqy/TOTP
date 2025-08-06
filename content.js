// 内容脚本 - 自动检测和填充验证码
let totpPanel = null;

// 检测验证码输入框
function findTOTPInputs() {
  const selectors = [
    'input[name*="otp" i]',
    'input[name*="2fa" i]',
    'input[name*="code" i]',
    'input[name="code"]',
    'input[name="two_step_code"]',
    'input[name*="token" i]',
    'input[placeholder*="验证码" i]',
    'input[placeholder*="驗證碼" i]',
    'input[placeholder*="code" i]',
    'input[placeholder*="認證" i]',
    'input[placeholder*="动态" i]',
    'input[placeholder*="動態" i]',
    'input[maxlength="6"]',
    'input[maxlength="8"]'
  ];
  
  for (const selector of selectors) {
    const inputs = document.querySelectorAll(selector);
    if (inputs.length > 0) {
      return Array.from(inputs);
    }
  }
  
  // 检测特殊的验证码输入框结构
  const specialInputs = document.querySelectorAll('.input-wrap .input-content');
  if (specialInputs.length > 0) {
    // 返回第一个特殊输入框的隐藏输入框
    const hiddenInput = document.querySelector('.input-wrap input.visible');
    if (hiddenInput) {
      return [hiddenInput];
    }
  }
  
  return [];
}

// 检查是否是验证页面 - 参考原插件逻辑
function isAuthPage() {
  const url = window.location.href;
  const domain = window.location.hostname;
  const path = window.location.pathname;
  
  // 特定网站的验证码页面路径
  const authPaths = {
    'github.com': ['/sessions/two-factor', '/authentication/verify'],
    'gitlab.com': ['/users/sign_in', '/users/two_factor_auth'],
    'bitbucket.org': ['/account/two-step-verification'],
    'microsoft.com': ['/auth/requires-two-factor'],
    'live.com': ['/login.srf'],
    'office.com': ['/logincallback'],
    'zhuque.in': ['/login.php', '/auth/login', '/auth.php'],
    'piggo.me': ['/login.php', '/auth/login', '/auth.php'],
    'pterclub.com': ['/login.php', '/auth/login', '/auth.php'],
    '1ptba.com': ['/login.php', '/auth/login', '/auth.php'],
    'carpt.net': ['/usercp.php']
  };
  
  // 通用验证码页面URL关键词
  const authKeywords = [
    'two-factor', 'two_factor', '2fa', 'two-step', 'verification', 
    'authenticate', 'security-code', 'otp', 'mfa', 'multi-factor',
    'login.php?2fa=1', 'auth.php?code=1'
  ];
  
  // 1. 检查是否匹配特定站点的验证码页面路径
  for (const site in authPaths) {
    if (domain.includes(site)) {
      if (authPaths[site].some(authPath => path.includes(authPath))) {
        return true;
      }
    }
  }
  
  // 2. 检查URL是否包含验证码关键词
  if (authKeywords.some(keyword => url.toLowerCase().includes(keyword))) {
    return true;
  }
  
  // 3. 检查页面内容是否包含验证码相关文本
  const bodyText = document.body.innerText.toLowerCase();
  const authTexts = [
    'verification code', 'security code', 'two-factor', 'two factor',
    '2fa', 'authenticator', 'authentication code', 'totp', 
    '二步验证', '两步验证', '验证码', '安全验证', '双重验证',
    '二步驗證', '兩步驗證', '驗證碼', '安全驗證', '雙重驗證',
    '動態密碼', '身份驗證', '認證碼', '安全認證', '多重驗證',
    'enter the code'
  ];
  
  if (authTexts.some(text => bodyText.includes(text.toLowerCase()))) {
    return true;
  }
  
  // 4. 检查表单标题或结构
  const formTitles = document.querySelectorAll('h1, h2, h3, h4, h5, h6, legend, .layui-field-title');
  for (const title of formTitles) {
    const titleText = title.textContent.toLowerCase();
    if (titleText.includes('验证') || titleText.includes('驗證') ||
        titleText.includes('安全') || titleText.includes('認證') ||
        titleText.includes('verification') || 
        titleText.includes('security') ||
        titleText.includes('authentication')) {
      return true;
    }
  }
  
  // 5. PT站特有的样式特征
  const ptAuthElements = document.querySelectorAll('.layui-tab-title, #input-form-box, .input-wrap');
  if (ptAuthElements.length > 0) {
    return true;
  }
  
  return false;
}

// 判断是否为独立的2FA页面
function isStandalone2FAPage() {
  const url = window.location.href.toLowerCase();
  const domain = window.location.hostname;
  
  // piggo.me域名特殊处理：只要有输入框就自动填充
  if (domain.includes('piggo.me')) {
    return findTOTPInputs().length > 0;
  }
  
  // action=security页面特殊处理
  if (url.includes('action=security')) {
    const has2FAEnabled = is2FAEnabled();
    if (has2FAEnabled) {
      return false; // 已开启2FA，不自动填充
    } else {
      // 未开启2FA：如果显示验证码面板则自动填充
      return totpPanel && totpPanel.querySelector('.totp-code');
    }
  }
  
  // 查找两步认证相关元素（排除html/body等大容器）
  let twoFactorElement = null;
  const specificElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, div, span, td, th, li, a, p, label');
  
  for (const element of specificElements) {
    const text = element.textContent || '';
    const trimmedText = text.trim();
    if (trimmedText.length < 200 && (trimmedText.includes('两步验证') || trimmedText.includes('两步認證') || 
        trimmedText.includes('二步验证') || trimmedText.includes('二步認證') ||
        trimmedText.includes('双重验证') || trimmedText.includes('雙重驗證') ||
        trimmedText.includes('two-factor') || trimmedText.includes('2fa') ||
        trimmedText.includes('multi-factor') || trimmedText.includes('totp') ||
        trimmedText.includes('二次认证'))) {
      twoFactorElement = element;
      break;
    }
  }
  
  // 查找安全设定相关元素（排除html/body等大容器）
  let securityElement = null;
  
  for (const element of specificElements) {
    const text = element.textContent || '';
    const trimmedText = text.trim();
    if (trimmedText.length < 200 && (trimmedText.includes('安全设定') || trimmedText.includes('安全設定') ||
        trimmedText.includes('安全设置') || trimmedText.includes('安全設置') ||
        trimmedText.includes('security settings') || trimmedText.includes('account security'))) {
      securityElement = element;
      break;
    }
  }
  
  // 规则1：找不到两步认证元素 → 认为是同一页面（不自动填充）
  if (!twoFactorElement) {
    return false;
  }
  
  // 规则2：找不到安全设定元素 → 认为是独立页面（可以自动填充）
  if (!securityElement) {
    return true;
  }
  
  // 规则3：两步认证元素在安全设定元素内部 → 认为是同一页面（不自动填充）
  if (securityElement.contains(twoFactorElement)) {
    return false;
  }
  
  // 规则4：两步认证元素不在安全设定元素内部 → 认为是分开页面（可以自动填充）
  return true;
}

// 创建TOTP面板
async function createTOTPPanel() {
  console.log('createTOTPPanel被调用');
  if (totpPanel) {
    console.log('面板已存在，跳过');
    return;
  }
  
  const sites = await getSites();
  const currentDomain = window.location.hostname;
  
  // 查找匹配的站点（支持通配符）
  const matchedSites = Object.entries(sites).filter(([name, data]) => 
    data.domains && data.domains.some(domain => matchDomain(currentDomain, domain))
  );
  
  // 检查是否是设置页面且未开启2FA（需要配置2FA的页面）
  const isSettingsPage = isSecuritySettingsPage();
  const has2FAEnabled = is2FAEnabled();
  
  // 只有在设置页面且未开启2FA时才显示表单
  if (isSettingsPage && !has2FAEnabled) {
    if (matchedSites.length === 0) {
      createAddSitePanel();
      return;
    } else {
      createEditSitePanel(matchedSites[0]);
      return;
    }
  }
  
  // 普通验证页面，显示验证码
  console.log('匹配的站点数量:', matchedSites.length);
  if (matchedSites.length === 0) {
    console.log('没有匹配的站点，返回');
    return;
  }
  
  console.log('开始创建验证码面板');
  
  totpPanel = document.createElement('div');
  totpPanel.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: white;
    border: 1px solid #ccc;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    font-family: Arial, sans-serif;
    min-width: 200px;
    cursor: move;
  `;
  
  // 添加拖拽功能
  makeDraggable(totpPanel);
  
  const title = document.createElement('div');
  title.textContent = 'TOTP验证码';
  title.style.cssText = 'font-weight: bold; margin-bottom: 12px; font-size: 14px;';
  totpPanel.appendChild(title);
  
  for (const [siteName, siteData] of matchedSites) {
    const siteDiv = createSiteCard(siteName, siteData);
    totpPanel.appendChild(siteDiv);
  }
  
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.style.cssText = `
    position: absolute;
    top: 4px;
    right: 8px;
    border: none;
    background: none;
    font-size: 18px;
    cursor: pointer;
    color: #999;
  `;
  closeBtn.onclick = () => {
    totpPanel.remove();
    totpPanel = null;
  };
  totpPanel.appendChild(closeBtn);
  
  document.body.appendChild(totpPanel);
  console.log('TOTP面板已添加到页面，位置:', totpPanel.style.cssText);
  
  // 定时更新
  setInterval(updateCodes, 1000);
  
  // 初始化后稍微延迟自动填充（仅在独立2FA页面）
  if (isStandalone2FAPage()) {
    setTimeout(autoFillCode, 2000);
  }
  
  // 更新验证码
  updateCodes();
  
  // 自动填充验证码
  if (isStandalone2FAPage()) {
    setTimeout(autoFillCode, 1000);
  }
}

function createSiteCard(siteName, siteData) {
  const card = document.createElement('div');
  card.style.cssText = 'margin-bottom: 12px; padding: 8px; border: 1px solid #eee; border-radius: 4px;';
  
  const name = document.createElement('div');
  name.textContent = siteName;
  name.style.cssText = 'font-size: 12px; color: #666; margin-bottom: 4px;';
  
  const code = document.createElement('div');
  code.className = 'totp-code';
  code.dataset.secret = siteData.secret;
  code.style.cssText = 'font-family: monospace; font-size: 18px; font-weight: bold; margin-bottom: 8px;';
  
  const progress = document.createElement('div');
  progress.className = 'totp-progress';
  progress.style.cssText = 'height: 4px; background: #eee; border-radius: 2px; overflow: hidden;';
  
  const progressBar = document.createElement('div');
  progressBar.className = 'totp-progress-bar';
  progressBar.style.cssText = 'height: 100%; background: #4caf50; transition: width 1s linear;';
  progress.appendChild(progressBar);
  
  const copyBtn = document.createElement('button');
  copyBtn.textContent = '复制';
  copyBtn.style.cssText = `
    margin-top: 8px;
    padding: 4px 8px;
    border: 1px solid #ccc;
    background: #f5f5f5;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    width: 100%;
  `;
  copyBtn.onclick = () => copyCodeWithFeedback(code.textContent, copyBtn);
  
  const fillBtn = document.createElement('button');
  fillBtn.textContent = '填充';
  fillBtn.style.cssText = `
    margin-top: 4px;
    padding: 4px 8px;
    border: 1px solid #007cba;
    background: #e7f3ff;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    width: 100%;
  `;
  fillBtn.onclick = () => fillCodeWithFeedback(code.textContent, fillBtn);
  
  card.appendChild(name);
  card.appendChild(code);
  card.appendChild(progress);
  card.appendChild(copyBtn);
  card.appendChild(fillBtn);
  
  return card;
}

function updateCodes() {
  if (!totpPanel) return;
  
  const codeElements = totpPanel.querySelectorAll('.totp-code');
  codeElements.forEach(element => {
    const secret = element.dataset.secret;
    if (secret) {
      const oldCode = element.textContent;
      const code = TOTP.generateTOTP(secret);
      const remaining = TOTP.getRemainingSeconds();
      
      element.textContent = code;
      
      // 如果验证码更新了且是独立2FA页面，尝试自动填充
      if (oldCode !== code && oldCode !== '------' && isStandalone2FAPage()) {
        setTimeout(autoFillCode, 500);
      }
      
      const progressBar = element.parentElement.querySelector('.totp-progress-bar');
      if (progressBar) {
        const percent = (remaining / 30) * 100;
        progressBar.style.width = percent + '%';
        progressBar.style.background = remaining <= 5 ? '#f44336' : '#4caf50';
      }
    }
  });
}

function copyCode(code) {
  navigator.clipboard.writeText(code).then(() => {
    console.log('验证码已复制');
  }).catch(() => {
    const textarea = document.createElement('textarea');
    textarea.value = code;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  });
}

function copyCodeWithFeedback(code, buttonElement) {
  navigator.clipboard.writeText(code).then(() => {
    showButtonFeedback(buttonElement, '已复制!', '#4caf50');
    console.log('验证码已复制');
  }).catch(() => {
    const textarea = document.createElement('textarea');
    textarea.value = code;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showButtonFeedback(buttonElement, '已复制!', '#4caf50');
  });
}

function fillCodeWithFeedback(code, buttonElement) {
  const inputs = findTOTPInputs();
  if (inputs.length > 0) {
    // 标记为插件填充，避免被清空
    inputs[0].dataset.userFocused = 'true';
    inputs[0].value = code;
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
    showButtonFeedback(buttonElement, '已填充!', '#007cba');
    console.log('验证码已填充');
  } else {
    showButtonFeedback(buttonElement, '未找到输入框', '#f44336');
  }
}

function showButtonFeedback(buttonElement, text, color) {
  const originalText = buttonElement.textContent;
  const originalBackground = buttonElement.style.background;
  const originalColor = buttonElement.style.color;
  
  buttonElement.textContent = text;
  buttonElement.style.background = color;
  buttonElement.style.color = 'white';
  
  setTimeout(() => {
    buttonElement.textContent = originalText;
    buttonElement.style.background = originalBackground;
    buttonElement.style.color = originalColor;
  }, 1000);
}

function fillCode(code) {
  const inputs = findTOTPInputs();
  if (inputs.length > 0) {
    inputs[0].value = code;
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
    console.log('验证码已填充');
  }
}

// 自动填充验证码
function autoFillCode() {
  // 判断是否为独立的2FA页面
  const isStandalone = isStandalone2FAPage();
  const inputs = findTOTPInputs();
  
  // 如果不是独立2FA页面，不自动填充
  if (!isStandalone) {
    return;
  }
  
  if (inputs.length > 0 && totpPanel) {
    const codeElement = totpPanel.querySelector('.totp-code');
    if (codeElement && codeElement.textContent && codeElement.textContent !== '------') {
      const code = codeElement.textContent;
      inputs[0].value = code;
      inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
      inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
      console.log('自动填充验证码:', code);
    }
  }
}

async function getSites() {
  return new Promise(resolve => {
    chrome.storage.sync.get(['totpSites'], result => {
      resolve(result.totpSites || {});
    });
  });
}

// 检查是否是安全设置页面（开启/关闭2FA的页面）
function isSecuritySettingsPage() {
  const url = window.location.href.toLowerCase();
  const path = window.location.pathname.toLowerCase();
  
  // 常见的安全设置页面标识
  const settingsKeywords = [
    'security', 'settings', 'account', 'profile', 'usercp',
    'two-factor', '2fa', 'authentication'
  ];
  
  return settingsKeywords.some(keyword => url.includes(keyword) || path.includes(keyword));
}

// 检查是否已开启2FA（通过检测页面中的TOTP密钥或二维码）
function is2FAEnabled() {
  // 检测页面中是否有TOTP密钥或二维码
  const totpKey = findTOTPKeyInPage();
  
  // 如果找到了TOTP密钥或二维码，说明正在设置2FA（未开启）
  // 如果没找到，说明已开启2FA
  return !totpKey;
}

// 在页面中查找TOTP密钥
function findTOTPKeyInPage() {
  const pageText = document.body.textContent;
  
  // 1. 查找二维码中的otpauth URL
  const qrImages = document.querySelectorAll('img, canvas');
  for (const img of qrImages) {
    // 检查图片的alt或title属性
    const alt = (img.alt || '').toLowerCase();
    const title = (img.title || '').toLowerCase();
    if (alt.includes('qr') || alt.includes('二维码') || title.includes('qr') || title.includes('二维码')) {
      // 尝试从二维码中提取密钥（这里只是检测存在）
      return 'QR_CODE_FOUND';
    }
  }
  
  // 2. 查找Base32格式的TOTP密钥
  const base32Pattern = /[A-Z2-7]{16,}/g;
  const matches = pageText.match(base32Pattern);
  
  if (matches) {
    for (const match of matches) {
      // 过滤掉明显不是TOTP密钥的字符串
      if (match.length >= 16 && match.length <= 64) {
        // 检查周围文本是否与2FA相关
        const context = getTextContext(pageText, match);
        if (context.includes('secret') || context.includes('key') || 
            context.includes('密钥') || context.includes('秘钥') ||
            context.includes('密鑰') || context.includes('秘鑰') ||
            context.includes('totp') || context.includes('2fa')) {
          return match;
        }
      }
    }
  }
  
  // 3. 查承otpauth:// URL
  const otpauthPattern = /otpauth:\/\/totp\/[^\s]+/gi;
  const otpauthMatches = pageText.match(otpauthPattern);
  
  if (otpauthMatches && otpauthMatches.length > 0) {
    // 从 otpauth URL 中提取 secret 参数
    const url = otpauthMatches[0];
    const secretMatch = url.match(/secret=([A-Z2-7]+)/i);
    if (secretMatch) {
      return secretMatch[1];
    }
  }
  
  // 4. 查找输入框中的密钥
  const inputs = document.querySelectorAll('input[type="text"], input[type="password"], textarea');
  for (const input of inputs) {
    const value = input.value;
    if (value && /^[A-Z2-7]{16,}$/.test(value)) {
      return value;
    }
  }
  
  return null;
}

// 强制创建验证码面板
function createVerificationPanel(matchedSites) {
  if (totpPanel) {
    totpPanel.remove();
    totpPanel = null;
  }
  
  totpPanel = document.createElement('div');
  totpPanel.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: white;
    border: 1px solid #ccc;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    font-family: Arial, sans-serif;
    min-width: 200px;
    cursor: move;
  `;
  
  // 添加拖拽功能
  makeDraggable(totpPanel);
  
  const title = document.createElement('div');
  title.textContent = 'TOTP验证码';
  title.style.cssText = 'font-weight: bold; margin-bottom: 12px; font-size: 14px;';
  totpPanel.appendChild(title);
  
  for (const [siteName, siteData] of matchedSites) {
    const siteDiv = createSiteCard(siteName, siteData);
    totpPanel.appendChild(siteDiv);
  }
  
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.style.cssText = `
    position: absolute;
    top: 4px;
    right: 8px;
    border: none;
    background: none;
    font-size: 18px;
    cursor: pointer;
    color: #999;
  `;
  closeBtn.onclick = () => {
    totpPanel.remove();
    totpPanel = null;
    // 关闭后重新检查是否需要显示表单面板
    setTimeout(() => {
      if (isSecuritySettingsPage() && !is2FAEnabled()) {
        checkAndShowPanel();
      }
      // 如果是action=security页面且未开启2FA，清空验证码框
      const url = window.location.href.toLowerCase();
      if (url.includes('action=security') && !is2FAEnabled()) {
        clearTOTPInputs();
      }
    }, 100);
  };
  totpPanel.appendChild(closeBtn);
  
  document.body.appendChild(totpPanel);
  
  // 定时更新
  setInterval(updateCodes, 1000);
  updateCodes();
}

// 获取文本上下文
function getTextContext(text, target) {
  const index = text.indexOf(target);
  if (index === -1) return '';
  
  const start = Math.max(0, index - 50);
  const end = Math.min(text.length, index + target.length + 50);
  
  return text.substring(start, end).toLowerCase();
}

// 获取元素的DOM层级
function getElementLevel(element) {
  let level = 0;
  let current = element;
  while (current.parentElement) {
    level++;
    current = current.parentElement;
  }
  return level;
}

// 创建添加站点面板
function createAddSitePanel() {
  // 自动检测页面中的TOTP密钥
  const detectedKey = findTOTPKeyInPage();
  const autoKey = (detectedKey && detectedKey !== 'QR_CODE_FOUND') ? detectedKey : '';
  
  totpPanel = document.createElement('div');
  totpPanel.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: white;
    border: 1px solid #ccc;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    font-family: Arial, sans-serif;
    min-width: 280px;
    cursor: move;
  `;
  
  totpPanel.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
      <span>添加站点</span>
      <button onclick="this.closest('div').parentElement.remove(); totpPanel = null;" style="border: none; background: none; font-size: 18px; color: #999; cursor: pointer;">×</button>
    </div>
    <div style="margin-bottom: 12px;">
      <label style="display: block; margin-bottom: 4px; font-size: 12px;">站点名称</label>
      <input type="text" id="site-name-input" value="${window.location.hostname}" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
    </div>
    <div style="margin-bottom: 12px;">
      <label style="display: block; margin-bottom: 4px; font-size: 12px;">TOTP密钥 ${autoKey ? '(已自动检测)' : ''}</label>
      <input type="text" id="site-secret-input" value="${autoKey}" placeholder="Base32格式密钥" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
    </div>
    <div style="margin-bottom: 12px;">
      <label style="display: block; margin-bottom: 4px; font-size: 12px;">域名</label>
      <input type="text" id="site-domain-input" value="${window.location.hostname}" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
    </div>
    <button id="save-site-btn" style="width: 100%; padding: 8px; background: #007cba; color: white; border: none; border-radius: 4px; cursor: pointer;">保存</button>
  `;
  
  document.body.appendChild(totpPanel);
  
  // 添加拖拽功能
  makeDraggable(totpPanel);
  
  // 添加保存事件
  document.getElementById('save-site-btn').addEventListener('click', saveSiteFromPanel);
}

// 创建编辑站点面板
function createEditSitePanel(siteEntry) {
  const [siteName, siteData] = siteEntry;
  
  totpPanel = document.createElement('div');
  totpPanel.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: white;
    border: 1px solid #ccc;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    font-family: Arial, sans-serif;
    min-width: 280px;
    cursor: move;
  `;
  
  const domains = siteData.domains ? siteData.domains.join(', ') : '';
  
  totpPanel.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
      <span>编辑站点</span>
      <button onclick="this.closest('div').parentElement.remove(); totpPanel = null;" style="border: none; background: none; font-size: 18px; color: #999; cursor: pointer;">×</button>
    </div>
    <div style="margin-bottom: 12px;">
      <label style="display: block; margin-bottom: 4px; font-size: 12px;">站点名称</label>
      <input type="text" id="site-name-input" value="${siteName}" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
    </div>
    <div style="margin-bottom: 12px;">
      <label style="display: block; margin-bottom: 4px; font-size: 12px;">TOTP密钥</label>
      <input type="text" id="site-secret-input" value="${siteData.secret}" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
    </div>
    <div style="margin-bottom: 12px;">
      <label style="display: block; margin-bottom: 4px; font-size: 12px;">域名</label>
      <input type="text" id="site-domain-input" value="${domains}" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
    </div>
    <div style="display: flex; gap: 8px;">
      <button id="save-site-btn" style="flex: 1; padding: 8px; background: #007cba; color: white; border: none; border-radius: 4px; cursor: pointer;">保存</button>
      <button id="delete-site-btn" style="flex: 1; padding: 8px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">删除</button>
    </div>
  `;
  
  document.body.appendChild(totpPanel);
  
  // 添加拖拽功能
  makeDraggable(totpPanel);
  
  // 添加事件监听
  document.getElementById('save-site-btn').addEventListener('click', () => saveSiteFromPanel(siteName));
  document.getElementById('delete-site-btn').addEventListener('click', () => deleteSiteFromPanel(siteName));
}

// 从面板保存站点
async function saveSiteFromPanel(originalName = null) {
  const name = document.getElementById('site-name-input').value.trim();
  const secret = document.getElementById('site-secret-input').value.trim().toUpperCase();
  const domainInput = document.getElementById('site-domain-input').value.trim();
  
  if (!name || !secret) {
    alert('请填写站点名称和密钥');
    return;
  }
  
  if (!/^[A-Z2-7]+$/.test(secret)) {
    alert('密钥格式不正确，请使用Base32格式');
    return;
  }
  
  const domains = domainInput ? domainInput.split(',').map(d => d.trim()).filter(d => d) : [];
  
  const sites = await getSites();
  
  // 如果是编辑模式且名称改变了，删除原名称
  if (originalName && originalName !== name) {
    delete sites[originalName];
  }
  
  sites[name] = {
    secret: secret,
    domains: domains,
    createdAt: new Date().toISOString()
  };
  
  await new Promise(resolve => {
    chrome.storage.sync.set({ totpSites: sites }, resolve);
  });
  
  // 关闭面板
  totpPanel.remove();
  totpPanel = null;
  
  console.log('站点保存成功');
  
  // 自动切换到验证码面板并填入验证码
  setTimeout(async () => {
    // 重新检查页面状态，强制显示验证码面板
    const sites = await getSites();
    const currentDomain = window.location.hostname;
    const matchedSites = Object.entries(sites).filter(([name, data]) => 
      data.domains && data.domains.some(domain => matchDomain(currentDomain, domain))
    );
    
    if (matchedSites.length > 0) {
      // 强制创建验证码面板
      createVerificationPanel(matchedSites);
      // 如果是从security页面保存后跳转来的，立即自动填充
      setTimeout(() => {
        clearTOTPInputs(); // 先清空
        setTimeout(autoFillCode, 100); // 再填充
      }, 1000);
    }
  }, 500);
}

// 从面板删除站点
async function deleteSiteFromPanel(siteName) {
  const sites = await getSites();
  delete sites[siteName];
  
  await new Promise(resolve => {
    chrome.storage.sync.set({ totpSites: sites }, resolve);
  });
  
  // 关闭面板
  totpPanel.remove();
  totpPanel = null;
  
  console.log('站点删除成功');
}

// 使元素可拖拽
function makeDraggable(element) {
  let isDragging = false;
  let startX, startY, startLeft, startTop;
  
  element.addEventListener('mousedown', (e) => {
    // 只有点击面板本身才开始拖拽，不包括按钮和输入框
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') {
      return;
    }
    
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startLeft = parseInt(window.getComputedStyle(element).left, 10) || 0;
    startTop = parseInt(window.getComputedStyle(element).top, 10) || 0;
    
    element.style.cursor = 'grabbing';
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    element.style.left = (startLeft + deltaX) + 'px';
    element.style.top = (startTop + deltaY) + 'px';
    element.style.right = 'auto';
    element.style.bottom = 'auto';
  });
  
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      element.style.cursor = 'move';
    }
  });
}



// 清空验证码输入框
function clearTOTPInputs() {
  const inputs = findTOTPInputs();
  inputs.forEach(input => {
    input.value = '';
  });
}

// 通配符域名匹配函数
function matchDomain(currentDomain, pattern) {
  // 如果没有通配符，使用原有的包含匹配
  if (!pattern.includes('*')) {
    return currentDomain.includes(pattern);
  }
  
  // 将通配符转换为正则表达式
  const regexPattern = pattern
    .replace(/\./g, '\\.')  // 转义点号
    .replace(/\*/g, '.*');   // 通配符转换为正则
  
  const regex = new RegExp(`^${regexPattern}$`, 'i');
  return regex.test(currentDomain);
}

// 初始化 - 更宽松的检测条件
async function checkAndShowPanel() {
  const hasInputs = findTOTPInputs().length > 0;
  const isAuth = isAuthPage();
  const url = window.location.href.toLowerCase();
  
  console.log('TOTP检测:', {
    hasInputs,
    isAuth,
    url: window.location.href,
    domain: window.location.hostname
  });
  
  console.log('检查action=security条件:', {
    urlIncludesSecurity: url.includes('action=security'),
    hasInputs: hasInputs,
    bothTrue: url.includes('action=security') && hasInputs
  });
  
  // 如果是action=security页面且已开启2FA，清空验证码框并监听自动填充
  if (url.includes('action=security') && hasInputs && is2FAEnabled()) {
    console.log('执行清空逻辑');
    clearTOTPInputs();
    // 延迟监听，避免拦截用户主动输入
    setTimeout(() => {
      const inputs = findTOTPInputs();
      inputs.forEach(input => {
        let lastClearTime = 0;
        input.addEventListener('input', (e) => {
          const now = Date.now();
          // 如果是快速连续输入（可能是自动填充），且距离上次清空超过1秒
          if (input.value && now - lastClearTime > 1000) {
            // 检查是否是用户主动点击后的输入（通过检查焦点时间）
            if (!input.dataset.userFocused) {
              input.value = '';
              lastClearTime = now;
            }
          }
        });
        
        // 记录用户焦点状态
        input.addEventListener('focus', () => {
          input.dataset.userFocused = 'true';
          setTimeout(() => {
            delete input.dataset.userFocused;
          }, 2000); // 2秒内的输入认为是用户主动输入
        });
      });
    }, 1000);
  }
  
  // 调试：显示站点配置信息
  const sites = await getSites();
  console.log('已配置站点:', Object.keys(sites));
  const currentDomain = window.location.hostname;
  const matchedSites = Object.entries(sites).filter(([name, data]) => 
    data.domains && data.domains.some(domain => matchDomain(currentDomain, domain))
  );
  console.log('匹配的站点:', matchedSites.map(([name]) => name));
  
  // 同时满足有输入框和是验证页面才显示
  if (hasInputs && isAuth) {
    console.log('开始创建TOTP面板');
    createTOTPPanel();
  } else {
    console.log('未显示面板原因:', { hasInputs, isAuth });
  }
}

setTimeout(() => {
  console.log('开始执行checkAndShowPanel');
  checkAndShowPanel();
}, 1000);

// 监听DOM变化
const observer = new MutationObserver(() => {
  if (!totpPanel) {
    console.log('DOM变化触发checkAndShowPanel');
    checkAndShowPanel();
  }
});

observer.observe(document.body, { childList: true, subtree: true });