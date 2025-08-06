// 选项页面脚本
document.addEventListener('DOMContentLoaded', () => {
  loadSites();
  
  document.getElementById('site-form').addEventListener('submit', addSite);
  document.getElementById('import-file').addEventListener('change', handleImport);
  
  // 添加其他按钮事件监听
  document.getElementById('test-secret-btn').addEventListener('click', testSecret);
  document.getElementById('export-btn').addEventListener('click', exportData);
  document.getElementById('import-btn').addEventListener('click', importData);
  document.getElementById('import-qr-btn').addEventListener('click', importQRCodes);
  document.getElementById('import-qr-files').addEventListener('change', handleQRImport);
  document.getElementById('import-google-btn').addEventListener('click', importGoogleAuth);
  document.getElementById('import-google-qr').addEventListener('change', handleGoogleQRImport);
  document.getElementById('select-all').addEventListener('change', toggleSelectAll);
  document.getElementById('delete-selected-btn').addEventListener('click', deleteSelected);
  
  // 为站点操作按钮添加事件委托
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('edit-btn')) {
      const siteName = e.target.dataset.site;
      editSite(siteName);
    } else if (e.target.classList.contains('delete-btn')) {
      const siteName = e.target.dataset.site;
      deleteSite(siteName);
    } else if (e.target.classList.contains('save-edit-btn')) {
      const originalName = e.target.dataset.original;
      saveEdit(originalName);
    } else if (e.target.classList.contains('cancel-edit-btn')) {
      const originalName = e.target.dataset.original;
      cancelEdit(originalName);
    }
  });
});

async function loadSites() {
  const sites = await getSites();
  const container = document.getElementById('sites-container');
  
  if (Object.keys(sites).length === 0) {
    container.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">暂无站点配置</p>';
    return;
  }
  
  container.innerHTML = '';
  
  Object.entries(sites).forEach(([siteName, siteData], index) => {
    const siteItem = createSiteItem(siteName, siteData, index);
    container.appendChild(siteItem);
  });
  
  // 添加复选框事件监听
  document.querySelectorAll('.site-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', updateDeleteButton);
  });
  
  updateDeleteButton();
}

function createSiteItem(siteName, siteData, index) {
  const item = document.createElement('div');
  item.className = 'site-item';
  
  const domains = siteData.domains ? siteData.domains.join(', ') : '无';
  
  item.innerHTML = `
    <div style="display: flex; align-items: center; margin-right: 16px;">
      <span style="margin-right: 8px; color: #666; font-size: 14px;">${index + 1}.</span>
      <input type="checkbox" class="site-checkbox" data-site="${siteName}" style="margin-right: 8px;">
    </div>
    <div class="site-info" style="flex-grow: 1;">
      <h3>${siteName}</h3>
      <p>域名: ${domains}</p>
      <p>密钥: ${siteData.secret.substring(0, 8)}...</p>
    </div>
    <div class="site-actions">
      <button class="btn-secondary edit-btn" data-site="${siteName}">编辑</button>
      <button class="btn-danger delete-btn" data-site="${siteName}">删除</button>
    </div>
  `;
  
  return item;
}

async function addSite(event) {
  event.preventDefault();
  
  const name = document.getElementById('site-name').value.trim();
  const secret = document.getElementById('site-secret').value.trim().toUpperCase();
  const domainsText = document.getElementById('site-domains').value.trim();
  
  if (!name || !secret) {
    alert('请填写站点名称和密钥');
    return;
  }
  
  // 验证密钥格式
  if (!/^[A-Z2-7]+$/.test(secret)) {
    alert('密钥格式不正确，请使用Base32格式（A-Z, 2-7）');
    return;
  }
  
  // 自动更正域名格式：支持多行、中文逗号、英文逗号分隔，去除重复
  let domains = [];
  if (domainsText) {
    domains = [...new Set(domainsText
      .replace(/，/g, ',')  // 中文逗号转英文逗号
      .split(/[,\n]/)      // 按逗号或换行分割
      .map(d => d.trim())  // 去除空格
      .filter(d => d))]    // 过滤空值后去重
    
    // 更新输入框显示为标准格式
    document.getElementById('site-domains').value = domains.join('\n');
  }
  
  const sites = await getSites();
  sites[name] = {
    secret: secret,
    domains: domains,
    createdAt: new Date().toISOString()
  };
  
  await saveSites(sites);
  
  // 清空表单
  document.getElementById('site-form').reset();
  
  // 重新加载列表
  await loadSites();
  
  showMessage('站点添加成功！');
}

async function deleteSite(siteName) {
  if (!confirm(`确定要删除站点 "${siteName}" 吗？`)) {
    return;
  }
  
  const sites = await getSites();
  delete sites[siteName];
  await saveSites(sites);
  
  await loadSites();
  showMessage('站点删除成功！');
}

async function editSite(siteName) {
  const sites = await getSites();
  const siteData = sites[siteName];
  
  if (!siteData) return;
  
  // 找到对应的站点项
  const siteItems = document.querySelectorAll('.site-item');
  let targetItem = null;
  
  for (const item of siteItems) {
    const editBtn = item.querySelector('.edit-btn');
    if (editBtn && editBtn.dataset.site === siteName) {
      targetItem = item;
      break;
    }
  }
  
  if (!targetItem) return;
  
  // 创建编辑表单
  const editForm = document.createElement('div');
  editForm.className = 'site-item';
  editForm.style.background = '#f0f8ff';
  editForm.style.border = '2px solid #007cba';
  
  const domains = siteData.domains ? siteData.domains.join(', ') : '';
  
  editForm.innerHTML = `
    <div style="display: flex; align-items: center; margin-right: 16px;">
      <span style="margin-right: 8px; color: #666; font-size: 14px;">${Array.from(document.querySelectorAll('.site-item')).indexOf(targetItem) + 1}.</span>
      <input type="checkbox" class="site-checkbox" style="margin-right: 8px;" disabled>
    </div>
    <div style="flex-grow: 1;">
      <div style="margin-bottom: 8px;">
        <label style="display: block; font-size: 12px; color: #555; margin-bottom: 4px; font-weight: bold;">站点名称</label>
        <input type="text" id="edit-name-${siteName}" value="${siteName}" style="width: 100%; padding: 8px 12px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
      </div>
      <div style="margin-bottom: 8px;">
        <label style="display: block; font-size: 12px; color: #555; margin-bottom: 4px; font-weight: bold;">TOTP密钥</label>
        <input type="text" id="edit-secret-${siteName}" value="${siteData.secret}" style="width: 100%; padding: 8px 12px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
      </div>
      <div style="margin-bottom: 8px;">
        <label style="display: block; font-size: 12px; color: #555; margin-bottom: 4px; font-weight: bold;">匹配域名</label>
        <input type="text" id="edit-domains-${siteName}" value="${domains}" placeholder="用逗号分隔，例如: github.com, www.github.com" style="width: 100%; padding: 8px 12px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
      </div>
    </div>
    <div class="site-actions">
      <button class="btn-primary save-edit-btn" data-original="${siteName}" style="margin-left: 8px;">保存</button>
      <button class="btn-secondary cancel-edit-btn" data-original="${siteName}" style="margin-left: 8px;">取消</button>
    </div>
  `;
  
  // 替换原站点项
  targetItem.style.display = 'none';
  targetItem.parentNode.insertBefore(editForm, targetItem.nextSibling);
}

function testSecret() {
  const secret = document.getElementById('site-secret').value.trim().toUpperCase();
  
  if (!secret) {
    alert('请先输入密钥');
    return;
  }
  
  try {
    const code = TOTP.generateTOTP(secret);
    const remaining = TOTP.getRemainingSeconds();
    alert(`测试成功！\n当前验证码: ${code}\n剩余时间: ${remaining}秒`);
  } catch (error) {
    alert('密钥格式错误或无效: ' + error.message);
  }
}

async function exportData() {
  const sites = await getSites();
  const data = {
    version: '1.0',
    exportTime: new Date().toISOString(),
    sites: sites
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `totp-sites-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
}

function importData() {
  document.getElementById('import-file').click();
}

async function handleImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    if (!data.sites) {
      alert('导入文件格式不正确');
      return;
    }
    
    if (confirm('导入将覆盖现有配置，确定继续吗？')) {
      await saveSites(data.sites);
      await loadSites();
      showMessage('配置导入成功！');
    }
  } catch (error) {
    alert('导入失败: ' + error.message);
  }
  
  // 清空文件选择
  event.target.value = '';
}

async function getSites() {
  return new Promise(resolve => {
    chrome.storage.sync.get(['totpSites'], result => {
      resolve(result.totpSites || {});
    });
  });
}

async function saveSites(sites) {
  return new Promise(resolve => {
    chrome.storage.sync.set({ totpSites: sites }, resolve);
  });
}

function showMessage(text) {
  const message = document.getElementById('success-message');
  message.textContent = text;
  message.style.display = 'block';
  
  setTimeout(() => {
    message.style.display = 'none';
  }, 3000);
}

function importQRCodes() {
  document.getElementById('import-qr-files').click();
}

async function handleQRImport(event) {
  const files = Array.from(event.target.files);
  if (files.length === 0) return;
  
  let successCount = 0;
  let failCount = 0;
  
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    
    try {
      const secret = await extractSecretFromQR(file);
      if (secret) {
        const siteName = file.name.replace(/\.[^/.]+$/, ''); // 移除扩展名
        const sites = await getSites();
        
        sites[siteName] = {
          secret: secret,
          domains: [],
          createdAt: new Date().toISOString()
        };
        
        await saveSites(sites);
        successCount++;
      } else {
        failCount++;
      }
    } catch (error) {
      console.error(`处理文件 ${file.name} 失败:`, error);
      failCount++;
    }
  }
  
  await loadSites();
  showMessage(`导入完成！成功: ${successCount}, 失败: ${failCount}`);
  
  // 清空文件选择
  event.target.value = '';
}

async function extractSecretFromQR(file) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = function() {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code && code.data) {
          const otpauthUrl = code.data;
          if (otpauthUrl.startsWith('otpauth://totp/')) {
            const secretMatch = otpauthUrl.match(/secret=([A-Z2-7]+)/i);
            if (secretMatch) {
              resolve(secretMatch[1]);
              return;
            }
          }
        }
      } catch (error) {
        console.error('解析二维码失败:', error);
      }
      
      resolve(null);
    };
    
    img.onerror = () => resolve(null);
    img.src = URL.createObjectURL(file);
  });
}

function importGoogleAuth() {
  document.getElementById('import-google-qr').click();
}

async function handleGoogleQRImport(event) {
  const files = Array.from(event.target.files);
  if (files.length === 0) return;
  
  const sites = await getSites();
  let totalSuccessCount = 0;
  
  for (const file of files) {
    try {
      console.log(`处理文件: ${file.name}`);
      const googleData = await extractGoogleAuthFromQR(file);
      if (googleData && googleData.length > 0) {
        for (const account of googleData) {
          if (account.name && account.secret) {
            // 优先使用realIssuer，其次使用issuer
            let displayName = account.name;
            const finalIssuer = account.realIssuer || account.issuer;
            if (finalIssuer && finalIssuer !== account.name) {
              displayName = `${finalIssuer} (${account.name})`;
            }
            
            // 如果名称已存在，添加后缀区分
            let finalName = displayName;
            let counter = 1;
            while (sites[finalName]) {
              finalName = `${displayName}_${counter}`;
              counter++;
            }
            
            sites[finalName] = {
              secret: account.secret,
              domains: [],
              createdAt: new Date().toISOString()
            };
            totalSuccessCount++;
          }
        }
      }
    } catch (error) {
      console.error(`处理文件 ${file.name} 失败:`, error);
    }
  }
  
  if (totalSuccessCount > 0) {
    await saveSites(sites);
    await loadSites();
    showMessage(`Google验证器导入成功！共导入 ${totalSuccessCount} 个账户`);
  } else {
    showMessage('未能从二维码中解析到Google验证器数据');
  }
  
  event.target.value = '';
}

async function extractGoogleAuthFromQR(file) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = function() {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code && code.data && code.data.startsWith('otpauth-migration://')) {
          const accounts = parseGoogleAuthData(code.data);
          resolve(accounts);
        } else {
          resolve(null);
        }
      } catch (error) {
        console.error('解析Google验证器二维码失败:', error);
        resolve(null);
      }
    };
    
    img.onerror = () => resolve(null);
    img.src = URL.createObjectURL(file);
  });
}

function parseGoogleAuthData(url) {
  try {
    const urlObj = new URL(url);
    const data = urlObj.searchParams.get('data');
    if (!data) return [];
    
    console.log('开始解析Google验证器数据...');
    
    // URL解码 + Base64解码
    const decoded = decodeURIComponent(data);
    const binaryString = atob(decoded);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    console.log('总字节数:', bytes.length);
    
    const accounts = [];
    let pos = 0;
    let entryCount = 0;
    
    // 首先统计有多少个条目
    for (let i = 0; i < bytes.length - 1; i++) {
      if (bytes[i] === 0x0A && i + 1 < bytes.length) {
        entryCount++;
      }
    }
    console.log('检测到的条目数量:', entryCount);
    
    while (pos < bytes.length) {
      if (bytes[pos] === 0x0A && pos + 1 < bytes.length) {
        pos++; // 跳过0x0A
        
        // 读取长度（可能是多字节）
        let length = 0;
        let lengthBytes = 0;
        
        // 处理varint编码的长度
        while (pos < bytes.length && (bytes[pos] & 0x80) !== 0) {
          length |= (bytes[pos] & 0x7F) << (7 * lengthBytes);
          lengthBytes++;
          pos++;
        }
        if (pos < bytes.length) {
          length |= bytes[pos] << (7 * lengthBytes);
          pos++;
        }
        
        console.log(`条目 ${accounts.length + 1}: 位置=${pos}, 长度=${length}`);
        
        if (pos + length <= bytes.length) {
          const entryBytes = bytes.slice(pos, pos + length);
          const account = parseAccountEntry(entryBytes, accounts.length + 1);
          if (account) {
            if (account.name && account.secret) {
              accounts.push(account);
              console.log(`成功解析条目: ${account.name}`);
            } else {
              console.warn(`条目信息不完整:`, account);
            }
          }
          pos += length;
        } else {
          console.error(`条目长度超出范围: pos=${pos}, length=${length}, total=${bytes.length}`);
          break;
        }
      } else {
        pos++;
      }
    }
    
    console.log(`解析完成，共得到 ${accounts.length} 个账户`);
    return accounts;
  } catch (error) {
    console.error('解析Google验证器数据失败:', error);
    return [];
  }
}

function parseAccountEntry(bytes, entryIndex) {
  let pos = 0;
  const account = {};
  
  console.log(`  解析条目 ${entryIndex}:`);
  
  while (pos < bytes.length) {
    if (pos >= bytes.length) break;
    
    const fieldTag = bytes[pos];
    pos++;
    
    console.log(`    字段标签: 0x${fieldTag.toString(16)} (${fieldTag})`);
    
    if (fieldTag === 0x0A) { // 密钥字段
      if (pos >= bytes.length) break;
      const keyLength = bytes[pos];
      pos++;
      if (pos + keyLength <= bytes.length) {
        const keyBytes = bytes.slice(pos, pos + keyLength);
        account.secret = toBase32(keyBytes);
        console.log(`    密钥: ${account.secret}`);
        pos += keyLength;
      }
      
    } else if (fieldTag === 0x12) { // 名称字段
      if (pos >= bytes.length) break;
      const nameLength = bytes[pos];
      pos++;
      if (pos + nameLength <= bytes.length) {
        const nameBytes = bytes.slice(pos, pos + nameLength);
        account.name = new TextDecoder('utf-8').decode(nameBytes);
        console.log(`    名称: ${account.name}`);
        pos += nameLength;
      }
      
    } else if (fieldTag === 0x20) { // 类型字段
      if (pos >= bytes.length) break;
      account.type = bytes[pos];
      console.log(`    类型: ${account.type}`);
      pos++;
      
    } else if (fieldTag === 0x28) { // 算法字段
      if (pos >= bytes.length) break;
      account.algorithm = bytes[pos];
      console.log(`    算法: ${account.algorithm}`);
      pos++;
      
    } else if (fieldTag === 0x30) { // 位数字段
      if (pos >= bytes.length) break;
      account.digits = bytes[pos];
      console.log(`    位数: ${account.digits}`);
      pos++;
      
    } else if (fieldTag === 0x42) { // 发行者字段
      if (pos >= bytes.length) break;
      const issuerLength = bytes[pos];
      pos++;
      if (pos + issuerLength <= bytes.length) {
        const issuerBytes = bytes.slice(pos, pos + issuerLength);
        const issuerHex = Array.from(issuerBytes).map(b => b.toString(16).padStart(2, '0')).join('');
        console.log(`    发行者十六进制: ${issuerHex}`);
        
        // 使用映射表解析发行者名称
        const decodedIssuer = decodeIssuerFromHex(issuerHex);
        if (decodedIssuer) {
          account.issuer = decodedIssuer;
          console.log(`    解码后的发行者: ${account.issuer}`);
        } else {
          console.log(`    未找到对应的发行者名称`);
        }
        
        pos += issuerLength;
      }
      
    } else if (fieldTag === 0x1a) { // 可能是真正的发行者名称
      if (pos >= bytes.length) break;
      const issuerLength = bytes[pos];
      pos++;
      if (pos + issuerLength <= bytes.length) {
        const issuerBytes = bytes.slice(pos, pos + issuerLength);
        try {
          const issuerText = new TextDecoder('utf-8', {fatal: false}).decode(issuerBytes);
          // 检查是否为有效的文本内容
          if (issuerText && issuerText.trim() && !/^[a-f0-9]+$/.test(issuerText.trim())) {
            account.realIssuer = issuerText.trim();
            console.log(`    真正发行者(0x1a): ${account.realIssuer}`);
          } else {
            console.log(`    0x1a字段内容: ${issuerText}`);
          }
        } catch (e) {
          console.log(`    0x1a字段解析失败`);
        }
        pos += issuerLength;
      }
    } else {
      // 未知字段，尝试跳过
      console.log(`    未知字段: 0x${fieldTag.toString(16)}`);
      if (pos < bytes.length) {
        // 尝试读取长度并跳过
        const length = bytes[pos];
        pos++;
        if (pos + length <= bytes.length) {
          pos += length;
        }
      }
    }
  }
  
  console.log(`  条目 ${entryIndex} 解析结果:`, account);
  return account;
}

function toBase32(bytes) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let result = '';
  let buffer = 0;
  let bitsLeft = 0;
  
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bitsLeft += 8;
    
    while (bitsLeft >= 5) {
      result += alphabet[(buffer >> (bitsLeft - 5)) & 31];
      bitsLeft -= 5;
    }
  }
  
  if (bitsLeft > 0) {
    result += alphabet[(buffer << (5 - bitsLeft)) & 31];
  }
  
  return result;
}

function decodeIssuerFromHex(hexString) {
  // 根据你提供的信息创建映射表
  const issuerMap = {
    'afb85a1732055877788': 'Audiences',
    '2e429b1732055573651': 'TTG',
    // 可以继续添加更多映射
  };
  
  return issuerMap[hexString] || null;
}

function decodeHexToText(hexString) {
  // 尝试多种解码方式
  
  // 方式1: 直接将十六进制转为字符
  try {
    let result = '';
    for (let i = 0; i < hexString.length; i += 2) {
      const hex = hexString.substr(i, 2);
      const charCode = parseInt(hex, 16);
      if (charCode >= 32 && charCode <= 126) { // 可打印ASCII字符
        result += String.fromCharCode(charCode);
      }
    }
    if (result.length > 0) {
      console.log(`    方式1解码结果: ${result}`);
      return result;
    }
  } catch (e) {}
  
  // 方式2: 尝试Base64解码
  try {
    const bytes = [];
    for (let i = 0; i < hexString.length; i += 2) {
      bytes.push(parseInt(hexString.substr(i, 2), 16));
    }
    const base64 = btoa(String.fromCharCode.apply(null, bytes));
    const decoded = atob(base64);
    if (decoded && /^[\x20-\x7E\u4e00-\u9fff]+$/.test(decoded)) {
      console.log(`    方式2解码结果: ${decoded}`);
      return decoded;
    }
  } catch (e) {}
  
  // 方式3: 尝试UTF-8解码
  try {
    const bytes = [];
    for (let i = 0; i < hexString.length; i += 2) {
      bytes.push(parseInt(hexString.substr(i, 2), 16));
    }
    const decoded = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
    if (decoded && decoded.trim()) {
      console.log(`    方式3解码结果: ${decoded}`);
      return decoded.trim();
    }
  } catch (e) {}
  
  return null;
}

function toggleSelectAll() {
  const selectAll = document.getElementById('select-all');
  const checkboxes = document.querySelectorAll('.site-checkbox');
  
  checkboxes.forEach(checkbox => {
    checkbox.checked = selectAll.checked;
  });
  
  updateDeleteButton();
}

function updateDeleteButton() {
  const checkboxes = document.querySelectorAll('.site-checkbox');
  const checkedBoxes = document.querySelectorAll('.site-checkbox:checked');
  const deleteBtn = document.getElementById('delete-selected-btn');
  const selectAll = document.getElementById('select-all');
  
  // 更新按钮文本和状态
  if (checkedBoxes.length > 0) {
    deleteBtn.textContent = `删除选中 (${checkedBoxes.length})`;
    deleteBtn.disabled = false;
  } else {
    deleteBtn.textContent = '删除选中';
    deleteBtn.disabled = true;
  }
  
  // 更新全选状态
  if (checkedBoxes.length === 0) {
    selectAll.indeterminate = false;
    selectAll.checked = false;
  } else if (checkedBoxes.length === checkboxes.length) {
    selectAll.indeterminate = false;
    selectAll.checked = true;
  } else {
    selectAll.indeterminate = true;
    selectAll.checked = false;
  }
}

async function deleteSelected() {
  const checkedBoxes = document.querySelectorAll('.site-checkbox:checked');
  const siteNames = Array.from(checkedBoxes).map(cb => cb.dataset.site);
  
  if (siteNames.length === 0) return;
  
  if (!confirm(`确定要删除选中的 ${siteNames.length} 个站点吗？`)) {
    return;
  }
  
  const sites = await getSites();
  siteNames.forEach(siteName => {
    delete sites[siteName];
  });
  
  await saveSites(sites);
  await loadSites();
  
  showMessage(`成功删除 ${siteNames.length} 个站点！`);
}

// 保存编辑
async function saveEdit(originalName) {
  const newName = document.getElementById(`edit-name-${originalName}`).value.trim();
  const secret = document.getElementById(`edit-secret-${originalName}`).value.trim().toUpperCase();
  const domainsText = document.getElementById(`edit-domains-${originalName}`).value.trim();
  
  if (!newName || !secret) {
    alert('请填写站点名称和密钥');
    return;
  }
  
  if (!/^[A-Z2-7]+$/.test(secret)) {
    alert('密钥格式不正确，请使用Base32格式（A-Z, 2-7）');
    return;
  }
  
  // 自动更正域名格式：支持多行、中文逗号、英文逗号分隔，去除重复
  let domains = [];
  if (domainsText) {
    domains = [...new Set(domainsText
      .replace(/，/g, ',')  // 中文逗号转英文逗号
      .split(/[,\n]/)      // 按逗号或换行分割
      .map(d => d.trim())  // 去除空格
      .filter(d => d))]    // 过滤空值后去重
    
    // 更新输入框显示为标准格式
    document.getElementById(`edit-domains-${originalName}`).value = domains.join(', ');
  }
  
  const sites = await getSites();
  
  // 如果名称改变了，删除原名称
  if (originalName !== newName) {
    delete sites[originalName];
  }
  
  sites[newName] = {
    secret: secret,
    domains: domains,
    createdAt: new Date().toISOString()
  };
  
  await saveSites(sites);
  await loadSites();
  
  showMessage('站点修改成功！');
}

// 取消编辑
function cancelEdit(siteName) {
  // 移除编辑表单
  const editForms = document.querySelectorAll('.site-item');
  for (const form of editForms) {
    if (form.innerHTML.includes(`edit-name-${siteName}`)) {
      form.remove();
      break;
    }
  }
  
  // 显示原站点项
  const siteItems = document.querySelectorAll('.site-item');
  for (const item of siteItems) {
    const editBtn = item.querySelector('.edit-btn');
    if (editBtn && editBtn.dataset.site === siteName) {
      item.style.display = 'flex';
      break;
    }
  }
}