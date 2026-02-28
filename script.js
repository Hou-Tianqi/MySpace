(function(){
  const btn = document.getElementById('inc');
  const countEl = document.getElementById('count');
  
  // 初始隐藏按钮
  btn.style.display = 'none';
  
  // 创建加载动画元素
  const spinner = document.createElement('span');
  spinner.id = 'loading-spinner';
  spinner.textContent = ' ⏳';
  spinner.style.fontSize = '2rem';
  spinner.style.color = '#0b6f9a';
  spinner.style.marginLeft = '10px';
  spinner.style.display = 'none';
  
  // 将加载动画添加到count元素后面
  countEl.parentNode.appendChild(spinner);
  
  //禁止使用此API密钥，作者将此密钥放于代码中主要因为访问者方便
  const BIN_ID = '69a17991ae596e708f4f0325';
  const API_KEY = '$2a$10$GfbSXiH62uVyZIIs7GUwj.J7ffAiukw2YhtuuBPwokr1KbqCmIJvq'; 
  //如果你真的使用了的话……反正这只是免费额度的，作者也不介意被滥用(:

  let value = 0;
  let targetSaveCount = null;   // 需要保存的目标数字
  let isSaving = false;         // 是否正在保存
  let saveAttempts = 0;         // 保存尝试次数
  const MAX_SAVE_ATTEMPTS = 5;   // 最大重试次数
  
  // 显示加载状态
  spinner.style.display = 'inline-block';
  countEl.style.opacity = '0.5';
  
  // 从云端加载
  async function loadCount() {
    try {
      const response = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
        headers: { 'X-Master-Key': API_KEY }
      });
      if (response.ok) {
        const data = await response.json();
        value = data.record.count || 0;
        countEl.textContent = value;
        
        // 同步到本地备份
        localStorage.setItem('headpatCount_backup', value);
        localStorage.setItem('headpatCount_backup_time', Date.now());
      }
    } catch (error) {
      console.log('云端加载失败，尝试从本地备份恢复', error);
      
      // 尝试从本地备份恢复
      const backup = localStorage.getItem('headpatCount_backup');
      const backupTime = localStorage.getItem('headpatCount_backup_time');
      
      if (backup && backupTime && (Date.now() - parseInt(backupTime)) < 24 * 60 * 60 * 1000) {
        value = parseInt(backup);
        countEl.textContent = value;
        console.log('从本地备份恢复:', value);
      } else {
        countEl.textContent = '0';
      }
    } finally {
      // 隐藏加载状态
      spinner.style.display = 'none';
      countEl.style.opacity = '1';
      
      // 显示按钮（带一点延迟，让用户体验更自然）
      setTimeout(() => {
        btn.style.display = 'inline-block';
        btn.style.opacity = '0';
        btn.style.transition = 'opacity 0.5s ease';
        // 强制重绘
        void btn.offsetWidth;
        btn.style.opacity = '1';
      }, 300);
    }
  }
  
  // 静默保存到云端
  async function saveCount(count) {
    // 更新目标数字（总是保存最新的）
    targetSaveCount = count;
    
    // 如果正在保存，让当前保存完成后处理最新的目标数字
    if (isSaving) {
      return;
    }
    
    // 开始保存
    isSaving = true;
    saveAttempts = 0;
    
    while (targetSaveCount !== null && saveAttempts < MAX_SAVE_ATTEMPTS) {
      const countToSave = targetSaveCount;
      targetSaveCount = null; // 清空目标，如果保存失败会被重新设置
      
      try {
        console.log(`尝试保存: ${countToSave}, 第${saveAttempts + 1}次`);
        
        const response = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Master-Key': API_KEY
          },
          body: JSON.stringify({ 
            count: countToSave, 
            lastUpdate: new Date().toISOString() 
          })
        });
        
        if (response.ok) {
          console.log(`✅ 保存成功: ${countToSave}`);
          
          // 保存成功后更新本地备份
          localStorage.setItem('headpatCount_backup', countToSave);
          localStorage.setItem('headpatCount_backup_time', Date.now());
          
          // 重置尝试次数
          saveAttempts = 0;
          
          // 如果在保存过程中有新的目标数字，继续保存
          if (targetSaveCount !== null && targetSaveCount !== countToSave) {
            console.log(`检测到新目标: ${targetSaveCount}，继续保存`);
            continue;
          } else {
            break; // 保存完成
          }
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        console.error(`保存失败 (${saveAttempts + 1}/${MAX_SAVE_ATTEMPTS}):`, error);
        
        saveAttempts++;
        
        if (saveAttempts < MAX_SAVE_ATTEMPTS) {
          // 等待后重试（递增等待时间）
          const waitTime = Math.pow(2, saveAttempts) * 1000; // 2s, 4s, 8s, 16s
          console.log(`等待 ${waitTime/1000} 秒后重试...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          
          // 如果目标数字被更新了，使用新数字重试
          if (targetSaveCount === null || targetSaveCount < countToSave) {
            targetSaveCount = countToSave;
          }
        } else {
          console.error('❌ 达到最大重试次数，保存失败');
          // 保存失败时，将数字存到localStorage待下次恢复
          localStorage.setItem('headpatCount_pending', countToSave);
        }
      }
    }
    
    isSaving = false;
    
    // 如果还有未保存的目标，继续保存
    if (targetSaveCount !== null) {
      saveCount(targetSaveCount);
    }
  }
  
  // 检查是否有未完成的保存
  function checkPendingSave() {
    const pending = localStorage.getItem('headpatCount_pending');
    if (pending) {
      const pendingValue = parseInt(pending);
      if (pendingValue > value) {
        console.log('检测到未完成的保存，尝试恢复:', pendingValue);
        value = pendingValue;
        countEl.textContent = value;
        saveCount(value);
      }
      localStorage.removeItem('headpatCount_pending');
    }
  }
  
  // 开始加载
  loadCount().then(() => {
    // 加载完成后检查是否有未完成的保存
    checkPendingSave();
  });
  
  function animatePop() {
    countEl.classList.remove('pop');
    void countEl.offsetWidth;
    countEl.classList.add('pop');
  }
  
  btn.addEventListener('click', function(){
    value += 1;
    countEl.textContent = value;
    animatePop();
    
    // 静默保存
    saveCount(value);
  });
  
  // 页面关闭前的处理
  window.addEventListener('beforeunload', function(e) {
    // 检查是否有正在进行的保存或未保存的数据
    if (isSaving || targetSaveCount !== null) {
      // 将当前值存为待处理
      localStorage.setItem('headpatCount_pending', value);
      
      // 触发警告
      const message = '系统正在保存摸头次数，请稍等...';
      e.returnValue = message;
      return message;
    }
  });
  
  // 定期备份到localStorage（每分钟）
  setInterval(() => {
    localStorage.setItem('headpatCount_backup', value);
    localStorage.setItem('headpatCount_backup_time', Date.now());
  }, 60000);
  
})();