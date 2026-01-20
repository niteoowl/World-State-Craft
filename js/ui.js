// World State Craft - UI Controller
import CONFIG from './config.js';
import { FLAGS } from './data/flags.js';

class UIManager {
    constructor() {
        this.activePanel = null;
        this.modals = new Map();
        this.notifications = [];
        this.tooltip = null;
    }

    init() {
        this.createTooltip();
        this.bindEvents();
    }

    createTooltip() {
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'territory-tooltip';
        document.body.appendChild(this.tooltip);
    }

    showTooltip(x, y, content) {
        this.tooltip.innerHTML = content;
        this.tooltip.classList.add('visible');

        // Position tooltip
        const rect = this.tooltip.getBoundingClientRect();
        let left = x + 15;
        let top = y + 15;

        // Keep on screen
        if (left + rect.width > window.innerWidth) {
            left = x - rect.width - 15;
        }
        if (top + rect.height > window.innerHeight) {
            top = y - rect.height - 15;
        }

        this.tooltip.style.left = left + 'px';
        this.tooltip.style.top = top + 'px';
    }

    hideTooltip() {
        this.tooltip.classList.remove('visible');
    }

    openPanel(panelId) {
        // Close current panel
        if (this.activePanel) {
            document.getElementById(this.activePanel)?.classList.remove('active');
        }

        // Open new panel
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.classList.add('active');
            this.activePanel = panelId;
        }
    }

    closePanel() {
        if (this.activePanel) {
            document.getElementById(this.activePanel)?.classList.remove('active');
            this.activePanel = null;
        }
    }

    showModal(modalId) {
        const overlay = document.getElementById(modalId);
        if (overlay) {
            overlay.classList.add('active');
        }
    }

    closeModal(modalId) {
        const overlay = document.getElementById(modalId);
        if (overlay) {
            overlay.classList.remove('active');
        }
    }

    notify(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span class="notification-icon">${this.getNotificationIcon(type)}</span>
            <span class="notification-message">${message}</span>
        `;

        const container = document.getElementById('notification-container') || this.createNotificationContainer();
        container.appendChild(notification);

        // Animate in
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });

        // Auto remove
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }

    createNotificationContainer() {
        const container = document.createElement('div');
        container.id = 'notification-container';
        container.style.cssText = `
            position: fixed;
            top: 80px;
            right: 24px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            z-index: 2000;
        `;
        document.body.appendChild(container);
        return container;
    }

    getNotificationIcon(type) {
        const icons = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌'
        };
        return icons[type] || icons.info;
    }

    updateResourceDisplay(resources) {
        Object.entries(resources).forEach(([key, value]) => {
            const element = document.querySelector(`[data-resource="${key}"] .resource-value`);
            if (element) {
                const current = parseInt(element.textContent.replace(/,/g, '')) || 0;
                this.animateValue(element, current, value, 500);
            }
        });
    }

    animateValue(element, start, end, duration) {
        const range = end - start;
        const startTime = performance.now();

        const update = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            const value = Math.floor(start + range * this.easeOutQuad(progress));
            element.textContent = value.toLocaleString();

            if (progress < 1) {
                requestAnimationFrame(update);
            }
        };

        requestAnimationFrame(update);
    }

    easeOutQuad(t) {
        return t * (2 - t);
    }

    setLoading(isLoading, message = 'Loading...') {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            if (isLoading) {
                loadingScreen.classList.remove('hidden');
                loadingScreen.querySelector('.loading-text').textContent = message;
            } else {
                loadingScreen.classList.add('hidden');
            }
        }
    }

    setLoadingProgress(percent) {
        const progressBar = document.querySelector('.loading-progress');
        if (progressBar) {
            progressBar.style.width = percent + '%';
        }
    }

    bindEvents() {
        // Close modal on overlay click
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.classList.remove('active');
                }
            });
        });

        // Close button handlers
        document.querySelectorAll('.panel-close').forEach(btn => {
            btn.addEventListener('click', () => this.closePanel());
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closePanel();
                document.querySelectorAll('.modal-overlay.active').forEach(m => {
                    m.classList.remove('active');
                });
            }
        });
    }

    // Create nation creation wizard HTML
    renderNationCreationWizard() {
        return `
            <div class="wizard-steps">
                <div class="wizard-step active" data-step="1">
                    <span class="step-number">1</span>
                    <span class="step-label">기본 정보</span>
                </div>
                <div class="wizard-step" data-step="2">
                    <span class="step-number">2</span>
                    <span class="step-label">지정학적 특징</span>
                </div>
                <div class="wizard-step" data-step="3">
                    <span class="step-number">3</span>
                    <span class="step-label">정치 체제</span>
                </div>
                <div class="wizard-step" data-step="4">
                    <span class="step-number">4</span>
                    <span class="step-label">영토 선택</span>
                </div>
            </div>
            
            <div class="wizard-content">
                <!-- Step 1: Basic Info -->
                <div class="wizard-page active" data-page="1">
                    <div class="text-center mb-4" style="background: rgba(201, 162, 39, 0.1); padding: 8px; border-radius: 6px; border: 1px solid var(--border-gold);">
                        <span style="color: var(--primary-gold); font-size: 12px; font-weight: 600;">ℹ️ 이 게임은 실시간이 아닌 턴제로 운영됩니다.</span>
                    </div>
                    <div class="form-group">
                        <label>국가명</label>
                        <input type="text" class="form-input" id="nation-name" placeholder="예: 대한민국" maxlength="30">
                    </div>
                    <div class="form-group">
                        <label>국가 표어</label>
                        <input type="text" class="form-input" id="nation-motto" placeholder="예: 홍익인간" maxlength="50">
                    </div>
                    <div class="form-group">
                        <label>화폐 단위</label>
                        <input type="text" class="form-input" id="nation-currency" placeholder="예: ₩ 원" maxlength="20">
                    </div>
                    <div class="form-group">
                        <label>국기 업로드</label>
                        <div class="flag-upload">
                            <input type="file" id="flag-input" accept="image/*" hidden>
                            <div class="flag-preview" id="flag-preview">
                                <span>🏳️ 클릭하여 선택</span>
                            </div>
                            <button class="btn btn-secondary" style="width: 100%; margin-top: 8px; font-size: 12px; padding: 8px;" id="btn-select-flag">
                                🔍 국기 검색 / 선택
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Step 2: Geopolitical Traits -->
                <div class="wizard-page" data-page="2">
                    <h3>지정학적 특징 선택</h3>
                    <p class="text-secondary mb-4">국가의 지리적 특성을 선택하세요</p>
                    
                    <div class="trait-grid">
                        ${this.renderTraitOptions('TRAITS')}
                    </div>
                    
                    <h3 class="mt-6">초기 국가 보너스</h3>
                    <div class="trait-grid">
                        ${this.renderTraitOptions('NATIONAL_BONUSES')}
                    </div>
                </div>

                <!-- Step 3: Political System -->
                <div class="wizard-page" data-page="3">
                    <h3>정치 체제 선택</h3>
                    <p class="text-secondary mb-4">국가의 통치 방식을 결정하세요</p>
                    
                    <div class="trait-grid">
                        ${this.renderPoliticalSystems()}
                    </div>
                </div>

                <!-- Step 4: Territory Selection -->
                <div class="wizard-page" data-page="4">
                    <h3>시작 영토 선택</h3>
                    <p class="text-secondary mb-4">지구본에서 점령할 영토를 클릭하세요</p>
                    
                    <div class="selected-territory" id="selected-territory">
                        <span class="placeholder">영토를 선택하지 않았습니다</span>
                    </div>
                </div>
            </div>
        `;
    }

    renderTraitOptions(configKey) {
        const traits = CONFIG[configKey];
        return Object.entries(traits).map(([key, trait]) => `
            <label class="trait-option">
                <input type="radio" name="${configKey.toLowerCase()}" value="${trait.id}">
                <div class="trait-icon">${trait.icon}</div>
                <div class="trait-name">${trait.name}</div>
                <div class="trait-desc">${trait.description}</div>
            </label>
        `).join('');
    }

    renderPoliticalSystems() {
        return Object.entries(CONFIG.POLITICAL_SYSTEMS).map(([key, system]) => `
            <label class="trait-option">
                <input type="radio" name="political_system" value="${system.id}">
                <div class="trait-icon">${system.icon}</div>
                <div class="trait-name">${system.name}</div>
                <div class="trait-desc">${system.description}</div>
                <div class="trait-bonus">장점: ${Object.keys(system.bonuses).join(', ')}</div>
                <div class="trait-penalty">단점: ${Object.keys(system.penalties).join(', ')}</div>
            </label>
        `).join('');
    }

    renderFlagSelector() {
        return `
            <div class="flag-selector-modal">
                <div class="flag-search">
                    <input type="text" class="form-input" id="flag-search-input" placeholder="국가명 검색 (예: 한국, Korea, KR)...">
                </div>
                <div class="flag-grid-container" id="flag-grid-container">
                    ${this.renderFlagGrid(FLAGS)}
                </div>
            </div>
        `;
    }

    renderFlagGrid(data) {
        if (!data || data.length === 0) return '<p style="text-align: center; color: var(--text-muted); padding: 20px;">검색 결과가 없습니다.</p>';

        return data.map(region => `
            <div class="region-section">
                <div class="region-header">${region.region}</div>
                <div class="flag-grid">
                    ${region.countries.map(country => `
                        <div class="flag-item" data-name="${country.name}" data-url="${country.url}">
                            <img src="${country.url}" alt="${country.name}" class="flag-item-img" loading="lazy">
                            <div class="flag-item-name" title="${country.name}">${country.name.split('(')[0].trim()}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }

    filterFlags(query) {
        if (!query) return FLAGS;

        const lowerQuery = query.toLowerCase();
        const filtered = [];

        for (const region of FLAGS) {
            const matchingCountries = region.countries.filter(c =>
                c.name.toLowerCase().includes(lowerQuery)
            );

            if (matchingCountries.length > 0) {
                filtered.push({
                    region: region.region,
                    countries: matchingCountries
                });
            }
        }

        return filtered;
    }
}

// Singleton instance
const ui = new UIManager();
export default ui;
