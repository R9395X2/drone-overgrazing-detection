// 主应用模块
class App {
    constructor() {
        this.elements = {};
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;
        
        console.log('🚀 正在初始化无人机过度放牧检测系统...');
        
        try {
            // 初始化DOM元素引用
            this.initializeElements();
            
            // 加载配置
            await configManager.loadConfiguration();
            
            // 绑定事件监听器
            this.bindEventListeners();
            
            // 设置默认视图
            imageManager.setActiveView('grid');
            
            // 自动加载默认目录的图片
            // 检查是否为detection.html且带有taskId参数，如果是则不自动加载图库
            // 只要 detection.html 页面参数中有 taskId/task_id/farmerId/farmer_id（不区分大小写），就不加载默认图库
            const urlParams = new URLSearchParams(window.location.search);
            const keys = Array.from(urlParams.keys()).map(k => k.toLowerCase());
            const hasSpecialParam = keys.some(k => ['taskid', 'task_id', 'farmerid', 'farmer_id'].includes(k));
            if (!(window.location.pathname.endsWith('detection.html') && hasSpecialParam)) {
                await imageManager.loadDefaultImages();
            }
            
            // 创建设置按钮
            this.createSettingsButton();
            
            this.isInitialized = true;
            console.log('✅ 无人机过度放牧检测系统已初始化');
            
            // detection.html专用初始化
            if (window.location.pathname.endsWith('detection.html')) {
                initializeDetectionPage();
            }
        } catch (error) {
            console.error('❌ 应用初始化失败:', error);
            NotificationManager.show('应用初始化失败', 'error');
        }
    }

    initializeElements() {
        this.elements = {
            selectFolderBtn: document.getElementById('selectFolderBtn'),
            autoDetectBtn: document.getElementById('autoDetectBtn'),
            farmersBtn: document.getElementById('farmersBtn'),
            gridViewBtn: document.getElementById('gridViewBtn'),
            listViewBtn: document.getElementById('listViewBtn'),
            imageGallery: document.getElementById('imageGallery'),
            emptyState: document.getElementById('emptyState'),
            loadingSpinner: document.getElementById('loadingSpinner'),
            imageCount: document.getElementById('imageCount'),
            
            // 排序和分类控件
            sortBy: document.getElementById('sortBy'),
            groupBy: document.getElementById('groupBy'),
            sortOrderBtn: document.getElementById('sortOrderBtn'),
            sortOrderIcon: document.getElementById('sortOrderIcon'),
            
            // 模态框元素
            processModal: document.getElementById('processModal'),
            resultModal: document.getElementById('resultModal'),
            progressModal: document.getElementById('progressModal'),
            
            // 处理模态框元素
            closeModal: document.getElementById('closeModal'),
            previewImage: document.getElementById('previewImage'),
            imageName: document.getElementById('imageName'),
            imageSize: document.getElementById('imageSize'),
            startProcessBtn: document.getElementById('startProcessBtn'),
            cancelProcessBtn: document.getElementById('cancelProcessBtn'),
            
            // 结果模态框元素
            closeResultModal: document.getElementById('closeResultModal'),
            resultContent: document.getElementById('resultContent'),
            
            // 进度模态框元素
            progressFill: document.getElementById('progressFill'),
            progressText: document.getElementById('progressText'),
            
            // 处理选项
            detectOvergrazing: document.getElementById('detectOvergrazing'),
            generateReport: document.getElementById('generateReport'),
            saveResults: document.getElementById('saveResults')
        };

        // 将elements暴露到全局作用域以保持向后兼容
        window.elements = this.elements;
    }

    bindEventListeners() {
        // 头部按钮事件
        this.elements.selectFolderBtn.addEventListener('click', () => folderBrowser.show());
        this.elements.autoDetectBtn.addEventListener('click', () => deviceDetection.autoDetect());
        if (this.elements.farmersBtn) {
            this.elements.farmersBtn.addEventListener('click', () => this.goToFarmersPage());
        }
        
        // 视图切换事件
        this.elements.gridViewBtn.addEventListener('click', () => imageManager.setActiveView('grid'));
        this.elements.listViewBtn.addEventListener('click', () => imageManager.setActiveView('list'));
        
        // 排序和分类控件事件
        if (this.elements.sortBy) {
            this.elements.sortBy.addEventListener('change', (e) => imageManager.handleSortChange(e));
            this.elements.sortBy.value = imageManager.currentSortBy;
        }
        if (this.elements.groupBy) {
            this.elements.groupBy.addEventListener('change', (e) => imageManager.handleGroupChange(e));
            this.elements.groupBy.value = imageManager.currentGroupBy;
        }
        if (this.elements.sortOrderBtn) {
            this.elements.sortOrderBtn.addEventListener('click', () => imageManager.toggleSortOrder());
            imageManager.updateSortOrderIcon();
        }
        
        // 模态框关闭事件
        if (this.elements.closeModal) {
            this.elements.closeModal.addEventListener('click', () => imageManager.closeProcessModal());
        }
        if (this.elements.closeResultModal) {
            this.elements.closeResultModal.addEventListener('click', () => imageManager.closeResultModal());
        }
        
        // 处理按钮事件
        if (this.elements.startProcessBtn) {
            this.elements.startProcessBtn.addEventListener('click', () => imageManager.startImageProcessing());
        }
        if (this.elements.cancelProcessBtn) {
            this.elements.cancelProcessBtn.addEventListener('click', () => imageManager.closeProcessModal());
        }
        
        // 点击模态框外部关闭
        if (this.elements.processModal) {
            this.elements.processModal.addEventListener('click', (e) => {
                if (e.target === this.elements.processModal) {
                    imageManager.closeProcessModal();
                }
            });
        }
        
        if (this.elements.resultModal) {
            this.elements.resultModal.addEventListener('click', (e) => {
                if (e.target === this.elements.resultModal) {
                    imageManager.closeResultModal();
                }
            });
        }
        
        // 键盘事件
        document.addEventListener('keydown', this.handleKeyboardEvents.bind(this));
    }

    handleKeyboardEvents(e) {
        // ESC键关闭模态框
        if (e.key === 'Escape') {
            if (this.elements.processModal && this.elements.processModal.classList.contains('show')) {
                imageManager.closeProcessModal();
            }
            if (this.elements.resultModal && this.elements.resultModal.classList.contains('show')) {
                imageManager.closeResultModal();
            }
            if (window.folderBrowser && window.folderBrowser.modal) {
                folderBrowser.close();
            }
            if (window.currentDialog) {
                DialogManager.close();
            }
            if (window.settingsManager && window.settingsManager.modal) {
                settingsManager.close();
            }
        }
    }

    createSettingsButton() {
        const headerActions = document.querySelector('.header-actions');
        if (headerActions && !document.getElementById('settingsBtn')) {
            const settingsBtn = document.createElement('button');
            settingsBtn.id = 'settingsBtn';
            settingsBtn.className = 'btn btn-secondary';
            settingsBtn.innerHTML = '<i class="fas fa-cog"></i> 设置';
            settingsBtn.addEventListener('click', () => settingsManager.open());
            headerActions.appendChild(settingsBtn);
        }
    }

    // 跳转到农户管理页面
    goToFarmersPage() {
        window.location.href = 'farmers.html';
    }
}

// 创建全局应用实例
window.app = new App();

/**
 * detection.html专用初始化逻辑
 * 1. 解析URL参数获取farmerId
 * 2. 请求农户详情并填充左侧面板
 */
function initializeDetectionPage() {
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
    const farmerId = getParamCaseInsensitive(['farmerId', 'farmer_id']);
    const taskId = getParamCaseInsensitive(['taskId', 'task_id']);
    if (!farmerId) return;

    fetch(`/api/farmers/${farmerId}`)
        .then(res => res.json())
        .then(data => {
            if (!data || !data.farmer) return;
            const farmer = data.farmer;
            document.getElementById('farmerName').textContent = farmer.name || '-';
            document.getElementById('farmerId').textContent = farmer.id || '-';
            document.getElementById('farmerContact').textContent = farmer.phone || '-';
            document.getElementById('farmerIdCard').textContent = farmer.id_card || '-';
        })
        .catch(() => {});

    // 检查是否有taskId/task_id参数，决定新建还是历史盘点逻辑
    if (taskId) {
        // 历史盘点模式，加载盘点详情和图片
        // TODO: 这里应调用后端接口获取盘点详情和图片列表，并渲染到页面
        // fetch(`/api/checks/${taskId}`).then(...);
    } else {
        // 新建盘点模式，初始化空盘点
        // TODO: 这里可以初始化空图片列表等
    }

    // 盘点信息弹窗逻辑
    const editBtn = document.getElementById('editCheckInfoBtn');
    const overlay = document.getElementById('checkInfoOverlay');
    const closeModal = document.getElementById('closeCheckInfoModal');
    const form = document.getElementById('checkInfoForm');
    // 如果是带farmerId参数的页面，隐藏编辑盘点信息按钮
    if (editBtn) {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('farmerId') || urlParams.has('farmer_id')) {
            editBtn.style.display = 'none';
        }
    }
    if (editBtn && overlay && closeModal && form) {
        editBtn.onclick = () => { overlay.classList.add('show'); };
        closeModal.onclick = () => { overlay.classList.remove('show'); };
        overlay.onclick = (e) => { if (e.target === overlay) overlay.classList.remove('show'); };
        form.onsubmit = (e) => {
            e.preventDefault();
            // 可在此处收集盘点信息并保存
            overlay.classList.remove('show');
        };
    }

    // 设置标题
    document.title = taskId ? '盘点详情' : '新建盘点-文件导入';
    const h1 = document.querySelector('.header h1');
    if (h1) h1.textContent = taskId ? '盘点详情' : '新建盘点-文件导入';
}

// 应用初始化
document.addEventListener('DOMContentLoaded', function() {
    window.app.initialize();
});

// 保持向后兼容的全局函数
window.initializeApp = () => window.app.initialize();
window.bindEventListeners = () => window.app.bindEventListeners();
window.handleKeyboardEvents = (e) => window.app.handleKeyboardEvents(e);
window.createSettingsButton = () => window.app.createSettingsButton();
