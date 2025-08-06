// 弹窗脚本
let updateInterval;

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup 已加载');
  await loadSites();
  // 立即更新一次验证码
  updateAllCodes();
  updateInterval = setInterval(updateAllCodes, 1000);
  
  // 添加按钮事件监听器
  const addBtn = document.getElementById('add-site-btn');
  const manageBtn = document.getElementById('manage-site-btn');
  const quickAddBtn = document.getElementById('quick-add-btn');
  const cancelBtn = document.getElementById('cancel-add-btn');
  
  if (addBtn) {
    addBtn.addEventListener('click', showAddForm);
    console.log('添加站点按钮事件已绑定');
  }
  
  if (manageBtn) {
    manageBtn.addEventListener('click', openOptions);
    console.log('管理站点按钮事件已绑定');
  }
  
  if (quickAddBtn) {
    quickAddBtn.addEventListener('click', quickAdd);
  }
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', hideAddForm);
  }
  
  // 为设置按钮添加事件监听
  const settingsBtn = document.getElementById('settings-button');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', openOptions);
  }
  
  // 为复制按钮添加事件监听
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('copy-button')) {
      const siteName = e.target.dataset.site;
      copyCode(siteName, e.target);
    }
  });
});

async function loadSites() {
  const sites = await getSites();
  const container = document.getElementById('codes-container');
  
  container.innerHTML = '';
  
  if (Object.keys(sites).length === 0) {
    container.innerHTML = '<div style="color: #999; text-align: center; padding: 20px;">暂无站点配置</div>';
    return;
  }
  
  for (const [siteName, siteData] of Object.entries(sites)) {
    const card = createSiteCard(siteName, siteData);
    container.appendChild(card);
  }
}

function createSiteCard(siteName, siteData) {
  const card = document.createElement('div');
  card.className = 'code-card';
  
  // 立即生成验证码
  let code = '------';
  let remaining = 30;
  try {
    code = TOTP.generateTOTP(siteData.secret);
    remaining = TOTP.getRemainingSeconds();
  } catch (error) {
    console.error('生成TOTP失败:', error);
    code = '错误';
  }
  
  const percent = (remaining / 30) * 100;
  const progressColor = remaining <= 5 ? '#f44336' : '#4caf50';
  
  card.innerHTML = `
    <div class="site-name" style="font-weight: bold; margin-bottom: 5px; color: #333;">${siteName}</div>
    <div class="code" style="font-size: 20px; font-family: monospace; letter-spacing: 2px; margin: 5px 0; color: #1976d2;" data-secret="${siteData.secret}">${code}</div>
    <div class="progress-container" style="position: relative; height: 20px; margin-top: 5px;">
      <div class="progress-bar" style="height: 4px; background-color: ${progressColor}; width: ${percent}%; position: absolute; bottom: 0; border-radius: 2px;"></div>
      <div class="time-text" style="position: absolute; right: 0; font-size: 12px; color: #666;">${remaining}秒</div>
    </div>
    <button class="copy-button" data-site="${siteName}" style="background-color: #e0e0e0; border: none; padding: 5px 10px; border-radius: 4px; margin-top: 5px; cursor: pointer; font-size: 12px; width: 100%;">复制</button>
  `;
  
  return card;
}

function updateAllCodes() {
  const codeElements = document.querySelectorAll('.code');
  
  codeElements.forEach(element => {
    const secret = element.dataset.secret;
    if (secret) {
      try {
        const code = TOTP.generateTOTP(secret);
        const remaining = TOTP.getRemainingSeconds();
        
        element.textContent = code;
        
        const card = element.closest('.code-card');
        const progressBar = card.querySelector('.progress-bar');
        const timeText = card.querySelector('.time-text');
        
        const percent = (remaining / 30) * 100;
        const progressColor = remaining <= 5 ? '#f44336' : '#4caf50';
        
        if (progressBar) {
          progressBar.style.width = percent + '%';
          progressBar.style.backgroundColor = progressColor;
        }
        if (timeText) {
          timeText.textContent = remaining + '秒';
        }
      } catch (error) {
        element.textContent = '错误';
        console.error('生成TOTP失败:', error);
      }
    }
  });
}

async function copyCode(siteName, buttonElement) {
  const sites = await getSites();
  const siteData = sites[siteName];
  
  if (siteData && siteData.secret) {
    const code = TOTP.generateTOTP(siteData.secret);
    
    // 使用降级方案确保复制成功
    try {
      const textarea = document.createElement('textarea');
      textarea.value = code;
      textarea.style.position = 'fixed';
      textarea.style.left = '-999999px';
      textarea.style.top = '-999999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      
      document.execCommand('copy');
      document.body.removeChild(textarea);
      
      // 显示复制成功提示
      if (buttonElement) {
        const originalText = buttonElement.textContent;
        buttonElement.textContent = '已复制!';
        buttonElement.style.background = '#4caf50';
        buttonElement.style.color = 'white';
        
        setTimeout(() => {
          buttonElement.textContent = originalText;
          buttonElement.style.background = '';
          buttonElement.style.color = '';
        }, 1000);
      }
      
      console.log('验证码已复制到剪贴板: ' + code);
      
    } catch (error) {
      console.error('复制失败:', error);
      if (buttonElement) {
        const originalText = buttonElement.textContent;
        buttonElement.textContent = '已复制!';
        buttonElement.style.background = '#4caf50';
        buttonElement.style.color = 'white';
        
        setTimeout(() => {
          buttonElement.textContent = originalText;
          buttonElement.style.background = '';
          buttonElement.style.color = '';
        }, 1000);
      }
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

function openOptions() {
  console.log('尝试打开选项页面');
  const url = chrome.runtime.getURL('options.html');
  console.log('选项页面URL:', url);
  
  chrome.tabs.create({ url: url }, (tab) => {
    if (chrome.runtime.lastError) {
      console.error('打开选项页面失败:', chrome.runtime.lastError);
      // 降级方案：直接在当前窗口打开
      window.open(url, '_blank');
    } else {
      console.log('选项页面已打开');
      window.close(); // 关闭弹窗
    }
  });
}

function showAddForm() {
  document.getElementById('add-form').style.display = 'block';
}

function hideAddForm() {
  document.getElementById('add-form').style.display = 'none';
  document.getElementById('quick-name').value = '';
  document.getElementById('quick-secret').value = '';
}

async function quickAdd() {
  const name = document.getElementById('quick-name').value.trim();
  const secret = document.getElementById('quick-secret').value.trim().toUpperCase();
  
  if (!name || !secret) {
    alert('请填写站点名称和密钥');
    return;
  }
  
  if (!/^[A-Z2-7]+$/.test(secret)) {
    alert('密钥格式不正确');
    return;
  }
  
  const sites = await getSites();
  sites[name] = {
    secret: secret,
    domains: [], // 快速添加不设置域名，可在设置页面修改
    createdAt: new Date().toISOString()
  };
  
  await new Promise(resolve => {
    chrome.storage.sync.set({ totpSites: sites }, resolve);
  });
  
  hideAddForm();
  await loadSites();
  alert('站点添加成功！');
}