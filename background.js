// 后台脚本 - 简单的事件处理
chrome.runtime.onInstalled.addListener(() => {
  console.log('TOTP验证码助手已安装');
});