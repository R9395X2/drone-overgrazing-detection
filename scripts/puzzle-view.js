/* global exifr */

// 拼图视角模块
class PuzzleView {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.images = [];
        this.imageData = [];
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.selectedImage = null;
        this.isActive = false;
        
        // 坐标系参数
        this.metersPerPixel = 0.6; // 1像素代表1米
        this.centerLat = 0;
        this.centerLon = 0;
        
        this.init();
    }

    init() {
        this.canvas = document.getElementById('puzzleCanvas');
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.setupEventListeners();
        this.resizeCanvas();
        
        // 监听窗口大小变化
        window.addEventListener('resize', () => {
            if (this.isActive) {
                this.resizeCanvas();
                this.redraw();
            }
        });
    }

    setupEventListeners() {
        const puzzleBtn = document.getElementById('puzzleViewBtn');
        const exitBtn = document.getElementById('exitPuzzleBtn');
        const resetBtn = document.getElementById('resetViewBtn');

        if (puzzleBtn) {
            puzzleBtn.addEventListener('click', () => this.showPuzzleView());
        }
        
        if (exitBtn) {
            exitBtn.addEventListener('click', () => this.hidePuzzleView());
        }
        
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetView());
        }

        // Canvas事件
        if (this.canvas) {
            this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
            this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
            this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
            // 修正：wheel事件加{ passive: false }，防止浏览器默认滚动
            this.canvas.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
            this.canvas.addEventListener('click', (e) => this.onClick(e));
        }
    }

    resizeCanvas() {
        const container = document.getElementById('puzzleCanvasContainer');
        if (!container || !this.canvas) return;
        
        const rect = container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
    }

    async showPuzzleView() {
        if (!window.imageManager || !window.imageManager.currentImages.length) {
            NotificationManager.show('请先加载图片', 'warning');
            return;
        }

        this.isActive = true;
        
        // 切换视图
        document.getElementById('imageGallery').style.display = 'none';
        document.getElementById('puzzleView').style.display = 'block';
        
        this.resizeCanvas();
        
        // 显示加载状态
        document.getElementById('puzzleLoading').style.display = 'flex';
        document.getElementById('puzzleInfo').textContent = '正在解析图片位置信息...';

        try {
            await this.loadImageData();
            this.calculateLayout();
            this.resetView();
            this.redraw();
            
            document.getElementById('puzzleLoading').style.display = 'none';
            document.getElementById('puzzleInfo').textContent = `已加载 ${this.imageData.length} 张图片`;
        } catch (error) {
            console.error('加载拼图视角失败:', error);
            NotificationManager.show('加载拼图视角失败: ' + error.message, 'error');
            this.hidePuzzleView();
        }
    }

    hidePuzzleView() {
        this.isActive = false;
        document.getElementById('puzzleView').style.display = 'none';
        document.getElementById('imageGallery').style.display = 'block';
        this.selectedImage = null;
    }

    async loadImageData() {
        const images = window.imageManager.currentImages;
        this.imageData = [];

        // 不再检测window.exifr，直接用import的exifr

        const loadPromises = images.map(async (img, index) => {
            try {
                // 获取原图HTTP路径
                let originalPath = img.path;
                // 如果是thumb目录，替换为original目录
                if (originalPath.includes('/thumb/')) {
                    originalPath = originalPath.replace('/thumb/', '/original/');
                }
                // 如果是本地绝对路径，转为HTTP URL
                if (/^[a-zA-Z]:\\/.test(originalPath)) {
                    // 只保留MediaGallery及后面的部分
                    const idx = originalPath.replace(/\\/g, '/').indexOf('MediaGallery/');
                    if (idx !== -1) {
                        originalPath = '/' + originalPath.replace(/\\/g, '/').substring(idx);
                    }
                }
                // 如果不是以http开头，自动补全为相对URL
                if (!/^https?:\/\//.test(originalPath) && !originalPath.startsWith('/')) {
                    originalPath = '/' + originalPath;
                }
                // 调试输出
                // console.log('exifr originalPath:', originalPath);

                // 读取EXIF数据
                const exifData = await exifr.parse(originalPath, {
                    gps: true,
                    tiff: true,
                    exif: true
                });
                
                if (!exifData || !exifData.latitude || !exifData.longitude) {
                    console.warn(`图片 ${img.name} 缺少GPS信息`);
                    return null;
                }

                // 创建图片对象
                const htmlImg = new Image();
                htmlImg.crossOrigin = 'anonymous';
                
                return new Promise((resolve) => {
                    htmlImg.onload = () => {
                        const imageInfo = {
                            index,
                            originalData: img,
                            image: htmlImg,
                            exif: exifData,
                            lat: exifData.latitude,
                            lon: exifData.longitude,
                            alt: exifData.GPSAltitude || exifData.gpsAltitude || exifData.altitude || 0,
                            focalLength: exifData.FocalLengthIn35mmFilm || exifData.FocalLengthIn35mmFormat || exifData.FocalLengthIn35mm || exifData.FocalLength || 24, // 35mm等效焦距
                            x: 0, // 将在calculateLayout中计算
                            y: 0,
                            width: 0,
                            height: 0,
                            selected: false
                        };
                        
                        // 计算拍摄覆盖范围
                        this.calculateImageCoverage(imageInfo);
                        resolve(imageInfo);
                    };
                    
                    htmlImg.onerror = () => {
                        console.warn(`图片 ${img.name} 加载失败`);
                        resolve(null);
                    };
                    
                    htmlImg.src = originalPath;
                });
            } catch (error) {
                console.warn(`解析图片 ${img.name} EXIF失败:`, error);
                return null;
            }
        });

        const results = await Promise.all(loadPromises);
        this.imageData = results.filter(item => item !== null);

        // 统一修正所有图片的高度，使中位数为100米
        if (this.imageData.length > 0) {
            const alts = this.imageData.map(img => img.alt).sort((a, b) => a - b);
            const midIdx = Math.floor(alts.length / 2);
            const medianAlt = alts.length % 2 === 0
                ? (alts[midIdx - 1] + alts[midIdx]) / 2
                : alts[midIdx];
            const offset = medianAlt - 100;
            this.imageData.forEach(img => {
                img.alt = Math.max(img.alt - offset, 0);
            });
        }
        
        if (this.imageData.length === 0) {
            throw new Error('没有找到包含GPS信息的图片');
        }
    }

    calculateImageCoverage(imageInfo) {
        // 简化的覆盖范围计算
        // 基于焦距、高度和图片尺寸估算地面覆盖范围
        
        const sensorWidth = 36; // 35mm全画幅宽度(mm)
        const sensorHeight = 24; // 35mm全画幅高度(mm)
        const focalLength = imageInfo.focalLength || 24;
        const altitude = Math.max(imageInfo.alt || 100, 50); // 最小50米高度

        console.log('图片名:', imageInfo.originalData.name, '焦距:', focalLength, '高度:', altitude);

        // 计算地面覆盖范围（米）
        const groundWidth = (sensorWidth * altitude) / focalLength;
        const groundHeight = (sensorHeight * altitude) / focalLength;
        
        // 固定基准焦距缩放显示
        const baseFocal = 24; // 24mm为基准
        const scale = baseFocal / focalLength;
        const maxDisplaySize = 200;
        const aspectRatio = imageInfo.image.width / imageInfo.image.height;

        // 以基准宽度为maxDisplaySize，按比例缩放
        imageInfo.width = maxDisplaySize * scale;
        imageInfo.height = imageInfo.width / aspectRatio;
    }

    calculateLayout() {
        if (this.imageData.length === 0) return;
        
        // 计算坐标系中心点
        const lats = this.imageData.map(img => img.lat);
        const lons = this.imageData.map(img => img.lon);
        
        this.centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
        this.centerLon = (Math.min(...lons) + Math.max(...lons)) / 2;
        
        // 转换经纬度为平面坐标
        this.imageData.forEach(imageInfo => {
            const { x, y } = this.latLonToXY(imageInfo.lat, imageInfo.lon);
            imageInfo.x = x;
            imageInfo.y = y;
        });
    }

    latLonToXY(lat, lon) {
        // 简化的平面投影（适用于小范围区域）
        const latDiff = lat - this.centerLat;
        const lonDiff = lon - this.centerLon;
        
        // 1度纬度约111km，1度经度约111km*cos(lat)
        const metersPerDegreeLat = 111000;
        const metersPerDegreeLon = 111000 * Math.cos(this.centerLat * Math.PI / 180);
        
        const x = lonDiff * metersPerDegreeLon / this.metersPerPixel;
        const y = -latDiff * metersPerDegreeLat / this.metersPerPixel; // Y轴向下为正
        
        return { x, y };
    }

    resetView() {
        if (this.imageData.length === 0) return;
        
        // 计算所有图片的边界
        const xs = this.imageData.map(img => img.x);
        const ys = this.imageData.map(img => img.y);
        
        const minX = Math.min(...xs) - 100;
        const maxX = Math.max(...xs) + 100;
        const minY = Math.min(...ys) - 100;
        const maxY = Math.max(...ys) + 100;
        
        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;
        
        // 计算合适的缩放比例
        const scaleX = this.canvas.width / contentWidth;
        const scaleY = this.canvas.height / contentHeight;
        this.scale = Math.min(scaleX, scaleY) * 0.8; // 留一些边距
        
        // 居中显示
        this.offsetX = this.canvas.width / 2 - (minX + maxX) / 2 * this.scale;
        this.offsetY = this.canvas.height / 2 - (minY + maxY) / 2 * this.scale;
    }

    redraw() {
        if (!this.ctx) return;
        
        // 清空画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制背景网格
        this.drawGrid();
        
        // 绘制图片
        this.imageData.forEach(imageInfo => {
            this.drawImage(imageInfo);
        });
        
        // 绘制选中框
        if (this.selectedImage) {
            this.drawSelection(this.selectedImage);
        }
    }

    drawGrid() {
        this.ctx.save();
        this.ctx.strokeStyle = '#e0e0e0';
        this.ctx.lineWidth = 1;
        
        const gridSize = 100; // 10米网格
        const startX = Math.floor(-this.offsetX / this.scale / gridSize) * gridSize;
        const startY = Math.floor(-this.offsetY / this.scale / gridSize) * gridSize;
        const endX = startX + this.canvas.width / this.scale + gridSize;
        const endY = startY + this.canvas.height / this.scale + gridSize;
        
        // 绘制垂直线
        for (let x = startX; x <= endX; x += gridSize) {
            const screenX = x * this.scale + this.offsetX;
            this.ctx.beginPath();
            this.ctx.moveTo(screenX, 0);
            this.ctx.lineTo(screenX, this.canvas.height);
            this.ctx.stroke();
        }
        
        // 绘制水平线
        for (let y = startY; y <= endY; y += gridSize) {
            const screenY = y * this.scale + this.offsetY;
            this.ctx.beginPath();
            this.ctx.moveTo(0, screenY);
            this.ctx.lineTo(this.canvas.width, screenY);
            this.ctx.stroke();
        }
        
        this.ctx.restore();
    }

    drawImage(imageInfo) {
        this.ctx.save();

        const x = imageInfo.x * this.scale + this.offsetX;
        const y = imageInfo.y * this.scale + this.offsetY;
        const width = imageInfo.width * this.scale;
        const height = imageInfo.height * this.scale;

        // 设置半透明
        this.ctx.globalAlpha = 0.9;

        // 绘制图片
        this.ctx.drawImage(imageInfo.image, 
            x - width/2, y - height/2, width, height);

        // 恢复不透明
        this.ctx.globalAlpha = 1;

        // 绘制边框
        this.ctx.strokeStyle = imageInfo.selected ? '#ff4444' : '#333';
        this.ctx.lineWidth = imageInfo.selected ? 3 : 1;
        this.ctx.strokeRect(x - width/2, y - height/2, width, height);

        // 绘制文件名
        this.ctx.fillStyle = '#333';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(imageInfo.originalData.name, x, y + height/2 + 15);

        this.ctx.restore();
    }

    drawSelection(imageInfo) {
        this.ctx.save();
        
        const x = imageInfo.x * this.scale + this.offsetX;
        const y = imageInfo.y * this.scale + this.offsetY;
        const width = imageInfo.width * this.scale;
        const height = imageInfo.height * this.scale;
        
        // 绘制高亮边框
        this.ctx.strokeStyle = '#ff4444';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([10, 5]);
        this.ctx.strokeRect(x - width/2 - 5, y - height/2 - 5, width + 10, height + 10);
        
        this.ctx.restore();
    }

    // 鼠标事件处理
    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.lastMouseX = e.clientX - rect.left;
        this.lastMouseY = e.clientY - rect.top;
        this.isDragging = true;
    }

    onMouseMove(e) {
        if (!this.isDragging) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const deltaX = mouseX - this.lastMouseX;
        const deltaY = mouseY - this.lastMouseY;
        
        this.offsetX += deltaX;
        this.offsetY += deltaY;
        
        this.lastMouseX = mouseX;
        this.lastMouseY = mouseY;
        
        this.redraw();
    }

    onMouseUp(e) {
        this.isDragging = false;
    }

    onWheel(e) {
        e.preventDefault();
        const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
        this.scale *= scaleFactor;
        console.log('scale:', this.scale);
        this.redraw();
    }

    onClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // 转换为世界坐标
        const worldX = (mouseX - this.offsetX) / this.scale;
        const worldY = (mouseY - this.offsetY) / this.scale;
        
        // 查找点击的图片
        let clickedImage = null;
        for (const imageInfo of this.imageData) {
            const halfWidth = imageInfo.width / 2;
            const halfHeight = imageInfo.height / 2;
            
            if (worldX >= imageInfo.x - halfWidth && worldX <= imageInfo.x + halfWidth &&
                worldY >= imageInfo.y - halfHeight && worldY <= imageInfo.y + halfHeight) {
                clickedImage = imageInfo;
                break;
            }
        }
        
        // 更新选择状态
        this.imageData.forEach(img => img.selected = false);
        if (clickedImage) {
            clickedImage.selected = true;
            this.selectedImage = clickedImage;
            this.showImageActions(clickedImage);
        } else {
            this.selectedImage = null;
            this.hideImageActions();
        }
        
        this.redraw();
    }

    showImageActions(imageInfo) {
        // 创建操作面板
        this.hideImageActions(); // 先移除之前的面板
        
        const panel = document.createElement('div');
        panel.id = 'imageActionPanel';
        panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border: 1px solid #ccc;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            min-width: 200px;
        `;
        
        panel.innerHTML = `
            <h4 style="margin: 0 0 15px 0;">${imageInfo.originalData.name}</h4>
            <p style="margin: 0 0 15px 0; font-size: 12px; color: #666;">
                经度: ${imageInfo.lon.toFixed(6)}<br>
                纬度: ${imageInfo.lat.toFixed(6)}<br>
                高度: ${imageInfo.alt}m<br>
                焦距: ${imageInfo.focalLength}mm
            </p>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button id="cropImageBtn" class="btn btn-sm btn-primary">矩形裁切</button>
                <button id="freeCropBtn" class="btn btn-sm btn-primary">自由裁切</button>
                <button id="deleteImageBtn" class="btn btn-sm btn-danger">删除</button>
                <button id="closeActionBtn" class="btn btn-sm btn-secondary">关闭</button>
            </div>
        `;
        
        document.body.appendChild(panel);
        
        // 绑定事件
        document.getElementById('cropImageBtn').onclick = () => this.startCrop(imageInfo, 'rect');
        document.getElementById('freeCropBtn').onclick = () => this.startCrop(imageInfo, 'free');
        document.getElementById('deleteImageBtn').onclick = () => this.deleteImage(imageInfo);
        document.getElementById('closeActionBtn').onclick = () => this.hideImageActions();
    }

    hideImageActions() {
        const panel = document.getElementById('imageActionPanel');
        if (panel) {
            panel.remove();
        }
    }

    startCrop(imageInfo, type) {
        // TODO: 实现裁切功能
        NotificationManager.show(`${type === 'rect' ? '矩形' : '自由'}裁切功能开发中...`, 'info');
        this.hideImageActions();
    }

    deleteImage(imageInfo) {
        if (confirm(`确定要删除图片 ${imageInfo.originalData.name} 吗？`)) {
            // 从拼图视角移除
            const index = this.imageData.indexOf(imageInfo);
            if (index > -1) {
                this.imageData.splice(index, 1);
            }
            
            // 从imageManager移除
            const imgIndex = window.imageManager.currentImages.indexOf(imageInfo.originalData);
            if (imgIndex > -1) {
                window.imageManager.currentImages.splice(imgIndex, 1);
            }
            
            this.selectedImage = null;
            this.hideImageActions();
            this.redraw();
            
            // 更新主视图
            window.imageManager.renderImageGallery();
            
            NotificationManager.show('图片已删除', 'success');
        }
    }
}

// 创建全局实例
window.puzzleView = new PuzzleView();
