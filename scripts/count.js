// count.html 独立JS逻辑
document.addEventListener('DOMContentLoaded', function() {

    // 初始化嵌入式label-editor
    let labelEditor = null;
    function initLabelEditor() {
        labelEditor = new LabelEditor({
            embedded: true,
            readOnly: true,
            confidenceThreshold: 0.2,
            onSave: async function(objects) {
                try {
                    // 转换为YOLO格式，带置信度
                    const lines = objects.map(obj => {
                        const classMap = {
                            'large-sheep': 0,
                            'small-sheep': 1,
                            'large-cattle': 2,
                            'small-cattle': 3
                        };
                        const classId = classMap[obj.type] || 0;
                        const coords = obj.points.flat().map(coord => coord.toFixed(6));
                        const conf = (typeof obj.conf === 'number' && !isNaN(obj.conf)) ? obj.conf : 1;
                        return `${classId} ${coords.join(' ')} ${conf}`;
                    });

                    const labelContent = lines.join('\n');

                    // 保存标注文件
                    const response = await fetch(`/api/count/label?fileName=${encodeURIComponent(labelEditor.fileName)}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'text/plain'
                        },
                        body: labelContent
                    });

                    if (response.ok) {
                        // 生成结果图
                        try {
                            const generateResponse = await fetch('/api/count/generate-result-image', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    fileName: labelEditor.fileName
                                })
                            });
                        } catch (generateError) {
                            console.warn('生成结果图失败:', generateError);
                        }

                        // 退出编辑模式并刷新
                        labelEditor.exitEditMode();
                        document.getElementById('imageSwitcher').style.display = 'flex';
                        updateImageAndInfo();
                        showNotification('标注保存成功', 'success');
                        return true;
                    } else {
                        throw new Error('保存失败');
                    }
                } catch (error) {
                    console.error('保存失败:', error);
                    showNotification('保存失败: ' + error.message, 'error');
                    return false;
                }
            },
            onCancel: function() {
                labelEditor.exitEditMode();
                document.getElementById('imageSwitcher').style.display = 'flex';
                showNotification('已取消编辑', 'info');
            }
        });
        
        window.labelEditor = labelEditor;
        
        // 设置工具栏按钮事件
        document.getElementById('saveLabelBtn')?.addEventListener('click', function() {
            labelEditor.saveLabelsEmbedded();
        });
        
        document.getElementById('cancelLabelBtn')?.addEventListener('click', function() {
            labelEditor.cancelEdit();
        });
    }

    // 编辑标注按钮事件
    document.getElementById('editLabelBtn')?.addEventListener('click', function() {
        if (!images.length) {
            showNotification('没有图片可编辑', 'error');
            return;
        }
        const img = images[currentIndex];
        if (!img) {
            showNotification('未找到当前图片', 'error');
            return;
        }
        
        // 进入编辑模式
        if (window.labelEditor) {
            window.labelEditor.enterEditMode();
            // 隐藏原图/结果图切换按钮
            document.getElementById('imageSwitcher').style.display = 'none';
        }
    });

    // 全部设置为羊/牛按钮事件
    document.getElementById('setAllSheepBtn')?.addEventListener('click', async function() {
        if (!confirm('确定将所有标注全部设置为羊吗？')) return;
        try {
            const resp = await fetch('/api/count/batch-set-labels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'sheep' })
            });
            if (resp.ok) {
                showNotification('全部设置为羊成功', 'success');
                // 刷新统计和当前图片信息
                updateImageAndInfo();
            } else {
                showNotification('操作失败', 'error');
            }
        } catch (e) {
            showNotification('请求失败: ' + e.message, 'error');
        }
    });
    document.getElementById('setAllCattleBtn')?.addEventListener('click', async function() {
        if (!confirm('确定将所有标注全部设置为牛吗？')) return;
        try {
            const resp = await fetch('/api/count/batch-set-labels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'cattle' })
            });
            if (resp.ok) {
                showNotification('全部设置为牛成功', 'success');
                updateImageAndInfo();
            } else {
                showNotification('操作失败', 'error');
            }
        } catch (e) {
            showNotification('请求失败: ' + e.message, 'error');
        }
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
    // 已移除 image-switcher 相关变量和按钮
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

    // 文件名
    const fileNameSpan = document.getElementById('infoFileName');
    if (fileNameSpan) fileNameSpan.textContent = img.name || '-';
    // 原图和结果图路径
    const originalUrl = img.thumbnail;
    // let resultUrl = originalUrl.replace('/original/', '/result/'); // 已移除结果图切换
    // 强制刷新结果图，避免缓存
    // if (showingResult) {
    //     resultUrl += (resultUrl.includes('?') ? '&' : '?') + '_ts=' + Date.now();
    // }
    
    // 更新label-editor的图片
    if (window.labelEditor) {
        window.labelEditor.loadImageAndLabels(img.name, originalUrl);
    }
    
    document.getElementById('infoName').textContent = '张三';
    document.getElementById('infoTime').textContent = img.date || '-';

    // === 前端计数逻辑：读取labels并统计 ===
    const params = new URLSearchParams(window.location.search);
    let farmerId = params.get('farmerId') || params.get('farmer_id');
    const labelApiUrl = `/api/count/label?fileName=${encodeURIComponent(img.name)}`;
    fetch(labelApiUrl)
        .then(res => {
            if (!res.ok) throw new Error('未找到标注文件');
            return res.text();
        })
        .then(txt => {
            // 统计各类数量
            let bigCattle = 0, smallCattle = 0, bigSheep = 0, smallSheep = 0;
            txt.split('\n').forEach(line => {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 1 && parts[0] !== '') {
                    if (parts[0] === '0') bigSheep++;
                    else if (parts[0] === '1') smallSheep++;
                    else if (parts[0] === '2') bigCattle++;
                    else if (parts[0] === '3') smallCattle++;
                }
            });
            document.getElementById('infoCount').innerHTML =
                `<span style="color:#1abc9c;">[前端计数]</span><br>大牛：${bigCattle}头<br>小牛：${smallCattle}头<br>大羊：${bigSheep}只<br>小羊：${smallSheep}只`;
            document.getElementById('currentFileCountInfo').innerHTML =
                `<h3 style="margin:0 0 8px 0;">当前图片信息</h3>
                <div>
                    <span class="info-label">文件名：</span>
                    <span class="info-value" id="infoFileName">${img.name || '-'}</span>
                </div>
                <div>
                    <span class="info-label">姓名：</span>
                    <span class="info-value" id="infoName">张三</span>
                </div>
                <div>
                    <span class="info-label">拍摄时间：</span>
                    <span class="info-value" id="infoTime">${img.date || '-'}</span>
                </div>
                <div>
                    <span class="info-label">计数结果：</span>
                    <span class="info-value count-result" id="infoCount"><span style="color:#1abc9c;">[前端计数]</span><br>大牛：${bigCattle}头<br>小牛：${smallCattle}头<br>大羊：${bigSheep}只<br>小羊：${smallSheep}只</span>
                </div>
                <div style="margin-top:12px;">
                    <button class="btn btn-warning" id="setAllSheepBtn" style="margin-right:8px;">全部设置为羊</button>
                    <button class="btn btn-warning" id="setAllCattleBtn">全部设置为牛</button>
                </div>
                <div id="confidenceSliderBox" style="margin-top:18px;">
                    <label for="confidenceSlider" style="font-weight:bold;">置信度阈值：</label>
                    <input type="range" id="confidenceSlider" min="0" max="1" step="0.01" value="0.2" style="vertical-align:middle;width:160px;">
                    <span id="confidenceValue" style="display:inline-block;width:48px;">0.50</span>
                    <span id="confidenceCount" style="margin-left:18px;color:#e67e22;"></span>
                </div>`;
            // 置信度统计逻辑
            setTimeout(() => {
                const slider = document.getElementById('confidenceSlider');
                const valueSpan = document.getElementById('confidenceValue');
                const countSpan = document.getElementById('confidenceCount');
                if (!slider || !valueSpan || !countSpan) return;
                // 解析labels所有置信度
                let confList = [];
                txt.split('\n').forEach(line => {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 6) {
                        const conf = parseFloat(parts[parts.length - 1]);
                        if (!isNaN(conf)) confList.push(conf);
                    }
                });
                function updateConfCount() {
                    const threshold = parseFloat(slider.value);
                    valueSpan.textContent = threshold.toFixed(2);
                    const cnt = confList.filter(c => c >= threshold).length;
                    countSpan.textContent = `大于该阈值的目标数：${cnt}`;
                    
                    // 更新label-editor的置信度阈值
                    if (window.labelEditor) {
                        window.labelEditor.setConfidenceThreshold(threshold);
                    }
                }
                slider.oninput = updateConfCount;
                updateConfCount();
            }, 0);
            // 重新绑定按钮事件
            document.getElementById('setAllSheepBtn')?.addEventListener('click', async function() {
                if (!confirm('确定将所有标注全部设置为羊吗？')) return;
                try {
                    const resp = await fetch('/api/count/batch-set-labels', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'sheep' })
                    });
                    if (resp.ok) {
                        showNotification('全部设置为羊成功', 'success');
                        updateImageAndInfo();
                    } else {
                        showNotification('操作失败', 'error');
                    }
                } catch (e) {
                    showNotification('请求失败: ' + e.message, 'error');
                }
            });
            document.getElementById('setAllCattleBtn')?.addEventListener('click', async function() {
                if (!confirm('确定将所有标注全部设置为牛吗？')) return;
                try {
                    const resp = await fetch('/api/count/batch-set-labels', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'cattle' })
                    });
                    if (resp.ok) {
                        showNotification('全部设置为牛成功', 'success');
                        updateImageAndInfo();
                    } else {
                        showNotification('操作失败', 'error');
                    }
                } catch (e) {
                    showNotification('请求失败: ' + e.message, 'error');
                }
            });
            // 更新图片状态并刷新文件列表
            // 统计所有图片的牛羊总数（改为直接请求后端summary接口，确保逻辑一致）
            if (farmerId) {
                fetch(`/api/count/summary?farmerId=${encodeURIComponent(farmerId)}`)
                    .then(res => res.json())
                    .then(sum => {
                        document.getElementById('totalCountSummary').innerHTML =
                            `大牛：${sum.big_cattle_total ?? '-'}头，小牛：${sum.small_cattle_total ?? '-'}头<br>大羊：${sum.big_sheep_total ?? '-'}只，小羊：${sum.small_sheep_total ?? '-'}只`;
                        document.getElementById('pastureArea').textContent = sum.pasture_area ?? '-';
                        document.getElementById('artificialPasture').textContent = sum.artificial_pasture ?? '-';
                        document.getElementById('suitableCapacity').textContent = sum.suitable_capacity ?? '-';
                        document.getElementById('currentCapacity').textContent = sum.current_capacity ?? '-';
                        document.getElementById('overloadCapacity').textContent = sum.overload_capacity ?? '-';
                        // 动态设置超载量颜色
                        const overloadSpan = document.getElementById('overloadCapacity');
                        let overload = Number(sum.overload_capacity);
                        if (!isNaN(overload)) {
                            if (overload <= 0) {
                                overloadSpan.style.color = '#1abc1a';
                            } else {
                                // 红色递增，最大为#ff2222
                                let r = 220 + Math.min(35, overload * 5);
                                let g = 60 - Math.min(40, overload * 4);
                                r = Math.min(255, r);
                                g = Math.max(0, g);
                                overloadSpan.style.color = `rgb(${r},${g},34)`;
                            }
                        } else {
                            overloadSpan.style.color = '';
                        }
                    });
            }
        })
        .catch(() => {
            document.getElementById('infoCount').innerHTML = '<span style="color:#1abc9c;">[前端计数]</span><br>大牛：-头<br>小牛：-头<br>大羊：-只<br>小羊：-只';
            document.getElementById('currentFileCountInfo').innerHTML =
                `<h3 style="margin:0 0 8px 0;">当前图片信息</h3>
                <div>
                    <span class="info-label">文件名：</span>
                    <span class="info-value" id="infoFileName">-</span>
                </div>
                <div>
                    <span class="info-label">姓名：</span>
                    <span class="info-value" id="infoName">张三</span>
                </div>
                <div>
                    <span class="info-label">拍摄时间：</span>
                    <span class="info-value" id="infoTime">-</span>
                </div>
                <div>
                    <span class="info-label">计数结果：</span>
                    <span class="info-value count-result" id="infoCount"><span style="color:#1abc9c;">[前端计数]</span>大牛：-头<br>小牛：-头<br>大羊：-只<br>小羊：-只</span>
                </div>`;
            document.getElementById('totalCountSummary').innerHTML = `大牛：-头，小牛：-头，大羊：-只，小羊：-只`;
        });
}

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
            // 初始化label-editor
            initLabelEditor();
            // 确保初始化后立即刷新图片和canvas
            updateImageAndInfo();

            // 检查auto=1参数，自动计数
            const autoParam = params.get('auto');
            if (autoParam === '1' || autoParam === 'true') {
                setTimeout(() => {
                    document.getElementById('countAllBtn')?.click();
                }, 300);
            }
        } else {
            fileList.innerHTML = '<li style="color:#aaa;">暂无图片</li>';
            document.getElementById('infoName').textContent = '-';
            document.getElementById('infoTime').textContent = '-';
            document.getElementById('infoCount').textContent = '-';
        }
    });

    // 返回首页按钮
    document.getElementById('goHomeBtn')?.addEventListener('click', function() {
        window.location.href = 'index.html';
    });

    // 返回文件导入页面按钮
    document.getElementById('backToImportBtn')?.addEventListener('click', function() {
        // 获取farmerId参数
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
        const detection_date = document.getElementById('detectionDate').value;
        const notes = document.getElementById('finishNotes').value.trim();
        const pilot_name = document.getElementById('pilotName').value.trim();
        if (!detection_date) {
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
                body: JSON.stringify({ detection_date, notes, pilot_name, farmer_id: farmerId })
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

    // 自动设置盘点时间为现在
    const detectionDateInput = document.getElementById('detectionDate');
    if (detectionDateInput && !detectionDateInput.value) {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        detectionDateInput.value = `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`;
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
const animalType = form?.querySelector('input[name="animalType"]:checked')?.value || 'cattle';

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
                // 计数完成后去掉auto=1参数
                setTimeout(() => {
                    hideCountingOverlay();
                    // 去掉auto参数并刷新URL（不刷新页面）
                    const url = new URL(window.location.href);
                    if (url.searchParams.has('auto')) {
                        url.searchParams.delete('auto');
                        window.history.replaceState(null, '', url.toString());
                    }
                }, 400);
            }
        } catch (e) {
            if (document.getElementById('countingOverlay').dataset.cancelled !== 'true') {
                hideCountingOverlay();
                alert('请求失败: ' + e.message);
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
});
