// 标注编辑器JavaScript
class LabelEditor {
    constructor(options = {}) {
        this.canvas = null;
        this.ctx = null;
        this.image = null;
        this.fileName = '';
        this.currentTool = 'select';
        this.selectedObjectIndex = -1;
        this.objects = []; // {type: 'large-sheep'|'small-sheep'|'large-cattle'|'small-cattle', points: [[x,y,x,y,x,y,x,y]], center: [x,y]}
        this.scale = 1;
        this.offset = {x: 0, y: 0};
        this.isDragging = false;
        this.dragStart = {x: 0, y: 0};
        this.imageRect = {x: 0, y: 0, width: 0, height: 0};
        this.undoStack = []; // 撤销栈
        this.maxUndoSteps = 50; // 最大撤销步数
        this.config = null; // 配置文件
        this.animalColors = {
            'large-sheep': '#007bff',
            'small-sheep': '#17a2b8', 
            'large-cattle': '#dc3545',
            'small-cattle': '#fd7e14'
        }; // 默认颜色配置
        this.newlyAddedObjects = new Set(); // 记录新添加的目标
        this.objectPopup = null; // 弹出操作框
        
        // 嵌入模式相关参数
        this.isEmbedded = options.embedded || false;
        this.isReadOnly = options.readOnly !== false; // 默认只读
        this.confidenceThreshold = options.confidenceThreshold || 0.5;
        this.onSave = options.onSave || null;
        this.onCancel = options.onCancel || null;
        
        this.init();
    }

    async init() {
        this.canvas = document.getElementById('editorCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.image = document.getElementById('editorImage');
        
        // 加载配置文件
        await this.loadConfig();
        
        this.setupEventListeners();
        
        if (this.isEmbedded) {
            // 嵌入模式下不需要从URL加载
            this.createObjectPopup();
        } else {
            this.loadImageFromURL();
            this.createObjectPopup();
        }
    }

    async loadConfig() {
        try {
            const response = await fetch('/api/config');
            if (response.ok) {
                this.config = await response.json();
                // 如果配置文件中有颜色设置，则使用配置文件的颜色
                if (this.config.labelEditor && this.config.labelEditor.animalColors) {
                    this.animalColors = { ...this.animalColors, ...this.config.labelEditor.animalColors };
                }
            }
        } catch (error) {
            console.warn('加载配置文件失败，使用默认颜色:', error);
        }
    }

    setupEventListeners() {
        // 工具栏事件 - 只处理有data-tool属性的按钮
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTool = btn.dataset.tool;
                const currentToolElement = document.getElementById('currentTool');
                if (currentToolElement) {
                    currentToolElement.textContent = btn.textContent.trim();
                }
                this.updateCanvasCursor();
            });
        });

        // 画布事件
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.onWheel.bind(this));

        // 图片加载事件
        this.image.addEventListener('load', this.onImageLoad.bind(this));

        // 按钮事件 - 添加null检查
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', this.save.bind(this));
        }
        
        const backBtn = document.getElementById('backBtn');
        if (backBtn) {
            backBtn.addEventListener('click', this.goBack.bind(this));
        }
        
        const clearAllBtn = document.getElementById('clearAllBtn');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', this.clearAll.bind(this));
        }
        
        const undoBtn = document.getElementById('undoBtn');
        if (undoBtn) {
            undoBtn.addEventListener('click', this.undo.bind(this));
        }
        
        const resetZoomBtn = document.getElementById('resetZoomBtn');
        if (resetZoomBtn) {
            resetZoomBtn.addEventListener('click', this.resetZoom.bind(this));
        }

        // 键盘事件
        document.addEventListener('keydown', this.onKeyDown.bind(this));

        // 点击其他地方隐藏弹窗
        document.addEventListener('click', (e) => {
            if (this.objectPopup && !this.objectPopup.contains(e.target) && !e.target.closest('canvas')) {
                this.hideObjectPopup();
            }
        });
    }

    createObjectPopup() {
        this.objectPopup = document.createElement('div');
        this.objectPopup.className = 'object-popup';
        this.objectPopup.innerHTML = `
            <div class="popup-header">目标设置</div>
            <div class="popup-buttons">
                <button class="popup-type-btn" data-type="large-sheep">大羊</button>
                <button class="popup-type-btn" data-type="small-sheep">小羊</button>
                <button class="popup-type-btn" data-type="large-cattle">大牛</button>
                <button class="popup-type-btn" data-type="small-cattle">小牛</button>
            </div>
            <button class="popup-delete-btn">
                <i class="fas fa-trash"></i> 删除目标
            </button>
        `;
        
        // 添加事件监听
        this.objectPopup.querySelectorAll('.popup-type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.selectedObjectIndex >= 0) {
                    const btnType = btn.dataset.type;
                    
                    // 小羊和小牛按钮执行智能选择功能
                    if (btnType === 'small-sheep' || btnType === 'small-cattle') {
                        this.hideObjectPopup(); // 隐藏弹窗
                        this.intelligentSelectBySize(btnType);
                    } else {
                        // 大羊和大牛按钮保持原有功能
                        this.saveState();
                        this.objects[this.selectedObjectIndex].type = btnType;
                        this.updateStats();
                        this.redraw();
                        this.updatePopupButtons();
                        
                        const typeNames = {
                            'large-sheep': '大羊',
                            'large-cattle': '大牛'
                        };
                        this.showToast(`已设为${typeNames[btnType]}`, 'success');
                    }
                }
            });
        });

        this.objectPopup.querySelector('.popup-delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.selectedObjectIndex >= 0) {
                this.saveState();
                this.objects.splice(this.selectedObjectIndex, 1);
                this.selectedObjectIndex = -1;
                this.hideObjectPopup();
                this.updateStats();
                this.redraw();
                this.showToast('已删除目标', 'success');
            }
        });

        document.body.appendChild(this.objectPopup);
    }

    showObjectPopup(x, y) {
        if (this.selectedObjectIndex < 0) return;
        
        this.objectPopup.style.display = 'block';
        this.objectPopup.style.left = x + 'px';
        this.objectPopup.style.top = y + 'px';
        
        // 更新按钮状态
        this.updatePopupButtons();
        
        // 确保弹窗在屏幕范围内
        const rect = this.objectPopup.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        if (rect.right > windowWidth) {
            this.objectPopup.style.left = (windowWidth - rect.width - 10) + 'px';
        }
        if (rect.bottom > windowHeight) {
            this.objectPopup.style.top = (windowHeight - rect.height - 10) + 'px';
        }
    }

    hideObjectPopup() {
        if (this.objectPopup) {
            this.objectPopup.style.display = 'none';
        }
    }

    updatePopupButtons() {
        if (this.selectedObjectIndex < 0) return;
        
        const selectedObject = this.objects[this.selectedObjectIndex];
        this.objectPopup.querySelectorAll('.popup-type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === selectedObject.type);
        });
    }

    loadImageFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        this.fileName = urlParams.get('fileName');
        
        if (!this.fileName) {
            alert('缺少文件名参数');
            this.goBack();
            return;
        }

        // 设置页面标题显示文件名
        document.title = `标注编辑器 - ${this.fileName}`;
        
        // 加载原图
        const imagePath = `/MediaGallery/temp_folder/original/${this.fileName}`;
        this.image.src = imagePath;
        
        // 加载标注数据
        this.loadLabels();
    }

    async loadLabels() {
        try {
            const response = await fetch(`/api/count/label?fileName=${encodeURIComponent(this.fileName)}`);
            if (response.ok) {
                const labelText = await response.text();
                this.parseLabels(labelText);
            } else if (response.status === 404) {
                // 标注文件不存在，创建空的标注
                this.objects = [];
                this.updateStats();
            }
        } catch (error) {
            console.error('加载标注失败:', error);
            this.setStatus('加载标注失败');
        }
    }

    parseLabels(labelText) {
        this.objects = [];
        if (!labelText.trim()) return;

        const lines = labelText.trim().split('\n');
        lines.forEach((line, index) => {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 9) {
                const classId = parseInt(parts[0]);
                const points = [];
                for (let i = 1; i <= 8; i += 2) {
                    points.push([parseFloat(parts[i]), parseFloat(parts[i + 1])]);
                }
                let type = 'large-sheep';
                if (classId === 0) type = 'large-sheep';
                else if (classId === 1) type = 'small-sheep';
                else if (classId === 2) type = 'large-cattle';
                else if (classId === 3) type = 'small-cattle';
                const centerX = points.reduce((sum, p) => sum + p[0], 0) / 4;
                const centerY = points.reduce((sum, p) => sum + p[1], 0) / 4;
                // 读取置信度（第10列），没有则为1
                let conf = 1;
                if (parts.length >= 10) {
                    const c = parseFloat(parts[9]);
                    if (!isNaN(c)) conf = c;
                }
                this.objects.push({
                    type: type,
                    points: points,
                    center: [centerX, centerY],
                    conf: conf
                });
            }
        });

        this.updateStats();
        this.redraw();
    }

    onImageLoad() {
        this.resizeCanvas();
        this.redraw();
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        
        // 计算图片在容器中的实际位置和大小
        const imgAspect = this.image.naturalWidth / this.image.naturalHeight;
        const containerAspect = rect.width / rect.height;
        
        if (imgAspect > containerAspect) {
            // 图片更宽，以宽度为准
            this.imageRect.width = rect.width;
            this.imageRect.height = rect.width / imgAspect;
            this.imageRect.x = 0;
            this.imageRect.y = (rect.height - this.imageRect.height) / 2;
        } else {
            // 图片更高，以高度为准
            this.imageRect.height = rect.height;
            this.imageRect.width = rect.height * imgAspect;
            this.imageRect.x = (rect.width - this.imageRect.width) / 2;
            this.imageRect.y = 0;
        }
        
        this.redraw();
    }

    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // 转换为图片坐标
        const imgCoords = this.canvasToImageCoords(x, y);
        
        switch (this.currentTool) {
            case 'select':
                // 如果点击在图片区域内，尝试选中目标
                if (imgCoords) {
                    let foundObject = false;
                    this.objects.forEach((obj, index) => {
                        if (this.isPointInPolygon(imgCoords.x, imgCoords.y, obj.points)) {
                            this.selectedObjectIndex = index;
                            foundObject = true;
                        }
                    });
                    
                    if (foundObject) {
                        this.redraw();
                        // 显示弹出操作框
                        this.showObjectPopup(e.clientX + 10, e.clientY + 10);
                        return; // 选中目标后不开始拖动
                    } else {
                        // 没有选中目标，隐藏弹窗
                        this.selectedObjectIndex = -1;
                        this.hideObjectPopup();
                        this.redraw();
                    }
                }
                
                // 无论点击在哪里（包括黑色区域），都可以开始拖动
                this.isDragging = true;
                this.dragStart = {x: x, y: y};
                this.canvas.style.cursor = 'grabbing';
                break;
            case 'add':
                if (imgCoords) {
                    this.addPoint(imgCoords.x, imgCoords.y);
                }
                break;
            case 'delete':
                // 如果点击在图片区域内，尝试删除目标
                if (imgCoords) {
                    let foundObject = false;
                    this.objects.forEach((obj, index) => {
                        if (this.isPointInPolygon(imgCoords.x, imgCoords.y, obj.points)) {
                            foundObject = true;
                        }
                    });
                    
                    if (foundObject) {
                        this.deleteObject(imgCoords.x, imgCoords.y);
                        return; // 删除目标后不开始拖动
                    }
                }
                
                // 如果没有点击到目标，则开始拖动
                this.isDragging = true;
                this.dragStart = {x: x, y: y};
                this.canvas.style.cursor = 'grabbing';
                break;
        }
    }

    onMouseMove(e) {
        if (this.isDragging && (this.currentTool === 'select' || this.currentTool === 'delete')) {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const deltaX = x - this.dragStart.x;
            const deltaY = y - this.dragStart.y;
            
            this.offset.x += deltaX;
            this.offset.y += deltaY;
            
            this.dragStart = {x: x, y: y};
            this.redraw();
        }
    }

    onMouseUp(e) {
        if (this.isDragging) {
            this.isDragging = false;
            this.updateCanvasCursor();
        }
    }

    onWheel(e) {
        e.preventDefault();
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(1.0, Math.min(5, this.scale * delta)); // 最小缩放100%
        
        if (newScale !== this.scale) {
            // 获取当前图片显示区域
            const containerRect = this.canvas.parentElement.getBoundingClientRect();
            const imgAspect = this.image.naturalWidth / this.image.naturalHeight;
            const containerAspect = containerRect.width / containerRect.height;
            
            let displayWidth, displayHeight, displayX, displayY;
            if (imgAspect > containerAspect) {
                displayWidth = containerRect.width;
                displayHeight = containerRect.width / imgAspect;
                displayX = 0;
                displayY = (containerRect.height - displayHeight) / 2;
            } else {
                displayHeight = containerRect.height;
                displayWidth = containerRect.height * imgAspect;
                displayX = (containerRect.width - displayWidth) / 2;
                displayY = 0;
            }
            
            // 计算当前图片实际位置（考虑变换）
            const centerX = displayX + displayWidth / 2;
            const centerY = displayY + displayHeight / 2;
            const currentImgX = centerX + (displayX - centerX) * this.scale + this.offset.x;
            const currentImgY = centerY + (displayY - centerY) * this.scale + this.offset.y;
            const currentImgWidth = displayWidth * this.scale;
            const currentImgHeight = displayHeight * this.scale;
            
            // 计算鼠标在当前图片上的相对位置（0-1范围）
            const relativeMouseX = (mouseX - currentImgX) / currentImgWidth;
            const relativeMouseY = (mouseY - currentImgY) / currentImgHeight;
            
            // 更新缩放比例
            this.scale = newScale;
            
            // 计算新的图片尺寸
            const newImgWidth = displayWidth * this.scale;
            const newImgHeight = displayHeight * this.scale;
            
            // 计算新的图片位置，保持鼠标在图片上的相对位置不变
            const newImgX = mouseX - relativeMouseX * newImgWidth;
            const newImgY = mouseY - relativeMouseY * newImgHeight;
            
            // 根据变换公式反推新的offset
            const newCenterX = displayX + displayWidth / 2;
            const newCenterY = displayY + displayHeight / 2;
            const expectedX = newCenterX + (displayX - newCenterX) * this.scale;
            const expectedY = newCenterY + (displayY - newCenterY) * this.scale;
            
            this.offset.x = newImgX - expectedX;
            this.offset.y = newImgY - expectedY;
            
            // 更新缩放显示
            const zoomLevelElement = document.getElementById('zoomLevel');
            if (zoomLevelElement) {
                zoomLevelElement.textContent = Math.round(this.scale * 100) + '%';
            }
            
            this.redraw();
        }
    }

    onKeyDown(e) {
        // Ctrl+Z 撤销
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            this.undo();
            return;
        }
        
        switch (e.key) {
            case 'Delete':
                if (this.selectedObjectIndex >= 0) {
                    this.saveState();
                    this.objects.splice(this.selectedObjectIndex, 1);
                    this.selectedObjectIndex = -1;
                    this.hideObjectPopup();
                    this.updateStats();
                    this.redraw();
                }
                break;
            case 'Escape':
                this.selectedObjectIndex = -1;
                this.hideObjectPopup();
                this.redraw();
                break;
        }
    }

    canvasToImageCoords(canvasX, canvasY) {
        // 检查点击是否在图片区域内
        if (canvasX < this.imageRect.x || canvasX > this.imageRect.x + this.imageRect.width ||
            canvasY < this.imageRect.y || canvasY > this.imageRect.y + this.imageRect.height) {
            return null;
        }
        
        // 转换为图片的归一化坐标
        const relativeX = (canvasX - this.imageRect.x) / this.imageRect.width;
        const relativeY = (canvasY - this.imageRect.y) / this.imageRect.height;
        
        return {
            x: relativeX,
            y: relativeY
        };
    }

    imageToCanvasCoords(imageX, imageY) {
        const canvasX = this.imageRect.x + imageX * this.imageRect.width;
        const canvasY = this.imageRect.y + imageY * this.imageRect.height;
        return {x: canvasX, y: canvasY};
    }

    addPoint(x, y) {
        this.saveState();

        const selectedType = document.getElementById('addTypeSelector').value;
        const size = 0.005;
        const points = [
            [x - size, y - size],
            [x + size, y - size],
            [x + size, y + size],
            [x - size, y + size]
        ];

        const newObject = {
            type: selectedType,
            points: points,
            center: [x, y],
            conf: 1 // 手动标注置信度为1
        };

        this.objects.push(newObject);
        const newIndex = this.objects.length - 1;
        this.newlyAddedObjects.add(newIndex);
        this.selectedObjectIndex = newIndex;
        this.updateStats();
        this.redraw();

        const typeNames = {
            'large-sheep': '大羊',
            'small-sheep': '小羊',
            'large-cattle': '大牛',
            'small-cattle': '小牛'
        };
        this.showToast(`添加了新的${typeNames[selectedType]}`);
    }

    deleteObject(x, y) {
        for (let i = this.objects.length - 1; i >= 0; i--) {
            if (this.isPointInPolygon(x, y, this.objects[i].points)) {
                this.saveState();
                this.objects.splice(i, 1);
                if (this.selectedObjectIndex === i) {
                    this.selectedObjectIndex = -1;
                } else if (this.selectedObjectIndex > i) {
                    this.selectedObjectIndex--;
                }
                this.updateStats();
                this.redraw();
                this.setStatus('删除了目标');
                break;
            }
        }
    }

    saveState() {
        // 保存当前状态到撤销栈
        const state = {
            objects: JSON.parse(JSON.stringify(this.objects)),
            selectedObjectIndex: this.selectedObjectIndex
        };
        
        this.undoStack.push(state);
        
        // 限制撤销栈大小
        if (this.undoStack.length > this.maxUndoSteps) {
            this.undoStack.shift();
        }
    }

    undo() {
        if (this.undoStack.length === 0) {
            this.setStatus('没有可撤销的操作');
            return;
        }
        
        const state = this.undoStack.pop();
        this.objects = state.objects;
        this.selectedObjectIndex = state.selectedObjectIndex;
        
        this.updateStats();
        this.redraw();
        this.setStatus('已撤销');
    }

    isPointInPolygon(x, y, points) {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            if ((points[i][1] > y) !== (points[j][1] > y) &&
                (x < (points[j][0] - points[i][0]) * (y - points[i][1]) / (points[j][1] - points[i][1]) + points[i][0])) {
                inside = !inside;
            }
        }
        return inside;
    }

    updateCanvasCursor() {
        switch (this.currentTool) {
            case 'select':
                this.canvas.style.cursor = 'pointer';
                break;
            case 'add':
                this.canvas.style.cursor = 'crosshair';
                break;
            case 'delete':
                this.canvas.style.cursor = 'not-allowed';
                break;
        }
    }

    redraw() {
        if (!this.ctx || !this.image.complete) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 获取HTML图片元素的实际渲染位置和大小
        const imgElement = this.image;
        const containerRect = imgElement.parentElement.getBoundingClientRect();
        
        // 由于图片使用了object-fit: contain，需要计算实际的显示区域
        const imgAspect = imgElement.naturalWidth / imgElement.naturalHeight;
        const containerAspect = containerRect.width / containerRect.height;
        
        let displayWidth, displayHeight, displayX, displayY;
        if (imgAspect > containerAspect) {
            // 图片更宽，以容器宽度为准
            displayWidth = containerRect.width;
            displayHeight = containerRect.width / imgAspect;
            displayX = 0;
            displayY = (containerRect.height - displayHeight) / 2;
        } else {
            // 图片更高，以容器高度为准
            displayHeight = containerRect.height;
            displayWidth = containerRect.height * imgAspect;
            displayX = (containerRect.width - displayWidth) / 2;
            displayY = 0;
        }
        
        // 应用HTML图片变换
        this.image.style.transform = `translate(${this.offset.x}px, ${this.offset.y}px) scale(${this.scale})`;
        this.image.style.transformOrigin = `${displayX + displayWidth/2}px ${displayY + displayHeight/2}px`;

        // Canvas坐标计算：匹配HTML图片的实际变换效果
        // 变换原点是图片显示区域的中心
        const centerX = displayX + displayWidth / 2;
        const centerY = displayY + displayHeight / 2;
        
        // 应用变换：先平移到原点，再缩放，再平移回去，最后应用offset
        this.imageRect.x = centerX + (displayX - centerX) * this.scale + this.offset.x;
        this.imageRect.y = centerY + (displayY - centerY) * this.scale + this.offset.y;
        this.imageRect.width = displayWidth * this.scale;
        this.imageRect.height = displayHeight * this.scale;
        
        // 绘制所有目标
        this.objects.forEach((obj, index) => {
            this.drawObject(obj, index === this.selectedObjectIndex, index);
        });
    }

    drawObject(obj, isSelected, index) {
        if (obj.points.length < 4) return;
        
        // 置信度过滤：只显示大于等于阈值的目标
        if (obj.conf < this.confidenceThreshold) {
            return;
        }
        
        // 使用配置文件中的颜色
        const color = this.animalColors[obj.type] || '#007bff';
        
        // 检查是否是新添加的点
        const isNewPoint = this.newlyAddedObjects.has(index);
        
        if (isNewPoint) {
            // 只绘制一个大圆点
            const center = this.imageToCanvasCoords(obj.center[0], obj.center[1]);
            this.ctx.beginPath();
            this.ctx.arc(center.x, center.y, isSelected ? 12 : 8, 0, 2 * Math.PI);
            this.ctx.fillStyle = color;
            this.ctx.fill();
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        } else {
            // 绘制完整的多边形
            this.ctx.beginPath();
            const firstPoint = this.imageToCanvasCoords(obj.points[0][0], obj.points[0][1]);
            this.ctx.moveTo(firstPoint.x, firstPoint.y);
            
            for (let i = 1; i < obj.points.length; i++) {
                const point = this.imageToCanvasCoords(obj.points[i][0], obj.points[i][1]);
                this.ctx.lineTo(point.x, point.y);
            }
            this.ctx.closePath();
            
            // 填充
            this.ctx.fillStyle = color + (isSelected ? '40' : '20');
            this.ctx.fill();
            
            // 边框
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = isSelected ? 3 : 2;
            this.ctx.stroke();
            
            // 绘制中心点
            const center = this.imageToCanvasCoords(obj.center[0], obj.center[1]);
            this.ctx.beginPath();
            this.ctx.arc(center.x, center.y, isSelected ? 6 : 4, 0, 2 * Math.PI);
            this.ctx.fillStyle = color;
            this.ctx.fill();
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
        }
    }

    updateStats() {
        const stats = {
            'large-sheep': 0,
            'small-sheep': 0,
            'large-cattle': 0,
            'small-cattle': 0
        };
        
        this.objects.forEach(obj => {
            stats[obj.type]++;
        });
        
        // 添加null检查，只在元素存在时更新
        const largeSheepCount = document.getElementById('largeSheepCount');
        if (largeSheepCount) {
            largeSheepCount.textContent = stats['large-sheep'];
        }
        
        const smallSheepCount = document.getElementById('smallSheepCount');
        if (smallSheepCount) {
            smallSheepCount.textContent = stats['small-sheep'];
        }
        
        const largeCattleCount = document.getElementById('largeCattleCount');
        if (largeCattleCount) {
            largeCattleCount.textContent = stats['large-cattle'];
        }
        
        const smallCattleCount = document.getElementById('smallCattleCount');
        if (smallCattleCount) {
            smallCattleCount.textContent = stats['small-cattle'];
        }
        
        const totalCount = document.getElementById('totalCount');
        if (totalCount) {
            totalCount.textContent = this.objects.length;
        }
    }

    async save() {
        try {
            this.setStatus('保存中...');

            // 转换为YOLO格式，带置信度
            const lines = this.objects.map(obj => {
                const classMap = {
                    'large-sheep': 0,
                    'small-sheep': 1,
                    'large-cattle': 2,
                    'small-cattle': 3
                };
                const classId = classMap[obj.type] || 0;
                const coords = obj.points.flat().map(coord => coord.toFixed(6));
                // 保存置信度，若无则补1
                const conf = (typeof obj.conf === 'number' && !isNaN(obj.conf)) ? obj.conf : 1;
                return `${classId} ${coords.join(' ')} ${conf}`;
            });

            const labelContent = lines.join('\n');

            // 1. 保存标注文件
            const response = await fetch(`/api/count/label?fileName=${encodeURIComponent(this.fileName)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain'
                },
                body: labelContent
            });

            if (response.ok) {
                this.setStatus('标注保存成功，正在生成结果图...');

                // 2. 生成结果图
                try {
                    const generateResponse = await fetch('/api/count/generate-result-image', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            fileName: this.fileName
                        })
                    });

                    if (generateResponse.ok) {
                        this.setStatus('保存并生成结果图成功，正在返回...');
                    } else {
                        const errorData = await generateResponse.json();
                        console.warn('生成结果图失败:', errorData);
                        this.setStatus('标注保存成功，但生成结果图失败，正在返回...');
                    }
                } catch (generateError) {
                    console.warn('生成结果图失败:', generateError);
                    this.setStatus('标注保存成功，但生成结果图失败，正在返回...');
                }

                setTimeout(() => {
                    this.goBack();
                }, 2000);
            } else {
                throw new Error('保存失败');
            }
        } catch (error) {
            console.error('保存失败:', error);
            this.setStatus('保存失败');
            alert('保存失败: ' + error.message);
        }
    }

    goBack() {
        const urlParams = new URLSearchParams(window.location.search);
        const farmerId = urlParams.get('farmerId');
        let backUrl = 'count.html';
        if (farmerId) {
            backUrl += `?farmerId=${encodeURIComponent(farmerId)}`;
        }
        window.location.href = backUrl;
    }

    clearAll() {
        if (confirm('确定要清空所有标注吗？此操作不可撤销。')) {
            this.objects = [];
            this.selectedObjectIndex = -1;
            this.hideObjectPopup();
            this.updateStats();
            this.redraw();
            this.setStatus('已清空所有标注');
        }
    }

    resetZoom() {
        // 重置缩放和偏移
        this.scale = 1;
        this.offset = {x: 0, y: 0};
        
        // 更新缩放显示
        const zoomLevelElement = document.getElementById('zoomLevel');
        if (zoomLevelElement) {
            zoomLevelElement.textContent = '100%';
        }
        
        // 重新绘制
        this.redraw();
        
        this.setStatus('已重置缩放');
    }

    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toastContainer');
        
        const toast = document.createElement('div');
        
        // 更柔和的颜色配置
        const colors = {
            success: 'rgba(40, 167, 69, 0.85)',
            error: 'rgba(220, 53, 69, 0.85)',
            info: 'rgba(52, 144, 220, 0.85)',
            warning: 'rgba(255, 193, 7, 0.85)'
        };
        
        toast.style.cssText = `
            background: ${colors[type] || colors.info};
            color: white;
            padding: 8px 16px;
            margin-bottom: 6px;
            border-radius: 6px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.15);
            animation: slideInRight 0.3s ease-out;
            font-size: 14px;
            font-weight: 500;
            max-width: 280px;
            text-align: center;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
        `;
        toast.textContent = message;
        
        // 添加CSS动画
        if (!document.getElementById('toastAnimations')) {
            const style = document.createElement('style');
            style.id = 'toastAnimations';
            style.textContent = `
                @keyframes slideInRight {
                    from { 
                        transform: translateX(100%) translateY(-10px); 
                        opacity: 0; 
                        scale: 0.9;
                    }
                    to { 
                        transform: translateX(0) translateY(0); 
                        opacity: 1; 
                        scale: 1;
                    }
                }
                @keyframes slideOutRight {
                    from { 
                        transform: translateX(0) translateY(0); 
                        opacity: 1; 
                        scale: 1;
                    }
                    to { 
                        transform: translateX(100%) translateY(-10px); 
                        opacity: 0; 
                        scale: 0.9;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        toastContainer.appendChild(toast);
        
        // 2.5秒后自动消失
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 2500);
    }

    setStatus(message) {
        this.showToast(message);
    }

    // 计算多边形面积（基于4个顶点坐标）
    calculatePolygonArea(points) {
        if (points.length < 3) return 0;
        
        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            area += points[i][0] * points[j][1];
            area -= points[j][0] * points[i][1];
        }
        return Math.abs(area) / 2;
    }

    // 智能选择功能：基于大小比较
    intelligentSelectBySize(targetType) {
        // 检查是否有选中的基准框
        if (this.selectedObjectIndex < 0 || this.selectedObjectIndex >= this.objects.length) {
            this.showToast('请先选择一个基准目标框', 'warning');
            return;
        }

        const baseObject = this.objects[this.selectedObjectIndex];
        const baseArea = this.calculatePolygonArea(baseObject.points);
        
        // 查找比基准框更小的目标（包括基准框本身）
        const smallerObjects = [];
        this.objects.forEach((obj, index) => {
            const objArea = this.calculatePolygonArea(obj.points);
            if (objArea <= baseArea) { // 包括等于基准框大小的目标
                smallerObjects.push({
                    index: index,
                    area: objArea,
                    object: obj
                });
            }
        });

        if (smallerObjects.length === 0) {
            this.showToast('未找到需要转换的目标', 'warning');
            return;
        }

        // 显示预览信息
        const typeNames = {
            'small-sheep': '小羊',
            'small-cattle': '小牛'
        };
        
        // 确认操作
        const confirmMessage = `确定要将 ${smallerObjects.length} 个目标转换为${typeNames[targetType]}吗？\n\n基准框面积: ${baseArea.toFixed(6)}\n将转换的目标数量: ${smallerObjects.length}`;
        
        if (confirm(confirmMessage)) {
            // 保存状态用于撤销
            this.saveState();
            
            // 执行批量转换
            let convertedCount = 0;
            smallerObjects.forEach(item => {
                this.objects[item.index].type = targetType;
                convertedCount++;
            });
            
            // 更新界面
            this.updateStats();
            this.redraw();
            this.updatePopupButtons(); // 更新弹窗按钮状态
            
            // 显示成功消息
            const successMessage = `已成功将 ${convertedCount} 个目标转换为${typeNames[targetType]}`;
            this.showToast(successMessage, 'success');
        }
    }

    // 嵌入模式专用方法
    loadImageAndLabels(fileName, imageUrl) {
        this.fileName = fileName;
        this.image.src = imageUrl;
        this.loadLabels();
    }

    setConfidenceThreshold(threshold) {
        this.confidenceThreshold = threshold;
        this.redraw();
    }

    setReadOnlyMode(readOnly) {
        this.isReadOnly = readOnly;
        
        // 更新鼠标事件处理
        if (readOnly) {
            this.currentTool = 'select';
            this.canvas.style.cursor = 'default';
        } else {
            this.updateCanvasCursor();
        }
    }

    enterEditMode() {
        this.setReadOnlyMode(false);
        const toolBar = document.getElementById('labelToolBar');
        if (toolBar) {
            toolBar.style.display = 'flex';
        }
    }

    exitEditMode() {
        this.setReadOnlyMode(true);
        this.selectedObjectIndex = -1;
        this.hideObjectPopup();
        const toolBar = document.getElementById('labelToolBar');
        if (toolBar) {
            toolBar.style.display = 'none';
        }
        this.redraw();
    }

    async saveLabelsEmbedded() {
        if (this.onSave) {
            const result = await this.onSave(this.objects);
            return result;
        }
        return this.save();
    }

    cancelEdit() {
        if (this.onCancel) {
            this.onCancel();
        }
        this.exitEditMode();
    }
}

// 初始化 - 只在非嵌入模式下自动初始化
document.addEventListener('DOMContentLoaded', () => {
    // 检查是否在count.html页面（嵌入模式）
    if (!window.location.pathname.includes('count.html')) {
        new LabelEditor();
    }
    
    // 监听窗口大小变化
    window.addEventListener('resize', () => {
        if (window.labelEditor) {
            window.labelEditor.resizeCanvas();
        }
    });
});
