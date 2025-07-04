// 农户管理器
class FarmersManager {
    constructor() {
        this.farmers = [];
        this.filteredFarmers = [];
        this.currentFarmer = null;
        this.searchTimeout = null;
        this.isLoading = false;
        
        // DOM 元素
        this.elements = {};
        
        // 配置
        this.config = {
            searchDelay: 300,
            pageSize: 50,
            apiEndpoint: '/api/farmers'
        };
    }

    // 初始化
    async initialize() {
        this.initializeElements();
        this.bindEventListeners();
        await this.loadFarmers();
    }

    // 初始化DOM元素
    initializeElements() {
        this.elements = {
            // 搜索相关
            searchInput: document.getElementById('farmerSearchInput'),
            // clearSearchBtn 已移除
            sortBy: document.getElementById('sortBy'),
            
            // 列表相关
            farmersListContainer: document.getElementById('farmersListContainer'),
            farmersList: document.getElementById('farmersList'),
            farmersCount: document.getElementById('farmersCount'),
            farmersLoadingSpinner: document.getElementById('farmersLoadingSpinner'),
            farmersEmptyState: document.getElementById('farmersEmptyState'),
            
            // 详情面板
            farmerDetailsPanel: document.getElementById('farmerDetailsPanel'),
            backToListBtn: document.getElementById('backToListBtn'),
            editFarmerBtn: document.getElementById('editFarmerBtn'),
            newDetectionBtn: document.getElementById('newDetectionBtn'),
            
            // 农户信息
            farmerName: document.getElementById('farmerName'),
            farmerPhone: document.getElementById('farmerPhone'),
            farmerIdCard: document.getElementById('farmerIdCard'),
            farmerProvince: document.getElementById('farmerProvince'),
            farmerCity: document.getElementById('farmerCity'),
            farmerCounty: document.getElementById('farmerCounty'),
            farmerTown: document.getElementById('farmerTown'),
            farmerDistrict: document.getElementById('farmerDistrict'),
            farmerDetailAddress: document.getElementById('farmerDetailAddress'),
            farmerSheepCount: document.getElementById('farmerSheepCount'),
            farmerCattleCount: document.getElementById('farmerCattleCount'),
            farmerPastureArea: document.getElementById('farmerPastureArea'),
            farmerFodderArea: document.getElementById('farmerFodderArea'),
            farmerHorseCount: document.getElementById('farmerHorseCount'),
            farmerNotes: document.getElementById('farmerNotes'),
            
            // 统计信息
            totalDetections: document.getElementById('totalDetections'),
            lastDetectionDate: document.getElementById('lastDetectionDate'),
            farmerNotesCard: document.getElementById('farmerNotesCard'),
            overgrazingRisk: document.getElementById('overgrazingRisk'),
            
            // 历史记录
            historyFilter: document.getElementById('historyFilter'),
            historySort: document.getElementById('historySort'),
            detectionTasksList: document.getElementById('detectionTasksList'),
            detectionHistoryEmpty: document.getElementById('detectionHistoryEmpty'),
            
            // 按钮
            addFarmerBtn: document.getElementById('addFarmerBtn'),
            
            // 模态框
            farmerModal: document.getElementById('farmerModal'),
            farmerModalTitle: document.getElementById('farmerModalTitle'),
            closeFarmerModal: document.getElementById('closeFarmerModal'),
            farmerForm: document.getElementById('farmerForm'),
            cancelFarmerBtn: document.getElementById('cancelFarmerBtn'),
            saveFarmerBtn: document.getElementById('saveFarmerBtn'),
            
            // 表单输入
            inputFarmerName: document.getElementById('inputFarmerName'),
            inputFarmerPhone: document.getElementById('inputFarmerPhone'),
            inputFarmerIdCard: document.getElementById('inputFarmerIdCard'),
            inputFarmerProvince: document.getElementById('inputFarmerProvince'),
            inputFarmerCity: document.getElementById('inputFarmerCity'),
            inputFarmerCounty: document.getElementById('inputFarmerCounty'),
            inputFarmerTown: document.getElementById('inputFarmerTown'),
            inputFarmerDetailAddress: document.getElementById('inputFarmerDetailAddress'),
            inputSheepCount: document.getElementById('inputSheepCount'),
            inputCattleCount: document.getElementById('inputCattleCount'),
            inputHorseCount: document.getElementById('inputHorseCount'),
            inputPastureArea: document.getElementById('inputPastureArea'),
            inputFodderArea: document.getElementById('inputFodderArea'),
            inputFarmerNotes: document.getElementById('inputFarmerNotes'),
            inputFarmerVillage: document.getElementById('inputFarmerVillage'),
            inputSuitableCapacity: document.getElementById('inputSuitableCapacity'),
            inputCurrentCapacity: document.getElementById('inputCurrentCapacity'),
            inputOverload: document.getElementById('inputOverload'),
            
            // 任务详情模态框
            taskDetailModal: document.getElementById('taskDetailModal'),
            taskDetailTitle: document.getElementById('taskDetailTitle'),
            closeTaskDetailModal: document.getElementById('closeTaskDetailModal'),
            taskDetailContent: document.getElementById('taskDetailContent'),
            
            // 移动端模态框遮罩
            farmerDetailsOverlay: document.getElementById('farmerDetailsOverlay')
        };
    }

    // 绑定事件监听器
    bindEventListeners() {
        // 搜索事件
        this.elements.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        // clearSearchBtn 相关事件已移除
        
        // 排序事件
        this.elements.sortBy.addEventListener('change', () => this.applyFilters());
        
        // 导航事件
        this.elements.backToListBtn.addEventListener('click', () => this.showFarmersList());
        
        // 农户操作事件
        this.elements.addFarmerBtn.addEventListener('click', () => this.showAddFarmerModal());
        this.elements.editFarmerBtn.addEventListener('click', () => this.showEditFarmerModal());
        this.elements.newDetectionBtn.addEventListener('click', () => this.startNewDetection());
        
        // 模态框事件
        this.elements.closeFarmerModal.addEventListener('click', () => this.closeFarmerModal());
        this.elements.cancelFarmerBtn.addEventListener('click', () => this.closeFarmerModal());
        this.elements.farmerForm.addEventListener('submit', (e) => this.handleFarmerFormSubmit(e));
        
        // 任务详情模态框事件
        this.elements.closeTaskDetailModal.addEventListener('click', () => this.closeTaskDetailModal());
        
        // 历史记录筛选事件
        this.elements.historyFilter.addEventListener('change', () => this.filterDetectionHistory());
        this.elements.historySort.addEventListener('change', () => this.filterDetectionHistory());
        
        // 禁止点击模态框外部关闭弹窗
        // this.elements.farmerModal.addEventListener('click', (e) => {
        //     if (e.target === this.elements.farmerModal) {
        //         this.closeFarmerModal();
        //     }
        // });
        
        this.elements.taskDetailModal.addEventListener('click', (e) => {
            if (e.target === this.elements.taskDetailModal) {
                this.closeTaskDetailModal();
            }
        });
        
        // 移动端模态框遮罩事件
        if (this.elements.farmerDetailsOverlay) {
            this.elements.farmerDetailsOverlay.addEventListener('click', () => this.showFarmersList());
        }
        
        // 键盘事件
        document.addEventListener('keydown', (e) => this.handleKeyboardEvents(e));
    }

    // 加载农户数据
    async loadFarmers() {
        this.showLoading(true);
        
        try {
            // 模拟API调用，实际使用时替换为真实API
            const response = await this.fetchFarmersFromAPI();
            this.farmers = response.farmers || [];
            this.filteredFarmers = [...this.farmers];
            
            this.renderFarmersList();
            this.updateFarmersCount();
            
        } catch (error) {
            console.error('加载农户数据失败:', error);
            NotificationManager.show('加载农户数据失败', 'error');
            this.showEmptyState(true);
        } finally {
            this.showLoading(false);
        }
    }

    // 从API获取农户数据
    async fetchFarmersFromAPI() {
        try {
            const response = await fetch('/api/farmers');
            if (!response.ok) {
                throw new Error('获取农户数据失败');
            }
            return await response.json();
        } catch (error) {
            console.error('API调用失败:', error);
            throw error;
        }
    }

    // 搜索处理
    handleSearch(query) {
        // 显示/隐藏清除按钮
        // clearSearchBtn 样式控制已移除
        
        // 防抖搜索
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.performSearch(query);
        }, this.config.searchDelay);
    }

    // 执行搜索
    performSearch(query) {
        if (!query.trim()) {
            this.filteredFarmers = [...this.farmers];
        } else {
            const searchTerm = query.toLowerCase().trim();
            this.filteredFarmers = this.farmers.filter(farmer =>
                (farmer.name && farmer.name.toLowerCase().includes(searchTerm)) ||
                (farmer.phone && farmer.phone.includes(searchTerm)) ||
                (farmer.id_card && farmer.id_card.toLowerCase().includes(searchTerm)) ||
                (farmer.detail_address && farmer.detail_address.toLowerCase().includes(searchTerm)) ||
                (farmer.province && farmer.province.toLowerCase().includes(searchTerm)) ||
                (farmer.city && farmer.city.toLowerCase().includes(searchTerm)) ||
                (farmer.county && farmer.county.toLowerCase().includes(searchTerm)) ||
                (farmer.town && farmer.town.toLowerCase().includes(searchTerm))
            );
        }

        this.applyFilters();
    }

    // 清除搜索
    clearSearch() {
        this.elements.searchInput.value = '';
        this.elements.clearSearchBtn.style.display = 'none';
        this.filteredFarmers = [...this.farmers];
        this.applyFilters();
    }

    // 应用筛选和排序
    applyFilters() {
        let filtered = [...this.filteredFarmers];
        
        // 排序
        const sortBy = this.elements.sortBy.value;
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'last_detection':
                    return new Date(b.last_detection_date || 0) - new Date(a.last_detection_date || 0);
                case 'sheep_count':
                    return (b.sheep_count || 0) - (a.sheep_count || 0);
                case 'cattle_count':
                    return (b.cattle_count || 0) - (a.cattle_count || 0);
                case 'current_capacity':
                    return (b.current_capacity || 0) - (a.current_capacity || 0);
                case 'overload':
                    return (b.overload || 0) - (a.overload || 0);
                case 'default':
                default:
                    return 0; // 不排序，保持原顺序
            }
        });
        
        this.filteredFarmers = filtered;
        this.renderFarmersList();
        this.updateFarmersCount();
    }

    // 渲染农户列表
    renderFarmersList() {
        if (this.filteredFarmers.length === 0) {
            this.showEmptyState(true);
            return;
        }

        this.showEmptyState(false);

        const tbody = this.elements.farmersList.querySelector('tbody');
        if (tbody) {
            tbody.innerHTML = this.filteredFarmers.map(farmer => this.createFarmerRow(farmer)).join('');
        }

        // 绑定表格行点击事件
        this.bindFarmerRowEvents();
    }

    // 创建农户表格行HTML
    createFarmerRow(farmer) {
        const lastDetection = farmer.last_detection_date
            ? new Date(farmer.last_detection_date).toLocaleDateString()
            : '未检测';

        return `
            <tr class="farmer-row" data-farmer-id="${farmer.id}" style="cursor:pointer;">
                <td>${farmer.name}</td>
                <td>${farmer.phone || '未填写'}</td>
                <td>${farmer.id_card || '未填写'}</td>
                <td>${farmer.province || ''}</td>
                <td>${farmer.city || ''}</td>
                <td>${farmer.county || ''}</td>
                <td>${farmer.town || ''}</td>
                <td>${farmer.village || ''}</td>
                <td>${
                    farmer.detail_address
                        ? (farmer.detail_address.length > 14 ? farmer.detail_address.slice(0, 14) + '…' : farmer.detail_address)
                        : ''
                }</td>
<td style="width:60px;">${farmer.big_sheep_count !== null && farmer.big_sheep_count !== undefined ? farmer.big_sheep_count : '-'}</td>
                <td style="width:60px;">${farmer.small_sheep_count !== null && farmer.small_sheep_count !== undefined ? farmer.small_sheep_count : '-'}</td>
                <td style="width:60px;">${farmer.big_cattle_count !== null && farmer.big_cattle_count !== undefined ? farmer.big_cattle_count : '-'}</td>
                <td style="width:60px;">${farmer.small_cattle_count !== null && farmer.small_cattle_count !== undefined ? farmer.small_cattle_count : '-'}</td>
                <td style="width:60px;">${farmer.horse_count || 0}</td>
                <td>${farmer.pasture_area || 0}</td>
                <td>${farmer.fodder_area || 0}</td>
                <td>${farmer.suitable_capacity ?? 0}</td>
                <td>${farmer.current_capacity ?? 0}</td>
                <td>${farmer.overload !== null && farmer.overload !== undefined ? farmer.overload : '-'}</td>
                <td>${lastDetection}</td>
            </tr>
        `;
    }

    // 绑定表格行点击事件
    bindFarmerRowEvents() {
        const farmerRows = this.elements.farmersList.querySelectorAll('.farmer-row');
        farmerRows.forEach(row => {
            row.addEventListener('click', () => {
                const farmerId = parseInt(row.dataset.farmerId);
                this.selectFarmer(farmerId);
            });
        });
    }

    // 获取检测状态样式类
    getDetectionStatusClass(farmer) {
        if (!farmer.last_detection_date) return 'inactive';
        
        const daysSinceLastDetection = Math.floor(
            (new Date() - new Date(farmer.last_detection_date)) / (1000 * 60 * 60 * 24)
        );
        
        if (daysSinceLastDetection <= 7) return 'completed';
        if (daysSinceLastDetection <= 30) return 'processing';
        return 'inactive';
    }

    // 获取检测状态文本
    getDetectionStatusText(farmer) {
        if (!farmer.last_detection_date) return '未检测';
        
        const daysSinceLastDetection = Math.floor(
            (new Date() - new Date(farmer.last_detection_date)) / (1000 * 60 * 60 * 24)
        );
        
        if (daysSinceLastDetection <= 7) return '最近活跃';
        if (daysSinceLastDetection <= 30) return '一般活跃';
        return '不活跃';
    }

    // 绑定农户卡片事件
    bindFarmerCardEvents() {
        const farmerCards = this.elements.farmersList.querySelectorAll('.farmer-card');
        farmerCards.forEach(card => {
            card.addEventListener('click', () => {
                const farmerId = parseInt(card.dataset.farmerId);
                this.selectFarmer(farmerId);
            });
        });
    }

    // 选择农户
    async selectFarmer(farmerId) {
        const farmer = this.farmers.find(f => f.id === farmerId);
        if (!farmer) return;
        
        this.currentFarmer = farmer;
        
        // 更新选中状态
        this.updateSelectedFarmerCard(farmerId);
        
        // 显示详情面板
        await this.showFarmerDetails(farmer);
    }

    // 更新选中的农户卡片样式
    updateSelectedFarmerCard(farmerId) {
        // 移除所有选中状态
        this.elements.farmersList.querySelectorAll('.farmer-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        // 先移除所有表格行的选中状态
        this.elements.farmersList.querySelectorAll('.farmer-row').forEach(row => {
            row.classList.remove('selected');
        });
        // 添加新的选中状态
        const selectedRow = this.elements.farmersList.querySelector(`.farmer-row[data-farmer-id="${farmerId}"]`);
        if (selectedRow) {
            selectedRow.classList.add('selected');
        }
        // 兼容卡片视图
        const selectedCard = this.elements.farmersList.querySelector(`.farmer-card[data-farmer-id="${farmerId}"]`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
        }
    }

    // 显示农户详情
    async showFarmerDetails(farmer) {
        // 收缩农户列表
        this.elements.farmersListContainer.classList.add('collapsed');
        
        // 填充基本信息（仅在元素存在时赋值，避免null错误）
        if (this.elements.farmerName) this.elements.farmerName.textContent = farmer.name;
        if (this.elements.farmerPhone) this.elements.farmerPhone.textContent = farmer.phone || '未填写';
        if (this.elements.farmerIdCard) this.elements.farmerIdCard.textContent = farmer.id_card || '未填写';
        if (this.elements.farmerProvince) this.elements.farmerProvince.textContent = farmer.province ? farmer.province : '';
        if (this.elements.farmerCity) this.elements.farmerCity.textContent = farmer.city ? farmer.city : '';
        if (this.elements.farmerCounty) this.elements.farmerCounty.textContent = farmer.county ? farmer.county : '';
        if (this.elements.farmerTown) this.elements.farmerTown.textContent = farmer.town ? farmer.town : '';
        if (this.elements.farmerVillage) this.elements.farmerVillage.textContent = farmer.village || '';
        if (this.elements.farmerDetailAddress) this.elements.farmerDetailAddress.textContent = farmer.detail_address || '';
        // 用最新检测结果填充 farmer-basic-info 里的大小牛羊数量（必须在检测结果赋值后执行）
        // 只声明一次变量，避免重复声明
        let latestBigSheep = 0, latestSmallSheep = 0, latestBigCattle = 0, latestSmallCattle = 0, latestOverload = 0;
        try {
            const resp = await fetch(`/api/checks?farmer_id=${farmer.id}&_limit=1&_sort=detection_date:desc`);
            if (resp.ok) {
                const tasks = await resp.json();
                if (tasks && tasks.length > 0) {
                    latestBigSheep = tasks[0].big_sheep_count ?? 0;
                    latestSmallSheep = tasks[0].small_sheep_count ?? 0;
                    latestBigCattle = tasks[0].big_cattle_count ?? 0;
                    latestSmallCattle = tasks[0].small_cattle_count ?? 0;
                    latestOverload = tasks[0].overload ?? 0;
                }
            }
        } catch {}
        if (this.elements.farmerSheepCount) this.elements.farmerSheepCount.textContent = `大羊：${latestBigSheep} 只，小羊：${latestSmallSheep} 只`;
        if (this.elements.farmerCattleCount) this.elements.farmerCattleCount.textContent = `大牛：${latestBigCattle} 头，小牛：${latestSmallCattle} 头`;
        if (this.elements.farmerHorseCount) this.elements.farmerHorseCount.textContent = `${farmer.horse_count || 0}匹`;
        if (this.elements.farmerPastureArea) this.elements.farmerPastureArea.textContent = `${farmer.pasture_area || 0}亩`;
        if (this.elements.farmerFodderArea) this.elements.farmerFodderArea.textContent = `${farmer.fodder_area || 0}亩`;
        if (this.elements.farmerNotes) this.elements.farmerNotes.textContent = farmer.notes || '无备注';
        
        // 填充基本信息中的总检测次数
        this.elements.totalDetections.textContent = `${farmer.total_detections || 0}次`;
        
        // 填充统计信息
        this.elements.lastDetectionDate.textContent = farmer.last_detection_date 
            ? new Date(farmer.last_detection_date).toLocaleDateString() 
            : '未检测';
        
        // 填充统计信息中的动物数量（用最近一次检测任务结果）
        // 已在上方声明并赋值 latestBigSheep 等变量，这里无需重复声明和赋值

        // 修正 farmer-stats-section 赋值
        const farmerSheepCountStat = document.getElementById('farmerSheepCountStat');
        const farmerCattleCountStat = document.getElementById('farmerCattleCountStat');
        const overgrazingRisk = document.getElementById('overgrazingRisk');
        if (farmerSheepCountStat) {
            const sheepTotal = latestBigSheep + latestSmallSheep;
            farmerSheepCountStat.textContent = sheepTotal;
            farmerSheepCountStat.style.color = ""; // 默认色
        }
        if (farmerCattleCountStat) {
            const cattleTotal = latestBigCattle + latestSmallCattle;
            farmerCattleCountStat.textContent = cattleTotal;
            farmerCattleCountStat.style.color = ""; // 默认色
        }
        if (overgrazingRisk) {
            overgrazingRisk.textContent = latestOverload;
            overgrazingRisk.style.color = getStatColor(latestOverload, 0, 200);
            // 同时修改label为“超载量”
            const labelElem = overgrazingRisk.parentElement && overgrazingRisk.parentElement.querySelector('.stat-label');
            if (labelElem) labelElem.textContent = '超载量';
        }

        function getStatColor(val, min, max) {
            // val越大颜色越红，min为绿色，max为红色
            val = Math.max(min, Math.min(max, val));
            const percent = (val - min) / (max - min);
            const r = Math.round(255 * percent);
            const g = Math.round(80 + 120 * (1 - percent));
            const b = Math.round(80 + 80 * (1 - percent));
            return `rgb(${r},${g},${b})`;
        }

        this.elements.overgrazingRisk.textContent = this.getRiskText(farmer.overgrazing_risk);
        
        // 填充备注信息
        if (this.elements.farmerNotes) {
            this.elements.farmerNotes.textContent = farmer.notes || '';
        }
        
        // 设置风险颜色
        this.setRiskColor(farmer.overgrazing_risk);
        
        // 加载检测历史
        await this.loadDetectionHistory(farmer.id);
        
        // 显示详情面板和移动端遮罩
        this.elements.farmerDetailsPanel.classList.add('show');
        this.elements.farmerDetailsPanel.style.display = 'flex';
        
        if (this.elements.farmerDetailsOverlay) {
            this.elements.farmerDetailsOverlay.classList.add('show');
        }
    }

    // 获取风险文本
    getRiskText(risk) {
        const riskMap = {
            'low': '低',
            'medium': '中',
            'high': '高'
        };
        return riskMap[risk] || '未知';
    }

    // 设置风险颜色
    setRiskColor(risk) {
        const riskElement = this.elements.overgrazingRisk;
        riskElement.className = 'stat-number';
        
        switch (risk) {
            case 'low':
                riskElement.style.color = '#27ae60';
                break;
            case 'medium':
                riskElement.style.color = '#f39c12';
                break;
            case 'high':
                riskElement.style.color = '#e74c3c';
                break;
            default:
                riskElement.style.color = '#2c3e50';
        }
    }

    // 加载检测历史
    async loadDetectionHistory(farmerId) {
        try {
            // 真实API调用，读取数据库detection_tasks
            const response = await fetch(`/api/checks?farmer_id=${farmerId}`);
            // 只在网络错误时报错，404/200都允许
            if (!response.ok && response.status !== 404) throw new Error('获取历史盘点失败');
            let detectionTasks = [];
            if (response.ok) {
                detectionTasks = await response.json();
            }
            this.renderDetectionHistory(detectionTasks);
        } catch (error) {
            console.error('加载检测历史失败:', error);
            if (this.elements.detectionHistoryEmpty) this.elements.detectionHistoryEmpty.style.display = 'block';
            if (this.elements.detectionTasksList) this.elements.detectionTasksList.innerHTML = '';
        }
    }

    // 渲染检测历史
    renderDetectionHistory(tasks) {
        if (!tasks || tasks.length === 0) {
            this.elements.detectionHistoryEmpty.style.display = 'block';
            this.elements.detectionTasksList.innerHTML = '';
            return;
        }
        
        this.elements.detectionHistoryEmpty.style.display = 'none';
        
        const html = tasks.map(task => this.createTaskFolderCard(task)).join('');
        this.elements.detectionTasksList.innerHTML = html;
        
        // 绑定任务卡片事件
        this.bindTaskCardEvents();
    }

    // 创建任务文件夹卡片
    createTaskFolderCard(task) {
        const statusClass = task.status;
        const statusText = this.getTaskStatusText(task.status);
        const mediaText = this.getMediaText(task);
        const resultText = this.getResultText(task);

        // 右侧按钮区样式
        const rightBtnStyle = statusClass === 'completed'
            ? 'position:absolute;right:45px;top:16px;'
            : 'margin-left:auto;';
        const deleteBtnStyle = statusClass === 'completed'
            ? 'position:absolute;right:20px;top:19px;background:none;border:none;cursor:pointer;color:#e74c3c;font-size:20px;'
            : 'margin-left:auto;background:none;border:none;cursor:pointer;color:#e74c3c;font-size:20px;';

        return `
            <div class="task-folder-card" data-task-id="${task.id}" style="position:relative;">
                <div class="task-folder-header">
<div class="folder-icon" style="font-size:22px;line-height:1.1;">
                        📁
                    </div>
                    <div class="task-date-info">
<h5 class="task-date" style="font-size:18px;margin:0 0 2px 0;">${task.detection_date ? new Date(task.detection_date).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}</h5>
                        <div class="task-pilot" style="font-size:12px;color:#888;margin:0;">${task.pilot_name ? '执法人员：' + task.pilot_name : ''}</div>
                    </div>
                    <div class="task-file-count" style="min-width:80px;max-width:120px;text-align:center;margin-left:12px;padding:2px 10px;background:#f5f5f5;border-radius:6px;font-size:15px;">
                        <span title="文件数量">文件数量：${task.total_files || 0}</span>
                    </div>
<button class="delete-task-btn" title="删除盘点" style="${deleteBtnStyle};font-size:13px;padding:2px 14px;border-radius:12px;background:#e74c3c;color:#fff;border:none;display:inline-block;">
                        删除
                    </button>
                </div>
                <div class="task-summary">
                    <div class="summary-item">
                        <div class="summary-value">
                            <span>大羊:${task.big_sheep_count ?? '-'}</span>
                            <span style="margin-left:8px;">小羊:${task.small_sheep_count ?? '-'}</span>
                        </div>
                        <div class="summary-label">羊数量</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-value">
                            <span>大牛:${task.big_cattle_count ?? '-'}</span>
                            <span style="margin-left:8px;">小牛:${task.small_cattle_count ?? '-'}</span>
                        </div>
                        <div class="summary-label">牛数量</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-value">${task.overload ?? '-'} 羊单位</div>
                        <div class="summary-label">超载量</div>
                    </div>
                </div>
            </div>
        `;
    }

    // 获取任务状态文本
    getTaskStatusText(status) {
        const statusMap = {
            'completed': '已完成',
            'processing': '处理中',
            'failed': '失败',
            'pending': '待处理'
        };
        return statusMap[status] || '未知';
    }

    // 获取媒体类型文本
    getMediaText(task) {
        if (task.media_type === 'mixed') {
            return '图片+视频';
        } else if (task.media_type === 'images') {
            return '图片';
        } else if (task.media_type === 'videos') {
            return '视频';
        }
        return '未知';
    }

    // 获取结果文本
    getResultText(task) {
        if (task.status !== 'completed') {
            return '处理中';
        }
        if (task.nky_count && task.bjut_count) {
            return `${Math.round((task.nky_count + task.bjut_count) / 2)}只`;
        }
        return '无结果';
    }

    // 绑定任务卡片事件
    bindTaskCardEvents() {
        const taskCards = this.elements.detectionTasksList.querySelectorAll('.task-folder-card');
        taskCards.forEach(card => {
            // 跳转事件
            card.addEventListener('click', (e) => {
                // 如果点击的是删除按钮，不跳转
                if (e.target.closest('.delete-task-btn')) return;
                const taskId = parseInt(card.dataset.taskId);
                window.location.href = `detection.html?taskId=${taskId}`;
            });
            // 删除按钮事件
            const delBtn = card.querySelector('.delete-task-btn');
            if (delBtn) {
                delBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const taskId = parseInt(card.dataset.taskId);
                    if (!taskId) return;
                    if (!window.confirm('确定要删除该盘点任务及其所有图片和结果吗？此操作不可恢复！')) return;
                    try {
                        const resp = await fetch(`/api/checks/${taskId}`, { method: 'DELETE' });
                        if (resp.ok) {
                            NotificationManager.show('删除成功', 'success');
                            // 重新加载历史
                            if (this.currentFarmer) {
                                await this.loadDetectionHistory(this.currentFarmer.id);
                            }
                        } else {
                            const data = await resp.json();
                            NotificationManager.show('删除失败: ' + (data && data.error ? data.error : '未知错误'), 'error');
                        }
                    } catch (err) {
                        NotificationManager.show('请求失败: ' + err.message, 'error');
                    }
                });
            }
        });
    }

    // 显示任务详情
    async showTaskDetails(taskId) {
        // 这里可以加载更详细的任务信息并显示在模态框中
        this.elements.taskDetailTitle.textContent = `检测任务详情 #${taskId}`;
        this.elements.taskDetailContent.innerHTML = `
            <div class="task-detail-placeholder">
                <p>正在加载任务详情...</p>
                <p>这里将显示该检测任务的详细信息，包括：</p>
                <ul>
                    <li>所有照片和视频的缩略图</li>
                    <li>详细的检测结果</li>
                    <li>算法分析报告</li>
                    <li>原始文件下载链接</li>
                </ul>
            </div>
        `;
        
        this.elements.taskDetailModal.classList.add('show');
        this.elements.taskDetailModal.style.display = 'flex';
    }

    // 显示农户列表
    showFarmersList() {
        this.elements.farmersListContainer.classList.remove('collapsed');
        this.elements.farmerDetailsPanel.classList.remove('show');
        this.elements.farmerDetailsPanel.style.display = 'none';
        this.currentFarmer = null;
        
        // 隐藏移动端遮罩
        if (this.elements.farmerDetailsOverlay) {
            this.elements.farmerDetailsOverlay.classList.remove('show');
        }
        
        // 清除选中状态
        this.elements.farmersList.querySelectorAll('.farmer-card').forEach(card => {
            card.classList.remove('selected');
        });
    }

    // 显示添加农户模态框
    showAddFarmerModal() {
        this.elements.farmerModalTitle.textContent = '添加农户';
        this.clearFarmerForm();
        this.elements.farmerModal.classList.add('show');
        this.elements.farmerModal.style.display = 'flex';
        this.elements.inputFarmerName.focus();
    }

    // 显示编辑农户模态框
    showEditFarmerModal() {
        if (!this.currentFarmer) return;
        
        this.elements.farmerModalTitle.textContent = '编辑农户信息';
        this.fillFarmerForm(this.currentFarmer);
        this.elements.farmerModal.classList.add('show');
        this.elements.farmerModal.style.display = 'flex';
        this.elements.inputFarmerName.focus();
    }

    // 关闭农户模态框
    closeFarmerModal() {
        this.elements.farmerModal.classList.remove('show');
        this.elements.farmerModal.style.display = 'none';
        this.clearFarmerForm();
    }

    // 关闭任务详情模态框
    closeTaskDetailModal() {
        this.elements.taskDetailModal.classList.remove('show');
        this.elements.taskDetailModal.style.display = 'none';
    }

    // 清空农户表单
    clearFarmerForm() {
        this.elements.farmerForm.reset();
    }

    // 填充农户表单
    fillFarmerForm(farmer) {
        if (this.elements.inputFarmerName) this.elements.inputFarmerName.value = farmer.name ?? '';
        if (this.elements.inputFarmerPhone) this.elements.inputFarmerPhone.value = farmer.phone ?? '';
        if (this.elements.inputFarmerIdCard) this.elements.inputFarmerIdCard.value = farmer.id_card ?? '';
        if (this.elements.inputFarmerProvince) this.elements.inputFarmerProvince.value = farmer.province ?? '';
        if (this.elements.inputFarmerCity) this.elements.inputFarmerCity.value = farmer.city ?? '';
        if (this.elements.inputFarmerCounty) this.elements.inputFarmerCounty.value = farmer.county ?? '';
        if (this.elements.inputFarmerTown) this.elements.inputFarmerTown.value = farmer.town ?? '';
        if (this.elements.inputFarmerVillage) this.elements.inputFarmerVillage.value = farmer.village ?? '';
        if (this.elements.inputFarmerDetailAddress) this.elements.inputFarmerDetailAddress.value = farmer.detail_address ?? '';
        if (this.elements.inputSheepCount) this.elements.inputSheepCount.value = '';
        if (this.elements.inputCattleCount) this.elements.inputCattleCount.value = '';
        if (this.elements.inputHorseCount) this.elements.inputHorseCount.value = (farmer.horse_count !== undefined && farmer.horse_count !== null) ? farmer.horse_count.toString() : '';
        if (this.elements.inputPastureArea) this.elements.inputPastureArea.value = (farmer.pasture_area !== undefined && farmer.pasture_area !== null) ? farmer.pasture_area.toString() : '';
        if (this.elements.inputFodderArea) this.elements.inputFodderArea.value = (farmer.fodder_area !== undefined && farmer.fodder_area !== null) ? farmer.fodder_area.toString() : '';
        if (this.elements.inputFarmerNotes) this.elements.inputFarmerNotes.value = farmer.notes ?? '';
        // 新增大小牛羊输入
        if (document.getElementById('inputBigSheepCount')) document.getElementById('inputBigSheepCount').value = (farmer.big_sheep_count ?? '').toString();
        if (document.getElementById('inputSmallSheepCount')) document.getElementById('inputSmallSheepCount').value = (farmer.small_sheep_count ?? '').toString();
        if (document.getElementById('inputBigCattleCount')) document.getElementById('inputBigCattleCount').value = (farmer.big_cattle_count ?? '').toString();
        if (document.getElementById('inputSmallCattleCount')) document.getElementById('inputSmallCattleCount').value = (farmer.small_cattle_count ?? '').toString();
    }

    // 处理农户表单提交
    async handleFarmerFormSubmit(e) {
        e.preventDefault();
        
        const formData = {
            name: this.elements.inputFarmerName ? this.elements.inputFarmerName.value.trim() : '',
            phone: this.elements.inputFarmerPhone ? this.elements.inputFarmerPhone.value.trim() : '',
            id_card: this.elements.inputFarmerIdCard ? this.elements.inputFarmerIdCard.value.trim() : '',
            province: this.elements.inputFarmerProvince ? this.elements.inputFarmerProvince.value.trim() : '',
            city: this.elements.inputFarmerCity ? this.elements.inputFarmerCity.value.trim() : '',
            county: this.elements.inputFarmerCounty ? this.elements.inputFarmerCounty.value.trim() : '',
            town: this.elements.inputFarmerTown ? this.elements.inputFarmerTown.value.trim() : '',
            village: this.elements.inputFarmerVillage ? this.elements.inputFarmerVillage.value.trim() : '',
            detail_address: this.elements.inputFarmerDetailAddress ? this.elements.inputFarmerDetailAddress.value.trim() : '',
            big_sheep_count: document.getElementById('inputBigSheepCount') ? (parseInt(document.getElementById('inputBigSheepCount').value) || 0) : 0,
            small_sheep_count: document.getElementById('inputSmallSheepCount') ? (parseInt(document.getElementById('inputSmallSheepCount').value) || 0) : 0,
            big_cattle_count: document.getElementById('inputBigCattleCount') ? (parseInt(document.getElementById('inputBigCattleCount').value) || 0) : 0,
            small_cattle_count: document.getElementById('inputSmallCattleCount') ? (parseInt(document.getElementById('inputSmallCattleCount').value) || 0) : 0,
            horse_count: this.elements.inputHorseCount ? (parseInt(this.elements.inputHorseCount.value) || 0) : 0,
            pasture_area: this.elements.inputPastureArea ? (parseFloat(this.elements.inputPastureArea.value) || 0) : 0,
            fodder_area: this.elements.inputFodderArea ? (parseFloat(this.elements.inputFodderArea.value) || 0) : 0,
            suitable_capacity: this.elements.inputSuitableCapacity ? (parseInt(this.elements.inputSuitableCapacity.value) || 0) : 0,
            current_capacity: this.elements.inputCurrentCapacity ? (parseInt(this.elements.inputCurrentCapacity.value) || 0) : 0,
            overload: this.elements.inputOverload ? (parseInt(this.elements.inputOverload.value) || 0) : 0,
            notes: this.elements.inputFarmerNotes ? this.elements.inputFarmerNotes.value.trim() : ''
        };
        
        if (!formData.name) {
            NotificationManager.show('请输入农户姓名', 'warning');
            return;
        }
        
        try {
            let result;
            let farmerId;
            if (this.currentFarmer && this.elements.farmerModalTitle.textContent.includes('编辑')) {
                result = await this.updateFarmer(this.currentFarmer.id, formData);
                farmerId = this.currentFarmer.id;
            } else {
                result = await this.addFarmer(formData);
                farmerId = result && result.farmerId;
            }

            this.closeFarmerModal();
            await this.loadFarmers();
            if (farmerId) {
                await this.selectFarmer(farmerId);
            }
            
        } catch (error) {
            console.error('保存农户信息失败:', error);
            NotificationManager.show('保存农户信息失败', 'error');
        }
    }

    // 添加农户
    async addFarmer(formData) {
        try {
            const response = await fetch('/api/farmers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || '添加农户失败');
            }
            
            const result = await response.json();
            NotificationManager.show('农户添加成功', 'success');
            return result;
        } catch (error) {
            console.error('添加农户失败:', error);
            throw error;
        }
    }

    // 更新农户
    async updateFarmer(farmerId, formData) {
        try {
            const response = await fetch(`/api/farmers/${farmerId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || '更新农户失败');
            }
            
            const result = await response.json();
            NotificationManager.show('农户信息更新成功', 'success');
            return result;
        } catch (error) {
            console.error('更新农户失败:', error);
            throw error;
        }
    }

    // 开始新检测
    startNewDetection() {
        if (!this.currentFarmer) return;
        // 跳转到检测页面，只传递农户ID
        const farmerId = this.currentFarmer.id;
        window.location.href = `detection.html?farmerId=${farmerId}`;
    }

    // 返回主页（现在不需要这个方法，因为已经是主页了）
    backToMain() {
        // 农户管理现在就是主页，所以不需要跳转
        console.log('Already on main page (farmers management)');
    }

    // 显示加载状态
    showLoading(show) {
        this.elements.farmersLoadingSpinner.style.display = show ? 'block' : 'none';
        this.isLoading = show;
    }

    // 显示空状态
    showEmptyState(show) {
        this.elements.farmersEmptyState.style.display = show ? 'block' : 'none';
        this.elements.farmersList.style.display = show ? 'none' : 'grid';
    }

    // 更新农户数量显示
    updateFarmersCount() {
        const count = this.filteredFarmers.length;
        this.elements.farmersCount.textContent = `共 ${count} 户`;
    }

    // 筛选检测历史
    filterDetectionHistory() {
        // 这里可以根据历史筛选条件重新加载和显示检测任务
        if (this.currentFarmer) {
            this.loadDetectionHistory(this.currentFarmer.id);
        }
    }

    // 键盘事件处理
    handleKeyboardEvents(e) {
        if (e.key === 'Escape') {
            if (this.elements.farmerModal.classList.contains('show')) {
                this.closeFarmerModal();
            } else if (this.elements.taskDetailModal.classList.contains('show')) {
                this.closeTaskDetailModal();
            } else if (this.elements.farmerDetailsPanel.classList.contains('show')) {
                this.showFarmersList();
            }
        }
    }
}

// 创建全局实例
window.farmersManager = new FarmersManager();
