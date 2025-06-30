// count.html 独立JS逻辑
document.addEventListener('DOMContentLoaded', function() {

    // 修正计数结果按钮事件（面板方式）
    document.getElementById('manualCorrectBtn')?.addEventListener('click', async function() {
        // 参考删除当前照片按钮的实现
        const fileName = document.getElementById('infoFileName')?.textContent?.trim();
        if (!fileName) {
            alert('没有图片可修正');
            return;
        }
        const img = images.find(img => img.name === fileName);
        if (!img) {
            alert('未找到当前图片');
            return;
        }
        // 获取当前计数结果
        let sheep = 0;
        let cattle = 0;
        try {
            const res = await fetch(`/api/count/result?fileName=${encodeURIComponent(img.name)}`);
            const data = await res.json();
            sheep = (typeof data.sheep_count === 'number') ? data.sheep_count : 0;
            cattle = (typeof data.cattle_count === 'number') ? data.cattle_count : 0;
        } catch {}
        // 显示面板并填充
        const panel = document.getElementById('manualCorrectPanel');
        panel.style.display = 'block';
        document.getElementById('manualSheepInput').value = sheep;
        document.getElementById('manualCattleInput').value = cattle;
    });

    // 保存修正
    document.getElementById('manualCorrectSaveBtn')?.addEventListener('click', async function() {
        // 参考删除当前照片按钮的实现
        const fileName = document.getElementById('infoFileName')?.textContent?.trim();
        if (!fileName) return;
        const img = images.find(img => img.name === fileName);
        if (!img) return;
        const sheepVal = document.getElementById('manualSheepInput').value;
        const cattleVal = document.getElementById('manualCattleInput').value;
        if (sheepVal === '' || cattleVal === '') {
            showNotification('请填写完整数量', 'error');
            return;
        }
        // farmerId参数
        const params = new URLSearchParams(window.location.search);
        let farmerId = params.get('farmerId') || params.get('farmer_id');
        // 提交到后端
        const resp = await fetch('/api/count/manual-correct', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileName: img.name,
                manual_sheep_count: Number(sheepVal),
                manual_cattle_count: Number(cattleVal),
                manual_verified: 1,
                farmer_id: farmerId
            })
        });
        if (resp.ok) {
            showNotification('修正结果已保存', 'success');
            document.getElementById('manualCorrectPanel').style.display = 'none';
            updateImageAndInfo();
        } else {
            showNotification('修正失败', 'error');
        }
    });

    // 取消修正
    document.getElementById('manualCorrectCancelBtn')?.addEventListener('click', function() {
        document.getElementById('manualCorrectPanel').style.display = 'none';
    });
    // 多选与删除功能初始化
    if (window.ImageManager) {
        window.imageManager = new window.ImageManager({
            gallerySelector: '#fileList',
            selectModeBtnSelector: '#toggleSelectModeBtn',
            deleteBtnSelector: '#deleteSelectedBtn',
            selectedCountSelector: '#selectedCount',
            onDeleteSelected: async function(selectedImagePaths) {
                alert('[count.js] 多选删除触发');
                console.log('[count.js] 多选删除触发', selectedImagePaths);
                // 多选删除时拼接farmerId参数
                let deleteUrl = '/api/delete-image';
                const params = new URLSearchParams(window.location.search);
                let farmerId = params.get('farmerId') || params.get('farmer_id');
                console.log('[count.js 多选删除] farmerId:', farmerId);
                if (farmerId) {
                    deleteUrl += `?farmerId=${encodeURIComponent(farmerId)}`;
                }
                // 调试输出
                console.log('[多选删除] deleteUrl:', deleteUrl, 'imagePaths:', selectedImagePaths, 'farmerId:', farmerId);
                const resp = await fetch(deleteUrl, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imagePaths: selectedImagePaths })
                });
                if (resp.ok) {
                    // 删除后刷新图片列表
                    const tempResp = await fetch('/api/temp-folder');
                    const tempData = await tempResp.json();
                    images = tempData.images || [];
                    currentIndex = 0;
                    renderFileList();
                    updateImageAndInfo();
                    showNotification('图片已删除', 'success');
                } else {
                    showNotification('删除失败', 'error');
                }
            }
        });
    }
    // 动态加载图片列表并切换显示
    const fileList = document.getElementById('fileList');
    const displayImage = document.getElementById('displayImage');
    const showOriginalBtn = document.getElementById('showOriginalBtn');
    const showResultBtn = document.getElementById('showResultBtn');
let showingResult = false;
let images = [];
let currentIndex = 0;
window.images = images;
window.currentIndex = currentIndex;

function renderFileList() {
    fileList.innerHTML = '';
    // 实时显示currentIndex
    const idxSpan = document.getElementById('currentIndexDisplay');
    if (idxSpan) idxSpan.textContent = currentIndex;
    images.forEach((img, idx) => {
        const li = document.createElement('li');
        if (idx === currentIndex) li.classList.add('active');
        // 缩略图
        const thumb = document.createElement('img');
        thumb.className = 'file-thumb';
        thumb.src = img.thumbnail.replace('/original/', '/thumb/');
        thumb.alt = img.name;
        const info = document.createElement('div');
        info.className = 'file-info';
        const name = document.createElement('div');
        name.className = 'file-name';
        name.textContent = img.name;
        const meta = document.createElement('div');
        meta.className = 'file-meta';
        meta.textContent = img.size || '';
        info.appendChild(name);
        info.appendChild(meta);
        const status = document.createElement('span');
        let fileStatus = (img.status === 'completed') ? 'processed' : 'unprocessed';
        status.className = 'file-status ' + fileStatus;
        status.title = (img.status === 'completed') ? '已计数' : '未计数';
        status.innerHTML = (img.status === 'completed')
            ? '<i class="fas fa-check-circle"></i>'
            : '<i class="fas fa-clock"></i>';
        li.appendChild(thumb);
        li.appendChild(info);
        li.appendChild(status);
        li.setAttribute('data-idx', idx);
        li.onclick = function(event) {
            event.stopPropagation();
            currentIndex = idx;
            window.currentIndex = currentIndex;
            // 切换图片时，若已计数则默认显示结果图，否则显示原图
            if (images[currentIndex].status === 'completed') {
                showingResult = true;
            } else {
                showingResult = false;
            }
            renderFileList(); // 重新渲染高亮
            updateImageAndInfo(); // 同步更新信息区
        };
        fileList.appendChild(li);
    });
}

function updateImageAndInfo() {
    // 实时显示currentIndex
    const idxSpan = document.getElementById('currentIndexDisplay');
    if (idxSpan) idxSpan.textContent = currentIndex;
    if (!images.length) return;
    const img = images[currentIndex];

    // 根据showingResult状态设置按钮高亮
    if (showingResult) {
        showResultBtn.classList.add('btn-primary');
        showResultBtn.classList.remove('btn-secondary');
        showOriginalBtn.classList.remove('btn-primary');
        showOriginalBtn.classList.add('btn-secondary');
    } else {
        showOriginalBtn.classList.add('btn-primary');
        showOriginalBtn.classList.remove('btn-secondary');
        showResultBtn.classList.remove('btn-primary');
        showResultBtn.classList.add('btn-secondary');
    }

    // 文件名
    const fileNameSpan = document.getElementById('infoFileName');
    if (fileNameSpan) fileNameSpan.textContent = img.name || '-';
    // 原图和结果图路径
    const originalUrl = img.thumbnail;
    let resultUrl = originalUrl.replace('/original/', '/result/');
    // 强制刷新结果图，避免缓存
    if (showingResult) {
        resultUrl += (resultUrl.includes('?') ? '&' : '?') + '_ts=' + Date.now();
    }
    displayImage.src = showingResult ? resultUrl : originalUrl;
    document.getElementById('infoName').textContent = '张三';
    document.getElementById('infoTime').textContent = img.date || '-';

    // 查询数据库计数结果
    const params = new URLSearchParams(window.location.search);
    let farmerId = params.get('farmerId') || params.get('farmer_id');
    let resultApiUrl = `/api/count/result?fileName=${encodeURIComponent(img.name)}`;
    if (farmerId) resultApiUrl += `&farmerId=${encodeURIComponent(farmerId)}`;
    fetch(resultApiUrl)
        .then(res => res.json())
        .then(data => {
            // 优先显示人工修正结果
            let sheep, cattle;
            if (data.manual_verified === 1) {
                sheep = (data.manual_sheep_count !== null && data.manual_sheep_count !== undefined) ? data.manual_sheep_count : '-';
                cattle = (data.manual_cattle_count !== null && data.manual_cattle_count !== undefined) ? data.manual_cattle_count : '-';
            } else {
                sheep = (data.sheep_count !== null && data.sheep_count !== undefined) ? data.sheep_count : '-';
                cattle = (data.cattle_count !== null && data.cattle_count !== undefined) ? data.cattle_count : '-';
            }
            // 按钮区域
            let btnHtml = `
                <div style="margin:8px 0 0 0;display:flex;gap:8px;">
                    <button id="setSheepBtn" class="btn btn-sm btn-outline-primary">设为羊结果</button>
                    <button id="setCattleBtn" class="btn btn-sm btn-outline-primary">设为牛结果</button>
                    <button id="setMixedBtn" class="btn btn-sm btn-outline-secondary">牛羊混合(开发中)</button>
                </div>
            `;
            document.getElementById('infoCount').innerHTML = `<br>羊：${sheep}只<br>牛：${cattle}头` + btnHtml;
            // 按钮事件
            setTimeout(() => {
                const fileName = img.name;
                document.getElementById('setSheepBtn')?.addEventListener('click', async function() {
                    // 把当前总数都设为羊，牛为0
                    let total = 0;
                    if (typeof data.sheep_count === 'number') total += data.sheep_count;
                    if (typeof data.cattle_count === 'number') total += data.cattle_count;
                    await fetch('/api/count/override-result', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fileName, sheep_count: total, cattle_count: 0 })
                    });
                    updateImageAndInfo();
                });
                document.getElementById('setCattleBtn')?.addEventListener('click', async function() {
                    // 把当前总数都设为牛，羊为0
                    let total = 0;
                    if (typeof data.sheep_count === 'number') total += data.sheep_count;
                    if (typeof data.cattle_count === 'number') total += data.cattle_count;
                    await fetch('/api/count/override-result', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fileName, sheep_count: 0, cattle_count: total })
                    });
                    updateImageAndInfo();
                });
                document.getElementById('setMixedBtn')?.addEventListener('click', function() {
                    showNotification('牛羊混合功能开发中', 'info');
                });
            }, 0);
            // 更新图片状态并刷新文件列表
            img.status = data.status;
            renderFileList();

            // 统计所有图片的牛羊总数（改为直接请求后端summary接口，确保逻辑一致）
            if (farmerId) {
                fetch(`/api/count/summary?farmerId=${encodeURIComponent(farmerId)}`)
                    .then(res => res.json())
                    .then(sum => {
                       document.getElementById('totalCountInfo').innerHTML =
                            `<b>合计：</b> 羊${sum.sheep_total || 0}只，牛${sum.cattle_total || 0}头`;
                    });
            }
        })
        .catch(() => {
            document.getElementById('infoCount').innerHTML = '羊：-只<br>牛：-头';
            document.getElementById('totalCountInfo').innerHTML = `<b>合计：</b> 羊：-只，牛：-头`;
        });
}

    showOriginalBtn.onclick = function() {
        showingResult = false;
        showOriginalBtn.classList.add('btn-primary');
        showOriginalBtn.classList.remove('btn-secondary');
        showResultBtn.classList.remove('btn-primary');
        showResultBtn.classList.add('btn-secondary');
        updateImageAndInfo();
    };
    showResultBtn.onclick = function() {
        showingResult = true;
        showResultBtn.classList.add('btn-primary');
        showResultBtn.classList.remove('btn-secondary');
        showOriginalBtn.classList.remove('btn-primary');
        showOriginalBtn.classList.add('btn-secondary');
        updateImageAndInfo();
    };

    // 默认高亮原图按钮
    showOriginalBtn.classList.add('btn-primary');
    showResultBtn.classList.add('btn-secondary');

    // 加载图片列表
fetch('/api/temp-folder')
    .then(res => res.json())
.then(async data => {
        images = data.images || [];
        window.images = images;
        if (images.length) {
            // 并发获取所有图片的status
            const params = new URLSearchParams(window.location.search);
            let farmerId = params.get('farmerId') || params.get('farmer_id');
            await Promise.all(images.map(async img => {
                try {
                    let statusApiUrl = `/api/count/result?fileName=${encodeURIComponent(img.name)}`;
                    if (farmerId) statusApiUrl += `&farmerId=${encodeURIComponent(farmerId)}`;
                    const res = await fetch(statusApiUrl);
                    const result = await res.json();
                    img.status = result.status;
                } catch (e) {
                    img.status = null;
                }
            }));
            currentIndex = 0;
            window.currentIndex = currentIndex;
            renderFileList();
            updateImageAndInfo();
        } else {
            fileList.innerHTML = '<li style="color:#aaa;">暂无图片</li>';
            displayImage.src = '';
            document.getElementById('infoName').textContent = '-';
            document.getElementById('infoTime').textContent = '-';
            document.getElementById('infoCount').textContent = '-';
        }
    });

    // 返回按钮带farmerId参数
    document.getElementById('backBtn')?.addEventListener('click', function() {
        const params = new URLSearchParams(window.location.search);
        let farmerId = params.get('farmerId') || params.get('farmer_id');
        let url = 'detection.html';
        if (farmerId) {
            url += '?farmerId=' + encodeURIComponent(farmerId);
        }
        window.location.href = url;
    });

    // 设置按钮事件：打开计数专用设置弹窗
    document.getElementById('settingsBtn')?.addEventListener('click', function() {
        document.getElementById('countSettingsOverlay').classList.add('show');
    });

    // 完成盘点按钮事件
    document.getElementById('finishInventoryBtn')?.addEventListener('click', function() {
        document.getElementById('finishInventoryOverlay').classList.add('show');
    });
    document.getElementById('closeFinishInventoryModal')?.addEventListener('click', function() {
        document.getElementById('finishInventoryOverlay').classList.remove('show');
    });
    document.getElementById('finishInventoryForm')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        const task_name = document.getElementById('taskName').value.trim();
        const detection_date = document.getElementById('detectionDate').value;
        const notes = document.getElementById('finishNotes').value.trim();
        const pilot_name = document.getElementById('pilotName').value.trim();
        if (!task_name || !detection_date) {
            alert('请填写完整盘点信息');
            return;
        }
        try {
            // 获取farmer_id（从URL参数或全局变量）
            let farmerId = null;
            const params = new URLSearchParams(window.location.search);
            farmerId = params.get('farmerId') || params.get('farmer_id') || null;

            const resp = await fetch('/api/count/finish-inventory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ task_name, detection_date, notes, pilot_name, farmer_id: farmerId })
            });
            const data = await resp.json();
if (resp.ok && data && data.success) {
    document.getElementById('finishInventoryOverlay').classList.remove('show');
    // 跳转到盘点详情页
    window.location.href = 'detection.html?taskId=' + data.task_id;
} else {
    alert('保存失败：' + (data && data.error ? data.error : '未知错误'));
}
        } catch (err) {
            alert('请求失败: ' + err.message);
        }
    });

    // 自动设置盘点日期为今天
    const detectionDateInput = document.getElementById('detectionDate');
    if (detectionDateInput && !detectionDateInput.value) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        detectionDateInput.value = `${yyyy}-${mm}-${dd}`;
    }
    document.getElementById('closeCountSettingsModal')?.addEventListener('click', function() {
        document.getElementById('countSettingsOverlay').classList.remove('show');
    });
    document.getElementById('cancelCountSettingsBtn')?.addEventListener('click', function() {
        document.getElementById('countSettingsOverlay').classList.remove('show');
    });
    document.getElementById('countSettingsForm')?.addEventListener('submit', function(e) {
        e.preventDefault();
        // 可在此处保存设置到本地或后端
        document.getElementById('countSettingsOverlay').classList.remove('show');
        alert('设置已保存');
    });

    // 统一弹窗显示/隐藏函数
    function showCountingOverlay(msg, showProgress = false, progress = 0) {
        const overlay = document.getElementById('countingOverlay');
        const msgDiv = document.getElementById('countingMsg');
        if (msgDiv) msgDiv.textContent = msg || '计数中，请稍候...';
        overlay.style.display = 'flex';
        overlay.dataset.cancelled = 'false';
        const cancelBtn = document.getElementById('cancelCountingBtn');
        cancelBtn.disabled = false;
        // 进度条
        const progressBar = document.getElementById('countingProgressBar');
        const progressFill = document.getElementById('countingProgressFill');
        if (showProgress) {
            progressBar.style.display = '';
            progressFill.style.width = `${progress}%`;
        } else {
            progressBar.style.display = 'none';
            progressFill.style.width = '0';
        }
    }
    function updateCountingProgress(percent) {
        const progressBar = document.getElementById('countingProgressBar');
        const progressFill = document.getElementById('countingProgressFill');
        progressBar.style.display = '';
        progressFill.style.width = `${percent}%`;
    }
    function hideCountingOverlay() {
        const overlay = document.getElementById('countingOverlay');
        overlay.style.display = 'none';
        // 隐藏进度条
        const progressBar = document.getElementById('countingProgressBar');
        const progressFill = document.getElementById('countingProgressFill');
        progressBar.style.display = 'none';
        progressFill.style.width = '0';
    }
    // 绑定取消按钮
    document.getElementById('cancelCountingBtn')?.addEventListener('click', function() {
        const overlay = document.getElementById('countingOverlay');
        overlay.dataset.cancelled = 'true';
        hideCountingOverlay();
    });

    // 全部图片计数按钮
    document.getElementById('countAllBtn')?.addEventListener('click', async function() {
        if (!images.length) {
            alert('暂无图片可计数');
            return;
        }
        // 获取图片所在文件夹路径
        const folderPath = images[0]?.path ? (images[0].path.replace(/\\[^\\\/]+$/, '').replace(/\/[^\/]+$/, '')) : '';
        if (!folderPath) {
            alert('无法获取文件夹路径');
            return;
        }
        // 推算outputDir
        let outputDir = '';
        if (folderPath.includes('/original')) {
            outputDir = folderPath.replace(/\/original.*/, '');
        } else if (folderPath.includes('\\original')) {
            outputDir = folderPath.replace(/\\original.*/, '');
        } else {
            outputDir = folderPath;
        }
        // 获取animalType
        const form = document.getElementById('countOptionsForm');
        const animalType = form?.querySelector('input[name="animalType"]:checked')?.value || 'both';

        showCountingOverlay('正在计数全部图片，请稍候...', true, 0);
        try {
            const resp = await fetch('/api/count/all', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imgPath: folderPath, outputDir, animalType })
            });

            if (!resp.body) throw new Error('响应体不可读');
            const reader = resp.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';
            let total = images.length;
            let current = 0;
            let doneFlag = false;

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                let lines = buffer.split('\n');
                buffer = lines.pop(); // 剩余部分
                for (let line of lines) {
                    // 解析进度
                    let match = line.match(/image\s+(\d+)\s*\/\s*(\d+)/i);
                    if (match) {
                        current = parseInt(match[1]);
                        total = parseInt(match[2]);
                        let percent = Math.floor((current / total) * 100);
                        updateCountingProgress(percent);
                    }
                    // 检查完成标记
                    if (line.includes('__COUNT_DONE__')) {
                        doneFlag = true;
                    }
                    // 检查错误标记
                    if (line.includes('__COUNT_ERROR__')) {
                        hideCountingOverlay();
                        alert('计数失败：' + line);
                        return;
                    }
                }
            }
            // 计数完成后，强制刷新所有图片的计数状态和数量（彻底：重新拉取图片列表并刷新status）
            if (document.getElementById('countingOverlay').dataset.cancelled !== 'true') {
                updateCountingProgress(100);
                try {
                    const tempResp = await fetch('/api/temp-folder');
                    const tempData = await tempResp.json();
                    images = tempData.images || images;
                    // 计数完成后，补充刷新所有图片的status字段
                    await Promise.all(images.map(async imgItem => {
                        try {
                            const res = await fetch(`/api/count/result?fileName=${encodeURIComponent(imgItem.name)}`);
                            const result = await res.json();
                            imgItem.status = result.status;
                        } catch (e) {
                            imgItem.status = null;
                        }
                    }));
                    // 保持当前图片高亮
                    if (images.length > 0) {
                        // 尝试保持当前图片名
                        const fileName = document.getElementById('infoFileName')?.textContent?.trim();
                        let idx = images.findIndex(img => img.name === fileName);
                        if (idx === -1) idx = 0;
                        currentIndex = idx;
                    } else {
                        currentIndex = 0;
                    }
                    renderFileList();
                    updateImageAndInfo();
                } catch (e) {
                    renderFileList();
                    updateImageAndInfo();
                }
                setTimeout(() => {
                    hideCountingOverlay();
                }, 400);
            }
        } catch (e) {
            if (document.getElementById('countingOverlay').dataset.cancelled !== 'true') {
                hideCountingOverlay();
                alert('请求失败: ' + e.message);
            }
        }
    });

    // 单张图片计数按钮事件（直接计数）
    document.getElementById('directCountBtn')?.addEventListener('click', async function() {
        const form = document.getElementById('countOptionsForm');
        const animalType = form.querySelector('input[name="animalType"]:checked')?.value || 'both';
        if (!images.length) {
            showNotification('没有图片可计数', 'error');
            return;
        }
        // 用图片信息区的文件名查找图片对象
        const fileName = document.getElementById('infoFileName')?.textContent?.trim();
        const img = images.find(img => img.name === fileName);
        if (!img) {
            showNotification('图片信息区文件名未找到对应图片', 'error');
            return;
        }
        const imgPath = img.path || img.thumbnail || '';
        if (!imgPath) {
            showNotification('图片路径无效', 'error');
            return;
        }
        // 结果保存目录推算
        let outputDir = '';
        if (imgPath.includes('/original/')) {
            outputDir = imgPath.replace(/\/original\/.*/, '');
        } else if (imgPath.includes('\\original\\')) {
            outputDir = imgPath.replace(/\\original\\.*$/, '');
        }
        showCountingOverlay(`正在计数：${img.name}`);
        try {
            const resp = await fetch('/api/count/single', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imgPath, outputDir, animalType })
            });
            const data = await resp.json();
            if (document.getElementById('countingOverlay').dataset.cancelled !== 'true') {
                // 只隐藏弹窗和通知
                if (resp.ok && data && data.countResult) {
                    img.processed = true;
                    img.countResult = data.countResult;
                    // 重新拉取所有图片的状态，确保前端刷新
                    await Promise.all(images.map(async imgItem => {
                        try {
                            const res = await fetch(`/api/count/result?fileName=${encodeURIComponent(imgItem.name)}`);
                            const result = await res.json();
                            imgItem.status = result.status;
                        } catch (e) {
                            imgItem.status = null;
                        }
                    }));
                    renderFileList();
                    updateImageAndInfo();
                }
                // 计数完成后自动刷新所有图片的状态和数量（彻底：重新拉取图片列表）
                try {
                    const tempResp = await fetch('/api/temp-folder');
                    const tempData = await tempResp.json();
                    images = tempData.images || images;
                    // 计数完成后，补充刷新所有图片的status字段
                    await Promise.all(images.map(async imgItem => {
                        try {
                            const res = await fetch(`/api/count/result?fileName=${encodeURIComponent(imgItem.name)}`);
                            const result = await res.json();
                            imgItem.status = result.status;
                        } catch (e) {
                            imgItem.status = null;
                        }
                    }));
                    // 保持当前图片高亮
                    if (images.length > 0) {
                        // 尝试保持当前图片名
                        const fileName = document.getElementById('infoFileName')?.textContent?.trim();
                        let idx = images.findIndex(img => img.name === fileName);
                        if (idx === -1) idx = 0;
                        currentIndex = idx;
                    } else {
                        currentIndex = 0;
                    }
                    renderFileList();
                    updateImageAndInfo();
                } catch (e) {
                    renderFileList();
                    updateImageAndInfo();
                }
                hideCountingOverlay();
                if (resp.ok) {
                    showNotification('计数完成！', 'success');
                } else {
                    showNotification('计数失败：' + (data && data.error ? data.error : '未知错误'), 'error');
                }
            }
        } catch (e) {
            if (document.getElementById('countingOverlay').dataset.cancelled !== 'true') {
                hideCountingOverlay();
                showNotification('请求失败: ' + e.message, 'error');
            }
        }
    });

    // 滑窗计数按钮事件
document.getElementById('slideCountBtn')?.addEventListener('click', async function() {
    if (!images.length) {
        showNotification('没有图片可计数', 'error');
        return;
    }
    const img = images[currentIndex];
    const imgPath = img.path || img.thumbnail || '';
    if (!imgPath) {
        showNotification('图片路径无效', 'error');
        return;
    }
    // 结果保存目录推算
    let outputDir = '';
    if (imgPath.includes('/original/')) {
        outputDir = imgPath.replace(/\/original\/.*/, '');
    } else if (imgPath.includes('\\original\\')) {
        outputDir = imgPath.replace(/\\original\\.*$/, '');
    }
    // 获取animalType
    const form = document.getElementById('countOptionsForm');
    const animalType = form?.querySelector('input[name="animalType"]:checked')?.value || 'both';
    showCountingOverlay(`正在滑窗计数：${img.name}`);
    try {
        const resp = await fetch('/api/count/slide', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imgPath, outputDir, animalType })
        });
        const data = await resp.json();
        if (document.getElementById('countingOverlay').dataset.cancelled !== 'true') {
            // 计数完成后，强制刷新所有图片的计数状态和数量
            await Promise.all(images.map(async imgItem => {
                try {
                    const res = await fetch(`/api/count/result?fileName=${encodeURIComponent(imgItem.name)}`);
                    const result = await res.json();
                    imgItem.status = result.status;
                } catch (e) {
                    imgItem.status = null;
                }
            }));
            renderFileList();
            updateImageAndInfo();
            hideCountingOverlay();
            if (resp.ok) {
                showNotification('滑窗计数完成！', 'success');
            } else {
                showNotification('滑窗计数失败：' + (data && data.error ? data.error : '未知错误'), 'error');
            }
        }
    } catch (e) {
        if (document.getElementById('countingOverlay').dataset.cancelled !== 'true') {
            hideCountingOverlay();
            showNotification('请求失败: ' + e.message, 'error');
        }
    }
});

    // 通用通知
    function showNotification(msg, type) {
        // 若有全局NotificationManager则用之，否则简单实现
        if (window.NotificationManager && typeof window.NotificationManager.show === 'function') {
            window.NotificationManager.show(msg, type);
        } else {
            // type: success, error, info
            let color = '#1890ff';
            if (type === 'success') color = '#52c41a';
            if (type === 'error') color = '#ff4d4f';
            const div = document.createElement('div');
            div.textContent = msg;
            div.style.cssText = `position:fixed;top:30px;left:50%;transform:translateX(-50%);background:${color};color:#fff;padding:10px 28px;border-radius:6px;font-size:16px;z-index:99999;box-shadow:0 2px 8px #0003;opacity:0.98;`;
            document.body.appendChild(div);
            setTimeout(() => { div.remove(); }, 2200);
        }
    }

    // 删除当前照片按钮事件
    const deleteBtn = document.getElementById('deleteCurrentBtn');
    if (deleteBtn) {
        console.log('[count.js] 绑定deleteCurrentBtn');
        deleteBtn.addEventListener('click', async function() {
            console.log('[count.js] 点击deleteCurrentBtn');
            if (!images.length) {
                showNotification('没有图片可删除', 'error');
                return;
            }
            const img = images[currentIndex];
            if (!img) {
                showNotification('未找到当前图片', 'error');
                return;
            }
            // 确认删除
            if (!confirm(`确定要删除图片 "${img.name}" 吗？此操作不可恢复。`)) return;
            try {
                // 收集原图、thumb、result三种路径
                const imagePaths = [];
                const basePath = img.path || img.thumbnail || img.name;
                if (basePath) {
                    imagePaths.push(basePath);
                    if (basePath.includes('/thumb/')) {
                        const base = basePath.replace('/thumb/', '/');
                        imagePaths.push(base.replace(/\/([^\/]+)$/, '/result/$1'));
                        imagePaths.push(base.replace(/\/([^\/]+)$/, '/original/$1'));
                    } else if (basePath.includes('/original/')) {
                        imagePaths.push(basePath.replace('/original/', '/thumb/'));
                        imagePaths.push(basePath.replace('/original/', '/result/'));
                    } else if (basePath.includes('/result/')) {
                        imagePaths.push(basePath.replace('/result/', '/thumb/'));
                        imagePaths.push(basePath.replace('/result/', '/original/'));
                    }
                }
                const uniquePaths = Array.from(new Set(imagePaths));
                // 拼接farmerId参数
                let deleteUrl = '/api/delete-image';
                const params = new URLSearchParams(window.location.search);
                let farmerId = params.get('farmerId') || params.get('farmer_id');
                console.log('[count.js] farmerId:', farmerId);
                if (farmerId) {
                    deleteUrl += `?farmerId=${encodeURIComponent(farmerId)}`;
                }
                // 调试输出
                console.log('[删除图片] deleteUrl:', deleteUrl, 'imagePaths:', uniquePaths, 'farmerId:', farmerId);
                const resp = await fetch(deleteUrl, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imagePaths: uniquePaths })
                });
                if (resp.ok) {
                    // 删除后刷新图片列表
                    const tempResp = await fetch('/api/temp-folder');
                    const tempData = await tempResp.json();
                    images = tempData.images || [];
                    // 调整currentIndex
                    if (images.length > 0) {
                        currentIndex = Math.min(currentIndex, images.length - 1);
                    } else {
                        currentIndex = 0;
                    }
                    renderFileList();
                    updateImageAndInfo();
                    showNotification('图片已删除', 'success');
                } else {
                    showNotification('删除失败', 'error');
                }
            } catch (e) {
                showNotification('删除失败: ' + e.message, 'error');
            }
        });
    }

    // 禁用牛羊混合点击提示
    const animalTypeBoth = document.getElementById('animalTypeBoth');
    if (animalTypeBoth) {
        const label = animalTypeBoth.closest('label');
        if (label) {
            label.addEventListener('click', function(e) {
                e.preventDefault();
                showNotification('牛羊混合功能还在开发中', 'info');
            });
        }
    }

    // 图片大图预览功能
    // 创建预览层
    const previewOverlay = document.createElement('div');
    previewOverlay.style.cssText = `
        display:none;position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:99999;
        background:rgba(0,0,0,0.85);align-items:center;justify-content:center;cursor:grab;
    `;
    previewOverlay.id = 'imagePreviewOverlay';
    previewOverlay.innerHTML = '<img id="previewImg" style="max-width:90vw;max-height:90vh;box-shadow:0 4px 32px #000a;border-radius:10px;transition:transform 0.1s;cursor:grab;">';
    document.body.appendChild(previewOverlay);

    const previewImg = document.getElementById('previewImg');
    let scale = 1, originX = 0, originY = 0, startX = 0, startY = 0, dragging = false, imgX = 0, imgY = 0;

    // 点击图片弹出预览
    displayImage.addEventListener('click', function() {
        previewImg.src = displayImage.src;
        scale = 1; imgX = 0; imgY = 0;
        previewImg.style.transform = 'translate(0px,0px) scale(1)';
        previewOverlay.style.display = 'flex';
    });

    // 滚轮缩放
    previewOverlay.addEventListener('wheel', function(e) {
        e.preventDefault();
        let delta = e.deltaY < 0 ? 0.1 : -0.1;
        scale = Math.min(Math.max(0.2, scale + delta), 8);
        previewImg.style.transform = `translate(${imgX}px,${imgY}px) scale(${scale})`;
    }, { passive: false });

    // 鼠标拖动
    previewImg.addEventListener('mousedown', function(e) {
        dragging = true;
        startX = e.clientX - imgX;
        startY = e.clientY - imgY;
        previewOverlay.style.cursor = 'grabbing';
    });
    document.addEventListener('mousemove', function(e) {
        if (!dragging) return;
        imgX = e.clientX - startX;
        imgY = e.clientY - startY;
        previewImg.style.transform = `translate(${imgX}px,${imgY}px) scale(${scale})`;
    });
    document.addEventListener('mouseup', function() {
        dragging = false;
        previewOverlay.style.cursor = 'grab';
    });

    // 点击遮罩关闭
    previewOverlay.addEventListener('click', function(e) {
        if (e.target === previewOverlay) {
            previewOverlay.style.display = 'none';
        }
    });
});
