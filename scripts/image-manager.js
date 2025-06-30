// 图像管理模块
class ImageManager {
    constructor(options = {}) {
        this.options = options || {};
        this.currentImages = [];
        this.currentPath = '';
        this.currentView = 'grid';
        this.selectedImage = null;
        this.currentSortBy = 'date';
        this.currentGroupBy = 'date';
        this.currentSortOrder = 'desc';

        // 多选相关
        this.selectMode = false;
        this.selectedPaths = new Set();
    }

    async loadDefaultImages() {
        try {
            console.log('📁 正在加载图像库图片...');
            LoadingManager.show();
            
            const response = await fetch('/api/images/default');
            if (response.ok) {
                const data = await response.json();
                if (data.images && data.images.length > 0) {
                    this.loadImages(data.path, data.images);
                    console.log(`✅ 成功加载图像库: ${data.path}`);
                } else {
                    console.log('📁 图像库为空，显示空状态');
                }
            } else {
                console.log('📁 图像库不可用，显示空状态');
            }
        } catch (error) {
            console.error('❌ 加载图像库失败:', error);
            NotificationManager.show('加载图像库失败', 'warning');
        } finally {
            LoadingManager.hide();
        }
    }

    loadImages(path, images) {
        console.log('[ImageManager] 接收到的图片信息:', { path, images });
        this.currentPath = path;
        this.currentImages = images;
        
        const elements = window.elements;
        
        // 更新当前路径和图片数量显示（同一行）
        const pathElem = document.getElementById('currentImagePath');
        if (pathElem) {
            pathElem.textContent = `当前路径: ${path || '无'}`;
        }
        if (elements.imageCount) {
            elements.imageCount.textContent = `${images.length} 张图片`;
        }
        
        // 渲染图片画廊
        this.renderImageGallery();
        
        // 隐藏空状态
        elements.emptyState.style.display = 'none';
        
        NotificationManager.show(`成功加载 ${images.length} 张图片`, 'success');
        // 统计合计结果并显示到状态栏
        updateSummaryInfo(images);
    }

    renderImageGallery() {
        const elements = window.elements;
        
        // 隐藏空状态
        elements.emptyState.style.display = 'none';
        
        if (this.currentImages.length === 0) {
            const gallery = elements.imageGallery;
            gallery.innerHTML = '';
            gallery.appendChild(elements.emptyState);
            elements.emptyState.style.display = 'block';
            return;
        }
        
        // 应用排序和分类
        this.applySortAndGroup();
    }

    createImageCard(image, index) {
        // 判断是否为列表视图且不需要卡片，直接展示原图
        if (this.currentView === 'list') {
            const img = document.createElement('img');
            // 获取原图路径
            let originalPath = '';
            if (image.path && image.path.includes('/thumb/')) {
                originalPath = image.path.replace('/thumb/', '/original/');
            } else if (image.path && image.path.includes('/original/')) {
                originalPath = image.path;
            } else {
                originalPath = image.path || '';
            }
            img.src = originalPath;
            img.alt = image.name || '';
            img.style.maxWidth = '100%';
            img.style.display = 'block';
            img.style.margin = '0 auto 32px auto';
            img.loading = 'lazy';
            img.onclick = () => this.openProcessModal(image, index);
            return img;
        }

        // 其它视图仍用卡片
        const card = document.createElement('div');
        card.className = 'image-card';
        card.dataset.index = index;

        // 多选模式下渲染checkbox
        if (this.selectMode) {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'image-select-checkbox';
            checkbox.style.position = 'absolute';
            checkbox.style.left = '8px';
            checkbox.style.top = '8px';
            checkbox.checked = this.selectedPaths.has(image.path);
            if (checkbox.checked) {
                card.classList.add('selected');
            }
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                if (checkbox.checked) {
                    this.selectedPaths.add(image.path);
                    card.classList.add('selected');
                } else {
                    this.selectedPaths.delete(image.path);
                    card.classList.remove('selected');
                }
                this.updateSelectedCount && this.updateSelectedCount();
            });
            card.appendChild(checkbox);
            card.style.position = 'relative';
        }

        let statusClass = image.processed ? 'processed' : '';
        let statusText = image.processed ? '已计数' : '未计数';

        // 如果图片有文件夹信息，显示文件夹名称（去掉/original）
        let folderInfo = '';
        if (image.folder) {
            let folderDisplay = image.folder.replace(/[/\\]original$/i, '').replace(/^original[/\\]?/i, '');
            if (folderDisplay && folderDisplay !== '.') {
                folderInfo = `<div class="image-folder">${folderDisplay}</div>`;
            }
        }

        if (/\.(tif|tiff)$/i.test(image.name)) {
            // tif/tiff缩略图用canvas+tiff.js渲染
            const canvas = document.createElement('canvas');
            canvas.width = 220;
            canvas.height = 220;
            canvas.style.display = 'block';
            canvas.style.maxWidth = '100%';
            canvas.style.margin = '0 auto 8px auto';
            // 异步加载tif缩略图
            fetch(image.thumbnail.replace('/original/', '/thumb/'))
                .then(r => r.arrayBuffer())
                .then(buf => {
                    const tiff = new Tiff({ buffer: buf });
                    const w = tiff.width(), h = tiff.height();
                    canvas.width = w > 220 ? 220 : w;
                    canvas.height = h > 220 ? 220 : h;
                    const ctx = canvas.getContext('2d');
                    const imgData = ctx.createImageData(w, h);
                    imgData.data.set(tiff.toRGBA());
                    ctx.putImageData(imgData, 0, 0);
                })
                .catch(() => {
                    canvas.style.opacity = '0.3';
                    canvas.title = 'tif缩略图加载失败';
                });
            card.appendChild(canvas);
        } else {
            card.innerHTML += `
                <img src="${image.thumbnail.replace('/original/', '/thumb/')}" alt="${image.name}" loading="lazy">
            `;
        }
        card.innerHTML += `
            <div class="image-card-status ${statusClass}">${statusText}</div>
            <div class="image-card-info">
                ${folderInfo}
                <div class="image-card-title">${image.name}</div>
                <div class="image-card-meta">
                    <span>${image.size}</span>
                    <span>${image.date}</span>
                    <span class="count-result" style="display:block;font-size:13px;">🐏 羊：<span class="sheep-count">--</span>  🐂 牛：<span class="cattle-count">--</span></span>
                </div>
            </div>
        `;

        // 异步加载计数结果
        setTimeout(() => {
            const sheepSpan = card.querySelector('.sheep-count');
            const cattleSpan = card.querySelector('.cattle-count');
            const statusDiv = card.querySelector('.image-card-status');
            if (sheepSpan && cattleSpan && image.name) {
                // 拼接参数
                let url = `/api/count/result?fileName=${encodeURIComponent(image.name)}`;
                // 判断参数
                function getParam(names) {
                    const search = window.location.search;
                    for (const name of names) {
                        const reg = new RegExp('[?&]' + name + '=([^&#]*)', 'i');
                        const r = search.match(reg);
                        if (r != null) return decodeURIComponent(r[1]);
                    }
                    return null;
                }
                const taskId = getParam(['taskId', 'task_id']);
                const farmerId = getParam(['farmerId', 'farmer_id']);
                if (taskId) url += `&taskId=${encodeURIComponent(taskId)}`;
                else if (farmerId) url += `&farmerId=${encodeURIComponent(farmerId)}`;

                fetch(url)
                    .then(res => res.json())
                    .then(data => {
                        const hasSheep = typeof data.sheep_count === 'number' && data.sheep_count >= 0;
                        const hasCattle = typeof data.cattle_count === 'number' && data.cattle_count >= 0;
                        sheepSpan.textContent = hasSheep ? data.sheep_count : '--';
                        cattleSpan.textContent = hasCattle ? data.cattle_count : '--';
                        // 只要有牛/羊数据就显示“已计数”
                        if ((hasSheep && data.sheep_count > 0) || (hasCattle && data.cattle_count > 0)) {
                            if (statusDiv) {
                                statusDiv.textContent = '已计数';
                                statusDiv.classList.add('processed');
                            }
                        }
                    })
                    .catch(() => {
                        sheepSpan.textContent = '--';
                        cattleSpan.textContent = '--';
                    });
            }
        }, 0);

        // 绑定点击事件
        if (!this.selectMode) {
            card.addEventListener('click', () => this.openProcessModal(image, index));
        } else {
            card.addEventListener('click', (e) => {
                // 点击卡片等同于切换checkbox
                const cb = card.querySelector('.image-select-checkbox');
                if (cb) {
                    cb.checked = !cb.checked;
                    if (cb.checked) {
                        this.selectedPaths.add(image.path);
                        card.classList.add('selected');
                    } else {
                        this.selectedPaths.delete(image.path);
                        card.classList.remove('selected');
                    }
                    this.updateSelectedCount && this.updateSelectedCount();
                }
            });
        }

        return card;
    }

    setActiveView(viewType) {
        this.currentView = viewType;
        
        const elements = window.elements;
        
        // 更新按钮状态
        elements.gridViewBtn.classList.toggle('active', viewType === 'grid');
        elements.listViewBtn.classList.toggle('active', viewType === 'list');
        
        // 更新画廊类名
        elements.imageGallery.classList.toggle('list-view', viewType === 'list');
    }

    openProcessModal(image, index) {
        this.selectedImage = { ...image, index };
        const elements = window.elements;

        // 获取media_folder_path
        let mediaFolderPath = '';
        if (image.path) {
            // path: D:/drone-overgrazing-detection/MediaGallery/7_20250623_ces/thumb/xxx.jpg
            // 只去掉最后的/thumb及文件名
            const idx = image.path.lastIndexOf('/thumb/');
            if (idx !== -1) {
                mediaFolderPath = image.path.substring(0, idx);
            } else {
                // 兼容windows路径
                const idx2 = image.path.lastIndexOf('\\thumb\\');
                if (idx2 !== -1) {
                    mediaFolderPath = image.path.substring(0, idx2);
                } else {
                    // fallback: 去掉最后一层
                    mediaFolderPath = image.path.substring(0, image.path.lastIndexOf('/'));
                }
            }
        }

        // 拼接原图和结果图路径
        const fileName = image.name;
        // 优先用image.folder字段推断web路径
        let webFolderPath = '';
        if (image.folder) {
            // image.folder 可能是绝对路径或相对路径
            // 取/MediaGallery/xxx_xxx_xxx
            const folderNorm = image.folder.replace(/\\/g, '/');
            const match = folderNorm.match(/\/MediaGallery\/[^/]+/);
            if (match) {
                webFolderPath = match[0];
            } else if (folderNorm.includes('MediaGallery/')) {
                webFolderPath = '/' + folderNorm.split('MediaGallery/').pop().split('/')[0];
                webFolderPath = '/MediaGallery/' + webFolderPath;
            }
        }
        if (!webFolderPath) {
            // fallback: 从image.path推断
            const pathForMatch = (image.path || '').replace(/\\/g, '/');
            const match = pathForMatch.match(/\/MediaGallery\/[^/]+/);
            if (match) {
                webFolderPath = match[0];
            }
        }
        // fallback: 取路径前缀
        if (!webFolderPath && image.path) {
            const p = image.path.replace(/\\/g, '/');
            const idx = p.indexOf('/MediaGallery/');
            if (idx !== -1) {
                const arr = p.substring(idx).split('/');
                if (arr.length > 2) {
                    webFolderPath = '/' + arr.slice(1, 3).join('/');
                }
            }
        }
        // 最终拼接
        const originalPath = webFolderPath + '/original/' + fileName;
        const resultPath = webFolderPath + '/result/' + fileName;

        // 异步获取计数结果
        fetch(`/api/count/result?fileName=${encodeURIComponent(fileName)}`)
            .then(res => res.json())
            .then(data => {
                const sheep = data.sheep_count !== null && data.sheep_count !== undefined ? data.sheep_count : '-';
                const cattle = data.cattle_count !== null && data.cattle_count !== undefined ? data.cattle_count : '-';

                // 构造弹窗内容
                const modalHtml = `
                    <div style="background:#fff;border-radius:12px;box-shadow:0 4px 32px #0002;padding:48px 48px;max-width:85vw;width:85vw;margin:0 auto;">
                        <div style="font-size:13px;color:#888;text-align:left;margin-bottom:10px;">
                            * 点击图片可在新页面放大查看
                        </div>
                        <div style="display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap;">
                            <div>
                            <div style="font-weight:bold;margin-bottom:6px;">原图</div>
                            <a href="${originalPath}" target="_blank" title="点击放大原图">
                                <img src="${originalPath}" alt="原图" style="max-width:500px;max-height:500px;border-radius:6px;border:1px solid #ddd;">
                            </a>
                        </div>
                        <div>
                            <div style="font-weight:bold;margin-bottom:6px;">结果图</div>
                            <a href="${resultPath}" target="_blank" title="点击放大结果图">
                                <img id="modalResultImg" src="${resultPath}" alt="结果图" style="max-width:500px;max-height:500px;border-radius:6px;border:1px solid #ddd;">
                            </a>
                            <div id="resultImgPlaceholder" style="display:none;color:#e74c3c;font-size:14px;margin-top:8px;">结果图未生成</div>
                            </div>
                            <div style="min-width:120px;">
                                <div style="font-weight:bold;margin-bottom:6px;">计数结果</div>
                                <div>🐏 羊：${sheep} 只</div>
                                <div>🐂 牛：${cattle} 头</div>
                            </div>
                        </div>
                    </div>
                `;
                elements.previewImage.src = '';
                elements.imageName.textContent = image.name;
                elements.imageSize.textContent = `大小: ${image.size} | 日期: ${image.date}`;
                const modalContent = elements.processModal.querySelector('.process-modal-content');
                if (modalContent) {
                    modalContent.innerHTML = modalHtml;
                } else {
                    elements.processModal.innerHTML = modalHtml;
                }
                elements.processModal.classList.add('show');
                document.body.style.overflow = 'hidden';
            });
    }

    updateScriptOptions() {
        const processControls = document.querySelector('.process-options');
        if (!processControls) return;
        
        // 清除现有选项并添加三选一单选框
        processControls.innerHTML = `
            <h3>处理选项</h3>
            <label class="radio-label">
                <input type="radio" name="animalType" value="cow" />
                <span>该图只有牛</span>
            </label>
            <label class="radio-label">
                <input type="radio" name="animalType" value="sheep" />
                <span>该图只有羊</span>
            </label>
            <label class="radio-label">
                <input type="radio" name="animalType" value="both" checked />
                <span>牛羊混合</span>
            </label>
        `;
    }

    closeProcessModal() {
        const elements = window.elements;
        elements.processModal.classList.remove('show');
        document.body.style.overflow = 'auto';
        this.selectedImage = null;
    }

    closeResultModal() {
        const elements = window.elements;
        elements.resultModal.classList.remove('show');
        document.body.style.overflow = 'auto';
    }

    async startImageProcessing() {
        if (!this.selectedImage) return;
        
        // 获取选中的脚本
        const selectedScripts = [];
        const scriptCheckboxes = document.querySelectorAll('input[id^="script_"]:checked');
        scriptCheckboxes.forEach(checkbox => {
            const scriptId = checkbox.id.replace('script_', '');
            selectedScripts.push(scriptId);
        });
        
        console.log('🐍 选中的脚本:', selectedScripts);
        
        // 关闭处理模态框
        this.closeProcessModal();
        
        // 显示进度模态框
        DialogManager.showProgress();
        
        try {
            // 调用后端处理API
            const response = await fetch('/api/process-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    imagePath: this.selectedImage.path,
                    selectedScripts: selectedScripts
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                DialogManager.hideProgress();
                this.showProcessingResult(result);
                
                // 更新图片状态
                if (this.selectedImage) {
                    this.currentImages[this.selectedImage.index].processed = true;
                    this.renderImageGallery();
                }
            } else {
                throw new Error('处理请求失败');
            }
        } catch (error) {
            console.error('图片处理失败:', error);
            DialogManager.hideProgress();
            NotificationManager.show('图片处理失败: ' + error.message, 'error');
        }
    }

    showProcessingResult(result) {
        const resultHTML = this.generateResultHTML(result);
        const elements = window.elements;
        elements.resultContent.innerHTML = resultHTML;
        elements.resultModal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    generateResultHTML(result) {
        let html = `
            <div class="result-summary">
                <h3>处理完成</h3>
                <p><strong>图片:</strong> ${result.imageName}</p>
                <p><strong>处理时间:</strong> ${result.processingTime}</p>
                <p><strong>状态:</strong> <span class="status-success">成功</span></p>
            </div>
        `;
        
        if (result.summary) {
            html += `
                <div class="result-summary-stats">
                    <p><strong>脚本执行情况:</strong></p>
                    <ul>
                        <li>总脚本数: ${result.summary.totalScripts}</li>
                        <li>成功: ${result.summary.successfulScripts}</li>
                        <li>失败: ${result.summary.failedScripts}</li>
                    </ul>
                </div>
            `;
        }
        
        if (result.scriptResults && result.scriptResults.length > 0) {
            html += '<div class="script-results">';
            result.scriptResults.forEach(scriptResult => {
                html += `
                    <div class="result-item">
                        <h4>${scriptResult.scriptName}</h4>
                        <p><strong>状态:</strong> 
                            <span class="status-${scriptResult.success ? 'success' : 'error'}">
                                ${scriptResult.success ? '成功' : '失败'}
                            </span>
                        </p>
                `;
                
                if (scriptResult.success && scriptResult.data) {
                    // 处理YOLO检测结果
                    if (scriptResult.data.results && scriptResult.data.results.sheep_count !== undefined) {
                        html += `
                            <div class="sheep-count-result">
                                <div class="count-display">
                                    <div class="count-number">${scriptResult.data.results.sheep_count}</div>
                                    <div class="count-label">只羊</div>
                                </div>
                            </div>
                        `;
                        
                        // 显示处理后的图片
                        if (scriptResult.data.results.processed_image) {
                            html += `
                                <div class="processed-image">
                                    <h5>处理结果图片:</h5>
                                    <img src="file://${scriptResult.data.results.processed_image}" 
                                         alt="处理结果" style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px;">
                                </div>
                            `;
                        }
                        
                        // 显示结果目录信息
                        if (scriptResult.data.results.results_directory) {
                            html += `
                                <p><strong>结果保存位置:</strong> ${scriptResult.data.results.results_directory}</p>
                            `;
                        }
                    } else if (typeof scriptResult.data === 'object' && !scriptResult.data.raw) {
                        html += `<pre>${JSON.stringify(scriptResult.data, null, 2)}</pre>`;
                    } else if (scriptResult.data.content) {
                        html += `<p>${scriptResult.data.content}</p>`;
                    }
                } else if (!scriptResult.success) {
                    html += `<p class="error-message">错误: ${scriptResult.error}</p>`;
                }
                
                html += '</div>';
            });
            html += '</div>';
        }
        
        return html;
    }

    // 排序和分类功能
    handleSortChange(event) {
        this.currentSortBy = event.target.value;
        console.log('排序方式改变:', this.currentSortBy);
        this.applySortAndGroup();
    }

    handleGroupChange(event) {
        this.currentGroupBy = event.target.value;
        console.log('分类方式改变:', this.currentGroupBy);
        this.applySortAndGroup();
    }

    toggleSortOrder() {
        this.currentSortOrder = this.currentSortOrder === 'asc' ? 'desc' : 'asc';
        console.log('排序顺序改变:', this.currentSortOrder);
        this.updateSortOrderIcon();
        this.applySortAndGroup();
    }

    updateSortOrderIcon() {
        const elements = window.elements;
        if (elements.sortOrderIcon) {
            const iconClass = this.currentSortOrder === 'asc' ? 'fa-sort-amount-up' : 'fa-sort-amount-down';
            elements.sortOrderIcon.className = `fas ${iconClass}`;
            elements.sortOrderBtn.title = this.currentSortOrder === 'asc' ? '升序 (点击切换为降序)' : '降序 (点击切换为升序)';
        }
    }

    applySortAndGroup() {
        if (!this.currentImages || this.currentImages.length === 0) return;
        
        // 创建排序后的图片副本
        let sortedImages = [...this.currentImages];
        
        // 应用排序
        sortedImages.sort((a, b) => {
            let comparison = 0;
            
            switch (this.currentSortBy) {
                case 'date':
                    // 按拍摄时间排序
                    const dateA = new Date(a.dateTime || a.date || 0);
                    const dateB = new Date(b.dateTime || b.date || 0);
                    comparison = dateA - dateB;
                    break;
                case 'name':
                    // 按文件名排序
                    comparison = a.name.localeCompare(b.name);
                    break;
                case 'size':
                    // 按文件大小排序
                    const sizeA = parseInt(a.sizeBytes || 0);
                    const sizeB = parseInt(b.sizeBytes || 0);
                    comparison = sizeA - sizeB;
                    break;
                default:
                    comparison = 0;
            }
            
            return this.currentSortOrder === 'asc' ? comparison : -comparison;
        });
        
        // 应用分组和渲染
        if (this.currentGroupBy === 'none') {
            this.renderImagesWithoutGroups(sortedImages);
        } else {
            this.renderImagesWithGroups(sortedImages, this.currentGroupBy);
        }
    }

    renderImagesWithoutGroups(images) {
        const elements = window.elements;
        const gallery = elements.imageGallery;
        gallery.innerHTML = '';

        if (images.length === 0) {
            gallery.appendChild(elements.emptyState);
            elements.emptyState.style.display = 'block';
            return;
        }

        // 自动轮询刷新机制
        let failedCount = 0;
        let totalCount = images.length;
        let retryCount = 0;
        const maxRetry = 10;
        const retryInterval = 2000; // 2秒

        // 直接渲染所有图片
        images.forEach((image, index) => {
            const card = this.createImageCard(image, index);
            // 检查图片加载失败
            const imgElem = card.querySelector('img');
            if (imgElem) {
                imgElem.onerror = () => {
                    failedCount++;
                    imgElem.style.opacity = '0.3';
                    imgElem.title = '缩略图未生成，稍后自动刷新';
                };
            }
            gallery.appendChild(card);
        });

        this.addFadeInAnimation();

        // 如果有图片加载失败，自动轮询刷新
        setTimeout(() => {
            const imgs = gallery.querySelectorAll('img');
            let failed = 0;
            imgs.forEach(img => {
                if (!img.complete || img.naturalWidth === 0) failed++;
            });
            if (failed > 0 && retryCount < maxRetry) {
                retryCount++;
                NotificationManager && NotificationManager.show(`部分图片缩略图未生成，正在自动刷新（第${retryCount}次）...`, 'info');
                // 重新拉取图片列表
                if (typeof window.imageManager?.currentPath === 'string' && window.imageManager.currentPath) {
                    // 重新请求图片列表
                    fetch('/api/select-folder', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ folderPath: window.imageManager.currentPath.replace(/[\\/]+thumb[\\/]*$/i, '') })
                    }).then(res => res.json()).then(data => {
                        if (data && data.images) {
                            window.imageManager.loadImages(data.path, data.images);
                        }
                    });
                }
            }
        }, retryInterval);
    }

    renderImagesWithGroups(images, groupBy) {
        const elements = window.elements;
        const gallery = elements.imageGallery;
        gallery.innerHTML = '';
        
        if (images.length === 0) {
            gallery.appendChild(elements.emptyState);
            elements.emptyState.style.display = 'block';
            return;
        }
        
        // 按照分组方式对图片进行分组
        const groups = this.groupImages(images, groupBy);
        
        // 渲染分组
        Object.keys(groups).forEach(groupName => {
            const groupImages = groups[groupName];
            
            // 创建分组标题
            const groupHeader = document.createElement('div');
            groupHeader.className = 'image-group-header';
            groupHeader.innerHTML = `
                <h3>${groupName}</h3>
                <span class="image-group-count">${groupImages.length} 张图片</span>
            `;
            gallery.appendChild(groupHeader);
            
            // 创建分组容器
            const groupContainer = document.createElement('div');
            groupContainer.className = 'image-group-container';
            
            // 渲染该分组的图片
            groupImages.forEach((image, index) => {
                const card = this.createImageCard(image, index);
                groupContainer.appendChild(card);
            });
            
            gallery.appendChild(groupContainer);
        });
        
        this.addFadeInAnimation();
    }

    groupImages(images, groupBy) {
        const groups = {};
        
        images.forEach(image => {
            let groupKey;
            
            switch (groupBy) {
                case 'date':
                    // 按拍摄日期分组
                    const date = new Date(image.dateTime || image.date || 0);
                    groupKey = date.toLocaleDateString('zh-CN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                    break;
                case 'folder':
                    // 按文件夹分组
                    groupKey = image.folder || '未分类';
                    break;
                default:
                    groupKey = '全部';
            }
            
            if (!groups[groupKey]) {
                groups[groupKey] = [];
            }
            groups[groupKey].push(image);
        });
        
        return groups;
    }

    addFadeInAnimation() {
        const elements = window.elements;
        requestAnimationFrame(() => {
            const cards = elements.imageGallery.querySelectorAll('.image-card');
            cards.forEach((card, index) => {
                setTimeout(() => {
                    card.classList.add('fade-in');
                }, index * 50);
            });
        });
    }

    updateSelectedCount() {
        const countSpan = document.getElementById('selectedCount');
        const deleteBtn = document.getElementById('deleteSelectedBtn');
        if (this.selectMode) {
            const count = this.selectedPaths.size;
            if (count > 0) {
                countSpan.style.display = '';
                countSpan.textContent = `已选 ${count} 张图片`;
                deleteBtn.style.display = '';
            } else {
                countSpan.style.display = 'none';
                countSpan.textContent = '';
                deleteBtn.style.display = 'none';
            }
        } else {
            countSpan.style.display = 'none';
            countSpan.textContent = '';
            deleteBtn.style.display = 'none';
        }
    }

    async deleteSelectedImages() {
        if (this.selectedPaths.size === 0) return;
        const confirmed = window.confirm('确定要删除所选图片吗？此操作不可恢复！');
        if (!confirmed) return;
        // 收集原图、thumb、result三种路径
        const imagePaths = [];
        this.selectedPaths.forEach(origPath => {
            imagePaths.push(origPath);
            // 替换thumb/result路径
            if (origPath.includes('/thumb/')) {
                // thumb路径，推断原图和result路径
                const base = origPath.replace('/thumb/', '/');
                imagePaths.push(base.replace(/\/([^\/]+)$/, '/result/$1'));
                imagePaths.push(base.replace(/\/([^\/]+)$/, '/original/$1'));
            } else if (origPath.includes('/original/')) {
                // 原图路径，推断thumb和result路径
                imagePaths.push(origPath.replace('/original/', '/thumb/'));
                imagePaths.push(origPath.replace('/original/', '/result/'));
            } else if (origPath.includes('/result/')) {
                // result路径，推断thumb和original路径
                imagePaths.push(origPath.replace('/result/', '/thumb/'));
                imagePaths.push(origPath.replace('/result/', '/original/'));
            }
        });
        // 去重
        const uniquePaths = Array.from(new Set(imagePaths));
        // 优先调用外部onDeleteSelected回调（如有）
        if (this.options && typeof this.options.onDeleteSelected === 'function') {
            this.options.onDeleteSelected(uniquePaths);
            return;
        }
        try {
            const resp = await fetch('/api/delete-image', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imagePaths: uniquePaths })
            });
            if (resp.ok) {
                const result = await resp.json();
                // 过滤掉已删除的图片（只按原始路径过滤）
                this.currentImages = this.currentImages.filter(img => !this.selectedPaths.has(img.path));
                this.selectedPaths.clear();
                this.renderImageGallery();
                this.updateSelectedCount();
                NotificationManager.show('删除成功', 'success');
            } else {
                NotificationManager.show('删除失败', 'error');
            }
        } catch (e) {
            NotificationManager.show('删除失败: ' + e.message, 'error');
        }
    }
}

function getUrlParam(name) {
    const url = window.location.search;
    const reg = new RegExp('[?&]' + name + '=([^&#]*)', 'i');
    const r = url.match(reg);
    if (r != null) return decodeURIComponent(r[1]);
    return null;
}

let __detectionPageLoaded = false;

 // 入口：页面加载后自动初始化
document.addEventListener('DOMContentLoaded', async () => {
    if (__detectionPageLoaded) return;
    __detectionPageLoaded = true;

    // 多选按钮事件绑定
    const toggleSelectBtn = document.getElementById('toggleSelectModeBtn');
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    if (toggleSelectBtn) {
        toggleSelectBtn.addEventListener('click', () => {
            window.imageManager.selectMode = !window.imageManager.selectMode;
            if (!window.imageManager.selectMode) {
                window.imageManager.selectedPaths.clear();
            }
            window.imageManager.renderImageGallery();
            window.imageManager.updateSelectedCount();
            toggleSelectBtn.textContent = window.imageManager.selectMode ? '退出选择' : '选择图片';
        });
    }
    if (deleteSelectedBtn) {
        deleteSelectedBtn.addEventListener('click', () => {
            window.imageManager.deleteSelectedImages();
        });
    }

    // 支持 taskId/task_id、farmerId/farmer_id 四种参数（不区分大小写）
    function getParamCaseInsensitive(names) {
        const search = window.location.search;
        for (const name of names) {
            const reg = new RegExp('[?&]' + name + '=([^&#]*)', 'i');
            const r = search.match(reg);
            if (r != null) return decodeURIComponent(r[1]);
        }
        return null;
    }
    const taskId = getParamCaseInsensitive(['taskId', 'task_id']);
    const farmerId = getParamCaseInsensitive(['farmerId', 'farmer_id']);

    if (taskId) {
        console.log('[Detection] taskId/task_id参数存在，尝试只加载该任务的图片');
        try {
            const taskResp = await fetch(`/api/detection-task/${taskId}`);
            if (taskResp.ok) {
                const task = await taskResp.json();
                console.log('[Detection] 获取到任务详情:', task);
                // 填充姓名
                if (task && task.farmer_id) {
                    fetch(`/api/farmers/${task.farmer_id}`)
                        .then(res => res.json())
                        .then(farmer => {
                            const nameElem = document.getElementById('farmerName');
                            if (nameElem && farmer && farmer.name) {
                                nameElem.textContent = farmer.name;
                            }
                        });
                }
                if (task && task.media_folder_path) {
                    window.detectionTask = task;
                    console.log('[Detection] 使用media_folder_path加载图片:', task.media_folder_path);
                    const folderResp = await fetch(`/api/select-folder`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ folderPath: task.media_folder_path })
                    });
                    if (folderResp.ok) {
                        const folderData = await folderResp.json();
                        console.log('[Detection] 读取文件夹图片结果:', folderData);
                        window.imageManager.loadImages(folderData.path, folderData.images || []);
                    } else {
                        NotificationManager.show('无法读取盘点任务文件夹', 'error');
                        window.imageManager.loadImages('', []);
                    }
                } else {
                    NotificationManager.show('未找到盘点任务文件夹', 'error');
                    window.imageManager.loadImages('', []);
                }
            } else {
                NotificationManager.show('未找到盘点任务', 'error');
                window.imageManager.loadImages('', []);
            }
        } catch (err) {
            NotificationManager.show('加载盘点任务图片失败', 'error');
            window.imageManager.loadImages('', []);
            console.error(err);
        }
    } else if (farmerId) {
        // farmerId/farmer_id 时，始终使用固定临时目录
        console.log('[Detection] farmerId/farmer_id参数存在，使用固定临时目录加载');
        try {
            const tempResp = await fetch(`/api/temp-folder`);
            if (tempResp.ok) {
                const tempData = await tempResp.json();
                if (tempData && tempData.path && tempData.images) {
                    window.imageManager.loadImages(tempData.path, tempData.images);
                } else {
                    NotificationManager.show('临时目录创建失败', 'error');
                    window.imageManager.loadImages('', []);
                }
            } else {
                NotificationManager.show('临时目录接口调用失败', 'error');
                window.imageManager.loadImages('', []);
            }
        } catch (err) {
            NotificationManager.show('创建临时目录失败', 'error');
            window.imageManager.loadImages('', []);
            console.error(err);
        }
    } else {
        // 都没有参数，加载默认图库
        console.log('[Detection] 无taskId/task_id或farmerId/farmer_id参数，加载默认图像库');
        window.imageManager.loadDefaultImages();
    }
});

// 禁止外部重复调用默认图库加载
window.__detectionPageLoaded = true;

/**
 * 统计所有图片的羊、牛数量，并显示到状态栏
 * @param {Array} images 
 */
function updateSummaryInfo(images) {
    const summaryElem = document.getElementById('summaryInfo');
    if (!summaryElem) return;
    if (!images || images.length === 0) {
        summaryElem.textContent = '';
        return;
    }
    // 默认换算系数
    const sheepFactor = 0.6;
    const cattleFactor = 0.7;

    // 判断参数
    function getParam(names) {
        const search = window.location.search;
        for (const name of names) {
            const reg = new RegExp('[?&]' + name + '=([^&#]*)', 'i');
            const r = search.match(reg);
            if (r != null) return decodeURIComponent(r[1]);
        }
        return null;
    }
    const taskId = getParam(['taskId', 'task_id']);
    const farmerId = getParam(['farmerId', 'farmer_id']);

    let url = '';
    if (taskId) {
        url = `/api/count/summary?taskId=${encodeURIComponent(taskId)}`;
    } else if (farmerId) {
        url = `/api/count/summary?farmerId=${encodeURIComponent(farmerId)}`;
    }

    if (url) {
        fetch(url)
            .then(res => res.json())
            .then(data => {
                const sheepTotal = typeof data.sheep_total === 'number' ? data.sheep_total : '-';
                const cattleTotal = typeof data.cattle_total === 'number' ? data.cattle_total : '-';
                const pastureArea = typeof data.pasture_area === 'number' ? data.pasture_area : '-';
                summaryElem.textContent = `合计结果：羊：${sheepTotal}只，牛：${cattleTotal}头  ｜ 羊单元换算系数：${sheepFactor} ｜ 牛单元换算系数：${cattleFactor} ｜ 草场面积：${pastureArea}亩`;
                // 同步填充姓名
                if (data.name !== undefined) {
                    const nameElem = document.getElementById('farmerName');
                    if (nameElem) nameElem.textContent = data.name || '-';
                }
            })
            .catch(() => {
                summaryElem.textContent = `合计结果：- ｜ 羊单元换算系数：${sheepFactor} ｜ 牛单元换算系数：${cattleFactor} ｜ 草场面积：-亩`;
            });
    } else {
        summaryElem.textContent = `合计结果：- ｜ 羊单元换算系数：${sheepFactor} ｜ 牛单元换算系数：${cattleFactor} ｜ 草场面积：-亩`;
    }
}

// 创建全局实例
window.imageManager = new ImageManager(window.imageManagerOptions || {});

// 将ImageManager添加到全局作用域
window.ImageManager = ImageManager;

// 保持向后兼容性
window.loadImages = (path, images) => window.imageManager.loadImages(path, images);
window.setActiveView = (viewType) => window.imageManager.setActiveView(viewType);
window.openProcessModal = (image, index) => window.imageManager.openProcessModal(image, index);
window.closeProcessModal = () => window.imageManager.closeProcessModal();
window.closeResultModal = () => window.imageManager.closeResultModal();
window.startImageProcessing = () => window.imageManager.startImageProcessing();
