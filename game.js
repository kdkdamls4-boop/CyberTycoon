/**
 * ============================================================================
 * CyberTycoon Pro: Игровой движок экономической стратегии (game.js)
 * ============================================================================
 * 
 * Архитектура проекта (Паттерны и модули):
 * 1. State Machine (Управление экранами): Главное меню <-> Игровой процесс.
 * 2. Direction Engine (Выбор сеттинга): ИИ, GameDev или Кибербезопасность.
 * 3. HR Module (Кадры): Найм и Увольнение сотрудников с расчетом ФОТ (фонда оплаты труда).
 * 4. Market Sentiment Engine (Биржа с новостными сигналами): Влияние новостей на курс акций.
 * 5. Game Loop (Игровой цикл): Настраиваемая скорость времени (0.5x, 1x, Пауза).
 * 6. Web Audio Synthesizer: Встроенный звуковой движок без внешних mp3-файлов.
 */

// ============================================================================
// 1. ГЛОБАЛЬНОЕ СОСТОЯНИЕ ИГРЫ (GAME STATE)
// ============================================================================
let gameState = {
    companyName: "NeuroCorp",
    direction: "ai",          // 'ai' | 'gamedev' | 'cybersec'
    directionLabel: "IT & Нейросети",
    
    money: 6000,              // Стартовый капитал в долларах
    day: 1,                   // Текущий день симуляции
    reputation: 50,           // Репутация от 0 до 100
    morale: 85,               // Мораль и вовлеченность коллектива от 0 до 100%
    isPaused: false,          // Флаг паузы
    tickSpeed: 3000,          // Скорость тика (3000 мс = 3 секунды на 1 день)
    officeTier: 1,            // Уровень офиса (1: Гараж, 2: Коворкинг, 3: БЦ, 4: Небоскрёб)
    upgrades: [],             // Список ID купленного оборудования

    // Параметры фондовой биржи
    stocks: {
        price: 100,           // Текущий курс акций (целочисленный для отображения)
        floatPrice: 100.0,    // Внутренняя точная цена с плавающей точкой (защита от залипания на $15/$600)
        history: [100],       // История цен для графика на Canvas (хранит 120+ точек)
        userOwned: 0,         // Количество акций у игрока
        marketTrend: 0        // Влияние новостей: +1 (рост), -1 (падение), 0 (нейтрально)
    },

    // Штат сотрудников
    employees: {
        junior: { count: 0, salary: 60, devPower: 2, name: "Junior специалист" },
        middle: { count: 0, salary: 160, devPower: 8, name: "Middle разработчик" },
        senior: { count: 0, salary: 420, devPower: 26, name: "Senior тимлид" },
        marketer: { count: 0, salary: 140, repPower: 1, name: "PR-маркетолог" }
    },

    // Список проектов (формируется при выборе направления)
    projects: []
};

// Каталог уровней недвижимости компании (Офисы)
const officeTiers = [
    { tier: 1, name: "Гараж основателей", maxEmployees: 4, cost: 0, speedBuff: 1.0, repBuff: 0, icon: "🏚️", desc: "Скромный гараж на окраине города. Места мало, но аренда бесплатная." },
    { tier: 2, name: "Современный Коворкинг", maxEmployees: 10, cost: 7000, speedBuff: 1.15, repBuff: 5, icon: "🏢", desc: "Просторные столы, переговорки и скоростной интернет (+15% к скорости разработки)." },
    { tier: 3, name: "Этаж в Бизнес-Центре", maxEmployees: 25, cost: 28000, speedBuff: 1.35, repBuff: 15, icon: "🏙️", desc: "Престижный офис класса A. Доверие клиентов и скорость работы вырастут на +35%." },
    { tier: 4, name: "Небоскрёб CyberTower", maxEmployees: 999, cost: 110000, speedBuff: 1.6, repBuff: 35, icon: "✨", desc: "Собственная штаб-квартира мирового гиганта. Безлимит рабочих мест (+60% к разработке)!" }
];

// Каталог технического оснащения и улучшений офиса
const equipmentCatalog = [
    { id: 'coffee', name: "Итальянская кофемашина и лаундж", cost: 1200, icon: "☕", desc: "Кофе высшего класса: сотрудники пишут код на +15% быстрее и растут в морали." },
    { id: 'server', name: "GPU-серверный кластер", cost: 3500, icon: "🖥️", desc: "Собственные серверы: увеличивают доход завершенных проектов на +20% и снижают затраты на 30%." },
    { id: 'optic', name: "Оптоволоконный гигабит", cost: 2000, icon: "⚡", desc: "Сверхскоростной канал: ручное написание кода приносит $100 вместо $50." },
    { id: 'security', name: "Биометрическая безопасность", cost: 4500, icon: "🛡️", desc: "Защищает серверы от атак, снижает риск багов и дает бонус к репутации +10." },
    { id: 'chairs', name: "Эргономичные кресла Herman Miller", cost: 5000, icon: "🛋️", desc: "Максимальный комфорт: повышает репутацию на +15, мораль команды и эффективность PR." }
];

// Каталог проектов по направлениям компании (30 проектов, 4 уровня технологической зрелости)
const directionProjectsCatalog = {
    ai: {
        companyName: "NeuroCorp AI",
        label: "IT & Нейросети",
        projects: [
            // Tier 1: Startup / MVP (Гараж, порог репутации: 40)
            { id: 1, tier: 1, name: "Telegram-бот для службы поддержки", progress: 0, maxProgress: 100, reward: 1000, passiveIncome: 45, serverCost: 5, completed: false, hasBug: false, fixCost: 60, cost: 250, minOfficeTier: 1, minReputation: 40, prereqId: null },
            { id: 2, tier: 1, name: "Семантический парсер резюме и вакансий", progress: 0, maxProgress: 180, reward: 1800, passiveIncome: 75, serverCost: 10, completed: false, hasBug: false, fixCost: 80, cost: 450, minOfficeTier: 1, minReputation: 45, prereqId: 1 },
            
            // Tier 2: Commercial B2B (Коворкинг, порог репутации: 50)
            { id: 3, tier: 2, name: "Мобильный сканер документов (OCR)", progress: 0, maxProgress: 400, reward: 4200, passiveIncome: 160, serverCost: 15, completed: false, hasBug: false, fixCost: 120, cost: 900, minOfficeTier: 2, minReputation: 50, prereqId: null },
            { id: 4, tier: 2, name: "Умный ассистент врача-диагноста", progress: 0, maxProgress: 600, reward: 6500, passiveIncome: 250, serverCost: 25, completed: false, hasBug: false, fixCost: 160, cost: 1400, minOfficeTier: 2, minReputation: 55, prereqId: 2 },
            { id: 5, tier: 2, name: "Нейросетевой переводчик реального времени", progress: 0, maxProgress: 800, reward: 8500, passiveIncome: 340, serverCost: 35, completed: false, hasBug: false, fixCost: 200, cost: 1900, minOfficeTier: 2, minReputation: 60, prereqId: null },
            
            // Tier 3: High-Load Enterprise (Бизнес-Центр, порог репутации: 65)
            { id: 6, tier: 3, name: "Генеративная модель изображений NeuroArt", progress: 0, maxProgress: 1200, reward: 14000, passiveIncome: 650, serverCost: 60, completed: false, hasBug: false, fixCost: 280, cost: 3000, minOfficeTier: 3, minReputation: 65, prereqId: 3 },
            { id: 7, tier: 3, name: "Предиктивная аналитика биржевых котировок", progress: 0, maxProgress: 1700, reward: 20000, passiveIncome: 900, serverCost: 85, completed: false, hasBug: false, fixCost: 380, cost: 4500, minOfficeTier: 3, minReputation: 70, prereqId: null },
            { id: 8, tier: 3, name: "Автономный автопилот для дронов логистики", progress: 0, maxProgress: 2300, reward: 28000, passiveIncome: 1250, serverCost: 110, completed: false, hasBug: false, fixCost: 480, cost: 6200, minOfficeTier: 3, minReputation: 75, prereqId: 6 },
            
            // Tier 4: Global Ecosystem (CyberTower, порог репутации: 80)
            { id: 9, tier: 4, name: "Облачная платформа корпоративного AI", progress: 0, maxProgress: 3500, reward: 50000, passiveIncome: 2200, serverCost: 200, completed: false, hasBug: false, fixCost: 800, cost: 10000, minOfficeTier: 4, minReputation: 80, prereqId: 7 },
            { id: 10, tier: 4, name: "Квантовая AGI-нейросеть мирового масштаба", progress: 0, maxProgress: 5200, reward: 85000, passiveIncome: 3800, serverCost: 350, completed: false, hasBug: false, fixCost: 1200, cost: 18000, minOfficeTier: 4, minReputation: 90, prereqId: 9 }
        ]
    },
    gamedev: {
        companyName: "PixelCraft Games",
        label: "GameDev Студия",
        projects: [
            // Tier 1: Startup / Indie (Гараж, порог репутации: 40)
            { id: 1, tier: 1, name: "Мобильный гиперказуальный раннер", progress: 0, maxProgress: 90, reward: 950, passiveIncome: 40, serverCost: 5, completed: false, hasBug: false, fixCost: 55, cost: 200, minOfficeTier: 1, minReputation: 40, prereqId: null },
            { id: 2, tier: 1, name: "Пиксельный ретро-платформер для веба", progress: 0, maxProgress: 170, reward: 1750, passiveIncome: 70, serverCost: 10, completed: false, hasBug: false, fixCost: 75, cost: 420, minOfficeTier: 1, minReputation: 45, prereqId: 1 },
            
            // Tier 2: Mid-Core Games (Коворкинг, порог репутации: 50)
            { id: 3, tier: 2, name: "Инди-головоломка в Steam", progress: 0, maxProgress: 380, reward: 4000, passiveIncome: 150, serverCost: 15, completed: false, hasBug: false, fixCost: 110, cost: 850, minOfficeTier: 2, minReputation: 50, prereqId: null },
            { id: 4, tier: 2, name: "Пошаговая тактическая RPG с прокачкой", progress: 0, maxProgress: 580, reward: 6200, passiveIncome: 240, serverCost: 25, completed: false, hasBug: false, fixCost: 150, cost: 1350, minOfficeTier: 2, minReputation: 55, prereqId: 2 },
            { id: 5, tier: 2, name: "VR-симулятор космической станции", progress: 0, maxProgress: 780, reward: 8200, passiveIncome: 330, serverCost: 35, completed: false, hasBug: false, fixCost: 190, cost: 1850, minOfficeTier: 2, minReputation: 60, prereqId: null },
            
            // Tier 3: Online & Competitive (Бизнес-Центр, порог репутации: 65)
            { id: 6, tier: 3, name: "Сетевой кооперативный шутер", progress: 0, maxProgress: 1100, reward: 13500, passiveIncome: 600, serverCost: 50, completed: false, hasBug: false, fixCost: 270, cost: 2800, minOfficeTier: 3, minReputation: 65, prereqId: 3 },
            { id: 7, tier: 3, name: "Королевская битва на 100 игроков (Battle Royale)", progress: 0, maxProgress: 1650, reward: 19500, passiveIncome: 880, serverCost: 80, completed: false, hasBug: false, fixCost: 360, cost: 4300, minOfficeTier: 3, minReputation: 70, prereqId: null },
            { id: 8, tier: 3, name: "Киберспортивная MOBA-арена с лигами", progress: 0, maxProgress: 2250, reward: 27000, passiveIncome: 1200, serverCost: 105, completed: false, hasBug: false, fixCost: 460, cost: 6000, minOfficeTier: 3, minReputation: 75, prereqId: 6 },
            
            // Tier 4: AAA Blockbusters & Metaverse (CyberTower, порог репутации: 80)
            { id: 9, tier: 4, name: "AAA RPG с открытым миром на Unreal", progress: 0, maxProgress: 3400, reward: 48000, passiveIncome: 2100, serverCost: 180, completed: false, hasBug: false, fixCost: 780, cost: 9500, minOfficeTier: 4, minReputation: 80, prereqId: 7 },
            { id: 10, tier: 4, name: "Кроссплатформенная Метавселенная CyberVerse", progress: 0, maxProgress: 5000, reward: 82000, passiveIncome: 3700, serverCost: 330, completed: false, hasBug: false, fixCost: 1150, cost: 17500, minOfficeTier: 4, minReputation: 90, prereqId: 9 }
        ]
    },
    cybersec: {
        companyName: "CyberShield Security",
        label: "Кибербезопасность",
        projects: [
            // Tier 1: Startup / Utility (Гараж, порог репутации: 40)
            { id: 1, tier: 1, name: "Анализатор утечек паролей пользователей", progress: 0, maxProgress: 110, reward: 1100, passiveIncome: 50, serverCost: 5, completed: false, hasBug: false, fixCost: 65, cost: 280, minOfficeTier: 1, minReputation: 40, prereqId: null },
            { id: 2, tier: 1, name: "Сканер SSL-сертификатов и уязвимостей", progress: 0, maxProgress: 190, reward: 1900, passiveIncome: 80, serverCost: 10, completed: false, hasBug: false, fixCost: 85, cost: 480, minOfficeTier: 1, minReputation: 45, prereqId: 1 },
            
            // Tier 2: B2B Server Protection (Коворкинг, порог репутации: 50)
            { id: 3, tier: 2, name: "Антивирусный сканер для серверов Linux", progress: 0, maxProgress: 420, reward: 4500, passiveIncome: 175, serverCost: 15, completed: false, hasBug: false, fixCost: 130, cost: 950, minOfficeTier: 2, minReputation: 50, prereqId: null },
            { id: 4, tier: 2, name: "Система анализа фишинга в корпоративной почте", progress: 0, maxProgress: 620, reward: 6800, passiveIncome: 260, serverCost: 25, completed: false, hasBug: false, fixCost: 170, cost: 1450, minOfficeTier: 2, minReputation: 55, prereqId: 2 },
            { id: 5, tier: 2, name: "Аудитор смарт-контрактов Web3 и DeFi", progress: 0, maxProgress: 820, reward: 8800, passiveIncome: 350, serverCost: 35, completed: false, hasBug: false, fixCost: 210, cost: 1950, minOfficeTier: 2, minReputation: 60, prereqId: null },
            
            // Tier 3: Enterprise SIEM & Anti-DDoS (Бизнес-Центр, порог репутации: 65)
            { id: 6, tier: 3, name: "Корпоративная система защиты от DDoS", progress: 0, maxProgress: 1250, reward: 15000, passiveIncome: 700, serverCost: 65, completed: false, hasBug: false, fixCost: 290, cost: 3200, minOfficeTier: 3, minReputation: 65, prereqId: 3 },
            { id: 7, tier: 3, name: "SOC-платформа мониторинга киберинцидентов (SIEM)", progress: 0, maxProgress: 1750, reward: 21000, passiveIncome: 940, serverCost: 90, completed: false, hasBug: false, fixCost: 390, cost: 4700, minOfficeTier: 3, minReputation: 70, prereqId: null },
            { id: 8, tier: 3, name: "Песочница поведенческого анализа малвари (Sandbox)", progress: 0, maxProgress: 2400, reward: 29000, passiveIncome: 1300, serverCost: 115, completed: false, hasBug: false, fixCost: 500, cost: 6500, minOfficeTier: 3, minReputation: 75, prereqId: 6 },
            
            // Tier 4: Defense / Quantum Infrastructure (CyberTower, порог репутации: 80)
            { id: 9, tier: 4, name: "Государственный файрвол с квантовым шифрованием", progress: 0, maxProgress: 3600, reward: 55000, passiveIncome: 2400, serverCost: 220, completed: false, hasBug: false, fixCost: 850, cost: 11000, minOfficeTier: 4, minReputation: 80, prereqId: 7 },
            { id: 10, tier: 4, name: "Автономный AI-щит глобальной киберзащиты", progress: 0, maxProgress: 5400, reward: 90000, passiveIncome: 4000, serverCost: 380, completed: false, hasBug: false, fixCost: 1300, cost: 19000, minOfficeTier: 4, minReputation: 90, prereqId: 9 }
        ]
    }
};

// Инсайдерские новости для биржи
const marketNewsSignals = [
    // Бычьи новости (рост)
    {
        type: 'bullish',
        tag: '📈 СИЛЬНЫЙ РОСТ',
        text: 'Крупный госзаказ: корпорациям выделены многомиллиардные гранты. Акции взлетят!',
        trend: 1
    },
    {
        type: 'bullish',
        tag: '📈 ПОЗИТИВНЫЙ ТРЕНД',
        text: 'Технологический сектор отчитался о рекордной квартальной прибыли. Курс растет.',
        trend: 1
    },
    {
        type: 'bullish',
        tag: '📈 ИНСАЙДЕРСКИЙ РОСТ',
        text: 'Венчурные фонды выкупают технологические активы. Отличное время для покупки!',
        trend: 1
    },

    // Медвежьи новости (падение)
    {
        type: 'bearish',
        tag: '📉 РЕЗКИЙ СПАД',
        text: 'Антимонопольный комитет начал расследование IT-гигантов. Котировки падают!',
        trend: -1
    },
    {
        type: 'bearish',
        tag: '📉 КРИЗИСНЫЙ СИГНАЛ',
        text: 'Глобальный дефицит полупроводников парализовал поставки оборудования. Срочно продавайте!',
        trend: -1
    },
    {
        type: 'bearish',
        tag: '📉 ПАНИКА НА БИРЖЕ',
        text: 'Массовая распродажа технологических акций из-за инфляции. Цены на дне.',
        trend: -1
    }
];

let gameLoopTimer = null;
let marketTimer = null;
let chartCanvas, chartCtx;

// ============================================================================
// 2. ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ СТРАНИЦЫ
// ============================================================================

window.addEventListener('DOMContentLoaded', () => {
    chartCanvas = document.getElementById('market-chart');
    chartCtx = chartCanvas.getContext('2d');

    checkSavedGameAvailable();
    initMenuEventListeners();
    initInGameEventListeners();
});

/**
 * Проверяет наличие сохранения в памяти браузера для показа кнопки "Продолжить"
 */
function checkSavedGameAvailable() {
    const save = localStorage.getItem('cybertycoon_save');
    const continueBtn = document.getElementById('menu-btn-continue');
    if (save && continueBtn) {
        continueBtn.style.display = 'block';
    }
}

// ============================================================================
// 3. УПРАВЛЕНИЕ МЕНЮ И ЭКРАНАМИ (STATE MACHINE)
// ============================================================================

function initMenuEventListeners() {
    // Кнопка "Играть" в главном меню -> открывает модалку выбора направления
    document.getElementById('menu-btn-play').addEventListener('click', () => {
        openModal('direction-modal');
        playTone(523, 0.1);
    });

    // Кнопка "Продолжить"
    document.getElementById('menu-btn-continue').addEventListener('click', () => {
        loadGameFromStorage();
        playTone(659, 0.12);
    });

    // Кнопка "Обучение"
    document.getElementById('menu-btn-tutorial').addEventListener('click', () => {
        openModal('tutorial-modal');
        playTone(440, 0.1);
    });

    // Кнопка "Настройки"
    document.getElementById('menu-btn-settings').addEventListener('click', () => {
        openModal('settings-modal');
        playTone(440, 0.1);
    });

    // Кнопка "О проекте"
    document.getElementById('menu-btn-about').addEventListener('click', () => {
        openModal('about-modal');
        playTone(440, 0.1);
    });

    // Кнопка "В главное меню" из шапки игры
    document.getElementById('btn-back-to-menu').addEventListener('click', () => {
        if (confirm("Вернуться в главное меню? Не забудьте сохранить игру!")) {
            stopGameTimers();
            document.getElementById('game-screen').classList.add('hidden');
            document.getElementById('main-menu-screen').classList.remove('hidden');
            checkSavedGameAvailable();
        }
    });
}

/**
 * Старт новой игры с выбранным направлением компании
 */
window.selectCompanyDirection = function(dirKey) {
    const catalog = directionProjectsCatalog[dirKey];
    gameState.direction = dirKey;
    gameState.companyName = catalog.companyName;
    gameState.directionLabel = catalog.label;
    gameState.projects = JSON.parse(JSON.stringify(catalog.projects)); // глубокая копия
    gameState.money = 6000;
    gameState.day = 1;
    gameState.reputation = 50;
    gameState.morale = 85;
    gameState.stocks.price = 100;
    gameState.stocks.floatPrice = 100.0;
    gameState.stocks.history = [100];
    gameState.stocks.userOwned = 0;
    gameState.stocks.marketTrend = 0;
    gameState.officeTier = 1;
    gameState.upgrades = [];

    // Сброс персонала
    for (const emp of Object.values(gameState.employees)) {
        emp.count = 0;
    }

    closeModal('direction-modal');
    switchToGameScreen();
};

/**
 * Переключение интерфейса из меню в экран симуляции
 */
function switchToGameScreen() {
    document.getElementById('main-menu-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    // Обновляем шапку
    document.getElementById('company-name-display').innerText = gameState.companyName;
    document.getElementById('company-dir-display').innerText = gameState.directionLabel;

    initHireCards();
    renderProjects();
    renderOfficeTab();
    updateUI();

    // Мгновенная синхронизация котировок акций и кнопки покупки при переключении экрана
    const stockPriceEl = document.getElementById('stock-price');
    if (stockPriceEl) stockPriceEl.innerText = `$${gameState.stocks.price}`;
    const buyBtn = document.getElementById('buy-share-btn');
    if (buyBtn) buyBtn.innerText = `Купить ($${gameState.stocks.price})`;
    const userSharesEl = document.getElementById('user-shares');
    if (userSharesEl) userSharesEl.innerText = gameState.stocks.userOwned;

    drawStockChart();

    startGameLoop(gameState.tickSpeed);
    startMarketSimulation();
    playTone(587, 0.15);
}

// ============================================================================
// 4. ОТДЕЛ КАДРОВ (HR): НАЙМ И УВОЛЬНЕНИЕ СОТРУДНИКОВ
// ============================================================================

/**
 * Генерация карточек вакансий с кнопками Нанять (+) и Уволить (-)
 */
function initHireCards() {
    const container = document.getElementById('hire-list');
    container.innerHTML = '';

    for (const [key, emp] of Object.entries(gameState.employees)) {
        const card = document.createElement('div');
        card.className = 'hire-card';
        card.innerHTML = `
            <div class="hire-info">
                <h4>${emp.name}</h4>
                <div class="hire-stats">
                    ${emp.devPower ? `Код: +${emp.devPower}/день | ` : ''}
                    ${emp.repPower ? `PR: +${emp.repPower}/день | ` : ''}
                    З/П: <strong>$${emp.salary}</strong>/день
                </div>
            </div>
            <div class="hire-actions">
                <button class="btn btn-danger btn-sm" onclick="fireEmployee('${key}')" title="Уволить сотрудника">− Уволить</button>
                <span class="hire-count-badge" id="emp-count-${key}">${emp.count}</span>
                <button class="btn btn-success btn-sm" onclick="hireEmployee('${key}')" title="Нанять сотрудника">+ Нанять</button>
            </div>
        `;
        container.appendChild(card);
    }
}

/**
 * Нанять сотрудника (+1) с проверкой вместимости текущего офиса
 * Списывает первую зарплату, увеличивает счетчик вакансии и синхронизирует интерфейс.
 * @param {string} type - Категория специалиста ('junior' | 'middle' | 'senior' | 'marketer')
 */
window.hireEmployee = function(type) {
    const currentOffice = officeTiers.find(o => o.tier === gameState.officeTier) || officeTiers[0];
    const totalCurrentEmployees = getTotalEmployees();

    // Проверка лимита рабочих мест в текущем здании
    if (totalCurrentEmployees >= currentOffice.maxEmployees) {
        alert(`⚠️ В офисе "${currentOffice.name}" закончились свободные места (лимит: ${currentOffice.maxEmployees})!\n\nПерейдите на вкладку «🏢 Штаб-квартира и Апгрейды» и арендуйте более просторный офис.`);
        return;
    }

    const emp = gameState.employees[type];
    if (gameState.money >= emp.salary) {
        gameState.money -= emp.salary;
        emp.count++;
        const empCountEl = document.getElementById(`emp-count-${type}`);
        if (empCountEl) empCountEl.innerText = emp.count;
        addFeedMessage(`Нанят сотрудник: ${emp.name} (З/П: $${emp.salary}/день)`);
        playTone(659, 0.08);
        renderOfficeTab();
        updateUI();
    } else {
        alert("Недостаточно денег для найма (нужно оплатить первую ставку)!");
    }
};

/**
 * Уволить сотрудника (-1)
 * Уменьшает численность сотрудников выбранной специальности и моментально сокращает расходы ФОТ.
 * @param {string} type - Категория специалиста ('junior' | 'middle' | 'senior' | 'marketer')
 */
window.fireEmployee = function(type) {
    const emp = gameState.employees[type];
    if (emp && emp.count > 0) {
        emp.count--;
        const empCountEl = document.getElementById(`emp-count-${type}`);
        if (empCountEl) empCountEl.innerText = emp.count;
        addFeedMessage(`Уволен сотрудник: ${emp.name}. Расходы на зарплату снижены на $${emp.salary}/день.`);
        playTone(330, 0.08);
        renderOfficeTab();
        updateUI();
    } else {
        alert("У вас нет нанятых сотрудников этой специальности!");
    }
};

// ============================================================================
// 5. ЦЕНТР R&D: РАЗРАБОТКА ПРОЕКТОВ И ДЕРЕВО ТЕХНОЛОГИЙ
// ============================================================================

/**
 * Проверяет, завершен ли проект с указанным идентификатором.
 * 
 * @param {string|number} projectId - ID проекта для проверки
 * @returns {boolean} true, если проект успешно завершен и находится в продакшене
 */
function isProjectCompleted(projectId) {
    const p = (gameState.projects || []).find(x => String(x.id) === String(projectId));
    return p ? Boolean(p.completed) : false;
}

/**
 * Проверяет, разблокирован ли проект для разработки (Tree Unlock Engine).
 * Проект доступен игроку, если одновременно соблюдены условия:
 * 1. Уровень текущего офиса компании >= minOfficeTier
 * 2. Репутация компании >= minReputation
 * 3. Проект-предшественник (prereqId) успешно завершен
 * 
 * @param {Object} project - Проверяемый проект
 * @returns {boolean} true, если проект доступен, иначе false
 */
function isProjectUnlocked(project) {
    if (!project) return false;

    // 1. Проверка минимального уровня офиса компании
    if (project.minOfficeTier && gameState.officeTier < project.minOfficeTier) {
        return false;
    }

    // 2. Проверка минимального порога корпоративной репутации
    if (project.minReputation && gameState.reputation < project.minReputation) {
        return false;
    }

    // 3. Проверка предшествующего проекта в технологическом дереве (дерево зависимостей)
    if (project.prereqId) {
        const prereq = (gameState.projects || []).find(p => String(p.id) === String(project.prereqId));
        if (!prereq || !prereq.completed) {
            return false;
        }
    }

    return true;
}

/**
 * Отрисовка списка исследовательских и коммерческих проектов компании (R&D Showcase)
 * Отображает тир проекта, серверную нагрузку, прогресс разработки, статус продакшена,
 * блокировки технологического дерева и кнопки устранения багов (Bug Triage).
 */
function renderProjects() {
    const container = document.getElementById('active-projects-list');
    if (!container) return;
    container.innerHTML = '';

    const serverDiscount = (gameState.upgrades && gameState.upgrades.includes('server')) ? 0.70 : 1.0;
    const passiveMultiplier = (gameState.upgrades && gameState.upgrades.includes('server')) ? 1.20 : 1.0;

    gameState.projects.forEach(project => {
        const card = document.createElement('div');
        const unlocked = isProjectUnlocked(project);
        const percent = Math.min(100, Math.floor(((project.progress || 0) / project.maxProgress) * 100));

        let cardClass = 'project-card';
        if (!unlocked) cardClass += ' locked';
        if (project.hasBug) cardClass += ' bugged';
        if (project.completed) cardClass += ' completed';
        card.className = cardClass;

        // Определение статусного бейджа проекта
        let statusBadge = '';
        if (!unlocked) {
            statusBadge = `<span class="badge text-yellow">🔒 ЗАБЛОКИРОВАН</span>`;
        } else if (project.completed) {
            if (project.hasBug) {
                statusBadge = `<span class="badge text-red">⚠️ БАГ (-50% дохода)</span>`;
            } else {
                statusBadge = `<span class="badge text-green">✓ В ПРОДАКШЕНЕ</span>`;
            }
        } else {
            statusBadge = `<span class="badge text-cyan">${percent}%</span>`;
        }

        // Формирование пояснения блокировки, если проект еще недоступен
        let lockReasonHtml = '';
        if (!unlocked) {
            const reasons = [];
            if (project.minOfficeTier && gameState.officeTier < project.minOfficeTier) {
                const reqOffice = officeTiers.find(o => o.tier === project.minOfficeTier);
                reasons.push(`Офис: «${reqOffice ? reqOffice.name : 'Ур.' + project.minOfficeTier}»`);
            }
            if (project.minReputation && gameState.reputation < project.minReputation) {
                reasons.push(`Репутация: ⭐ ${project.minReputation}`);
            }
            if (project.prereqId) {
                const prereq = gameState.projects.find(p => String(p.id) === String(project.prereqId));
                reasons.push(`Завершить: «${prereq ? prereq.name : 'Проект #' + project.prereqId}»`);
            }
            lockReasonHtml = `<div class="lock-reason"><small>🔒 Требуется: ${reasons.join(', ')}</small></div>`;
        }

        // Финансовые показатели проекта с учетом скидок и множителей
        const effectivePassive = project.hasBug
            ? Math.round(project.passiveIncome * 0.5 * passiveMultiplier)
            : Math.round(project.passiveIncome * passiveMultiplier);
        const effectiveServer = Math.round((project.serverCost || 0) * serverDiscount);

        card.innerHTML = `
            <div class="project-card-header">
                <div>
                    <strong>${project.name}</strong>
                    <div class="project-tier-tag">Tier ${project.tier || 1} • Сервер: $${effectiveServer}/день</div>
                </div>
                ${statusBadge}
            </div>

            ${lockReasonHtml}

            <div class="progress-bar-bg">
                <div class="progress-bar-fill ${project.hasBug ? 'bar-bugged' : ''}" style="width: ${percent}%;"></div>
            </div>

            <div class="project-footer">
                <div>
                    <span>Пассивный доход: <strong class="${project.hasBug ? 'text-yellow' : 'text-green'}">+$${effectivePassive}/день</strong></span>
                    <span class="project-reward-tag">Грант: $${project.reward.toLocaleString()}</span>
                </div>

                <div class="project-actions">
                    ${!project.completed ? (
                        unlocked ? `
                            <button class="btn btn-secondary btn-sm" onclick="investInProject(${project.id})">
                                Инвестировать ($${project.cost})
                            </button>
                        ` : `
                            <button class="btn btn-secondary btn-sm" disabled title="Условия разблокировки не выполнены">
                                🔒 Недоступно
                            </button>
                        `
                    ) : (
                        project.hasBug ? `
                            <button class="btn btn-warning btn-sm" onclick="fixProjectBug('${project.id}')">
                                🔧 Исправить баг ($${project.fixCost || 80})
                            </button>
                        ` : `
                            <span class="text-green status-active">✓ Приносит прибыль</span>
                        `
                    )}
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

/**
 * Ручное инвестирование капитала в ускорение разработки выбранного проекта
 * @param {number|string} projectId - Идентификатор проекта
 */
window.investInProject = function(projectId) {
    const project = gameState.projects.find(p => String(p.id) === String(projectId));
    if (!project || project.completed) return;

    if (!isProjectUnlocked(project)) {
        alert("Этот проект пока заблокирован! Проверьте требования: уровень офиса, репутацию или предшествующие проекты.");
        return;
    }

    if (gameState.money >= project.cost) {
        gameState.money -= project.cost;
        project.progress += Math.floor(project.maxProgress * 0.25);
        if (project.progress >= project.maxProgress) {
            completeProject(project);
        }
        renderProjects();
        updateUI();
        playTone(784, 0.1);
    } else {
        alert("Недостаточно средств для инвестирования в проект!");
    }
};

/**
 * Успешный релиз проекта в продакшен (завершение разработки)
 * Начисляет грантовую премию, увеличивает репутацию компании и уведомляет в ленте событий.
 * @param {Object} project - Завершенный проект
 */
function completeProject(project) {
    project.completed = true;
    gameState.money += project.reward;
    gameState.reputation = Math.min(100, gameState.reputation + 6);
    addFeedMessage(`🎉 Проект "${project.name}" завершен! Получена грантовая премия +$${project.reward.toLocaleString()}!`);
    playTone(880, 0.2);
}

/**
 * Устранение технического сбоя (бага) в релизном проекте (Bug Triage / Hotfix)
 * Списывает стоимость исправления (fixCost) и восстанавливает полную пассивную доходность.
 * 
 * @param {string|number} projectId - ID проекта для исправления бага
 */
window.fixProjectBug = function(projectId) {
    const project = (gameState.projects || []).find(p => String(p.id) === String(projectId));
    if (project && project.hasBug) {
        const cost = project.fixCost || 80;
        gameState.money -= cost;
        project.hasBug = false;
        addFeedMessage(`🔧 Критический баг в проекте "${project.name}" успешно устранен! Выручка восстановлена.`);
        playTone(659, 0.1);
        renderProjects();
        updateUI();
    }
};

// ============================================================================
// 5.1 УПРАВЛЕНИЕ ВКЛАДКАМИ И ШТАБ-КВАРТИРОЙ
// ============================================================================

let currentActiveCentralTab = 'rd';

/**
 * Переключение между 4 вкладками центральной панели:
 * - 'rd': Центр исследований и разработок (R&D проекты)
 * - 'office': Штаб-квартира и уровни офиса
 * - 'bi': Финансовый BI-дашборд и отчет P&L (Profit & Loss)
 * - 'devops': Инфраструктура DevOps и серверная стойка
 */
window.switchCentralTab = function(tabName) {
    currentActiveCentralTab = tabName;
    const allTabs = ['rd', 'office', 'bi', 'devops'];

    allTabs.forEach(t => {
        const content = document.getElementById(`tab-content-${t}`);
        const btn = document.getElementById(`tab-btn-${t}`);
        if (content) {
            if (t === tabName) {
                content.classList.remove('hidden');
            } else {
                content.classList.add('hidden');
            }
        }
        if (btn) {
            if (t === tabName) {
                btn.classList.add('active-tab');
            } else {
                btn.classList.remove('active-tab');
            }
        }
    });

    if (tabName === 'office') {
        renderOfficeTab();
    } else if (tabName === 'bi') {
        renderBiTab();
    } else if (tabName === 'devops') {
        renderDevopsTab();
    }
    playTone(500, 0.05);
};

/**
 * Логирование коммитов в терминал разработчика
 */
function logGitCommit(actionMessage) {
    const feed = document.getElementById('terminal-feed');
    if (!feed) return;

    const hashes = ['a7f2c1', 'b4e9d0', 'f3c8a2', '91d5e4', 'c6b2a8', '70e1f9'];
    const randomHash = hashes[Math.floor(Math.random() * hashes.length)];
    const line = document.createElement('div');
    line.className = 'term-line success';
    line.innerText = `[git:main] ${randomHash} - ${actionMessage}`;
    feed.prepend(line);

    while (feed.children.length > 6) {
        feed.removeChild(feed.lastChild);
    }
}

/**
 * Отрисовка финансового BI-дашборда и отчета P&L
 */
function renderBiTab() {
    const summaryContainer = document.getElementById('bi-summary-cards');
    const pnlContainer = document.getElementById('pnl-statement-container');
    if (!summaryContainer || !pnlContainer) return;

    // 1. Расчет финансовых показателей
    const passiveMultiplier = gameState.upgrades.includes('server') ? 1.20 : 1.0;
    let grossRevenue = 0;
    for (const p of gameState.projects) {
        if (p.completed) {
            let inc = p.passiveIncome || 0;
            if (p.hasBug) inc = Math.round(inc * 0.5);
            grossRevenue += Math.round(inc * passiveMultiplier);
        }
    }

    let salaries = 0;
    for (const emp of Object.values(gameState.employees)) {
        salaries += (emp.count || 0) * (emp.salary || 0);
    }

    const serverDiscount = gameState.upgrades.includes('server') ? 0.70 : 1.0;
    let serverCosts = 0;
    for (const p of gameState.projects) {
        if (p.completed && p.serverCost) {
            serverCosts += Math.round(p.serverCost * serverDiscount);
        }
    }

    const netProfit = grossRevenue - salaries - serverCosts;
    const marginPct = grossRevenue > 0 ? Math.round((netProfit / grossRevenue) * 100) : 0;
    const burnRate = netProfit < 0 ? Math.abs(netProfit) : 0;
    const runwayDays = burnRate > 0 ? Math.max(0, Math.floor(gameState.money / burnRate)) : '∞ (профицит)';

    // 2. Карточки финансовой сводки
    summaryContainer.innerHTML = `
        <div class="bi-card">
            <div class="bi-card-label">Выручка / день</div>
            <div class="bi-card-value text-green">+$${grossRevenue.toLocaleString()}</div>
        </div>
        <div class="bi-card">
            <div class="bi-card-label">Расходы (OPEX)</div>
            <div class="bi-card-value text-red">-$${(salaries + serverCosts).toLocaleString()}</div>
        </div>
        <div class="bi-card">
            <div class="bi-card-label">Маржинальность</div>
            <div class="bi-card-value ${marginPct >= 0 ? 'text-green' : 'text-red'}">${marginPct}%</div>
        </div>
        <div class="bi-card">
            <div class="bi-card-label">Runway (Запас)</div>
            <div class="bi-card-value text-cyan">${typeof runwayDays === 'number' ? runwayDays + ' дн.' : runwayDays}</div>
        </div>
    `;

    // 3. Бухгалтерская таблица P&L
    pnlContainer.innerHTML = `
        <table class="pnl-table">
            <thead>
                <tr>
                    <th>Статья финансового учета</th>
                    <th>Категория</th>
                    <th style="text-align: right;">Сумма (USD/сутки)</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Пассивный доход от сданных продуктов</td>
                    <td><span class="badge" style="background:#238636;">Выручка</span></td>
                    <td style="text-align: right; color:#3fb950;">+$${grossRevenue.toLocaleString()}</td>
                </tr>
                <tr>
                    <td>Фонд оплаты труда программистов (ФОТ)</td>
                    <td><span class="badge" style="background:#da3633;">OPEX</span></td>
                    <td style="text-align: right; color:#f85149;">-$${salaries.toLocaleString()}</td>
                </tr>
                <tr>
                    <td>Облачные сервера и хостинг инфраструктуры</td>
                    <td><span class="badge" style="background:#da3633;">OPEX</span></td>
                    <td style="text-align: right; color:#f85149;">-$${serverCosts.toLocaleString()}</td>
                </tr>
                <tr class="total-row">
                    <td>ИТОГОВОЕ САЛЬДО (EBITDA / Чистая прибыль)</td>
                    <td><span class="badge" style="background:#1f6feb;">Net Total</span></td>
                    <td style="text-align: right; color:${netProfit >= 0 ? '#3fb950' : '#f85149'};">
                        ${netProfit >= 0 ? '+' : '-'}$${Math.abs(netProfit).toLocaleString()} / день
                    </td>
                </tr>
                <tr>
                    <td>Капитал на расчетном счете компании</td>
                    <td><span class="badge" style="background:#8957e5;">Баланс</span></td>
                    <td style="text-align: right; font-weight: bold;">$${gameState.money.toLocaleString()}</td>
                </tr>
            </tbody>
        </table>
    `;
}

/**
 * Экспорт финансового отчета в формате CSV
 */
window.exportFinancialReportCSV = function() {
    const net = calculateNetDailyProfit();
    let salaries = 0;
    for (const emp of Object.values(gameState.employees)) salaries += (emp.count || 0) * (emp.salary || 0);
    const serverDiscount = gameState.upgrades.includes('server') ? 0.70 : 1.0;
    let serverCosts = 0;
    for (const p of gameState.projects) if (p.completed && p.serverCost) serverCosts += Math.round(p.serverCost * serverDiscount);
    let gross = 0;
    const passiveMultiplier = gameState.upgrades.includes('server') ? 1.20 : 1.0;
    for (const p of gameState.projects) if (p.completed) gross += Math.round((p.passiveIncome || 0) * (p.hasBug ? 0.5 : 1.0) * passiveMultiplier);

    const rows = [
        ["Статья учета", "Сумма USD", "Категория", "День симуляции"],
        ["Валовая выручка", gross, "Доходы", gameState.day],
        ["ФОТ зарплаты", -salaries, "OPEX Расходы", gameState.day],
        ["Серверный хостинг", -serverCosts, "OPEX Расходы", gameState.day],
        ["Чистая прибыль в сутки", net, "Сальдо", gameState.day],
        ["Остаток на балансе компании", gameState.money, "Активы", gameState.day],
        ["Корпоративная репутация", gameState.reputation, "Нематериальные активы", gameState.day]
    ];

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Financial_Report_Day_${gameState.day}_${gameState.companyName || 'CyberTycoon'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addLog(`Финансовый отчет успешно экспортирован в CSV (День ${gameState.day})`, 'success');
    playTone(600, 0.08);
};

/**
 * Отрисовка серверной стойки и инфраструктурных метрик DevOps
 */
function renderDevopsTab() {
    const rackContainer = document.getElementById('server-rack-display');
    if (!rackContainer) return;

    const totalEmployees = getTotalEmployees();
    const completedCount = gameState.projects.filter(p => p.completed).length;

    // Динамический расчет нагрузки
    const cpuLoad = Math.min(98, Math.max(12, 18 + totalEmployees * 5 + completedCount * 2));
    const ramLoad = Math.min(95, Math.max(20, 25 + completedCount * 4 + (gameState.upgrades.includes('server') ? -10 : 5)));
    const dbIops = 1200 + completedCount * 450;
    const traffic = (0.8 + completedCount * 0.4).toFixed(1);

    rackContainer.innerHTML = `
        <div class="rack-unit" style="border-left-color: #38bdf8;">
            <div class="rack-unit-top">
                <span class="rack-title"><span class="rack-led"></span> U1: Nginx API Gateway & Reverse Proxy</span>
                <span class="badge" style="background: rgba(56, 189, 248, 0.2); color: #38bdf8;">ONLINE (SLA 99.98%)</span>
            </div>
            <div class="rack-metrics-row">
                <span>Пинг: <strong>14 ms</strong></span>
                <span>Трафик: <strong>${traffic} Гб/с</strong></span>
                <span>SSL: <strong>TLS 1.3 Valid</strong></span>
            </div>
        </div>

        <div class="rack-unit" style="border-left-color: #2ea043;">
            <div class="rack-unit-top">
                <span class="rack-title"><span class="rack-led"></span> U2: Distributed Neural Compute & Workers</span>
                <span style="font-size: 0.8rem; color: #8b949e;">CPU: ${cpuLoad}%</span>
            </div>
            <div class="rack-bar-bg">
                <div class="rack-bar-fill" style="width: ${cpuLoad}%; background: ${cpuLoad > 80 ? '#f85149' : '#2ea043'};"></div>
            </div>
            <div class="rack-metrics-row">
                <span>Потоки вычислений: <strong>${totalEmployees * 8 + 16} Threads</strong></span>
                <span>Worker Nodes: <strong>${Math.max(2, Math.floor(completedCount / 2) + 2)} шт.</strong></span>
            </div>
        </div>

        <div class="rack-unit" style="border-left-color: #e3b341;">
            <div class="rack-unit-top">
                <span class="rack-title"><span class="rack-led"></span> U3: PostgreSQL High-Load Database Cluster</span>
                <span style="font-size: 0.8rem; color: #8b949e;">RAM: ${ramLoad}%</span>
            </div>
            <div class="rack-bar-bg">
                <div class="rack-bar-fill" style="width: ${ramLoad}%; background: ${ramLoad > 80 ? '#f85149' : '#e3b341'};"></div>
            </div>
            <div class="rack-metrics-row">
                <span>IOPS: <strong>${dbIops} req/s</strong></span>
                <span>Пул соединений: <strong>${totalEmployees * 5 + 20}/500</strong></span>
                <span>Репликация: <strong>Синхронная (0.1ms)</strong></span>
            </div>
        </div>

        <div class="rack-unit" style="border-left-color: #a371f7;">
            <div class="rack-unit-top">
                <span class="rack-title"><span class="rack-led"></span> U4: Redis Micro-Cache & Global CDN Node</span>
                <span class="badge" style="background: rgba(163, 113, 247, 0.2); color: #a371f7;">HIT RATE 96.4%</span>
            </div>
            <div class="rack-metrics-row">
                <span>Кэшировано ключей: <strong>${(completedCount * 1240 + 520).toLocaleString()}</strong></span>
                <span>DDoS Shield: <strong>Cloudflare Enterprise</strong></span>
            </div>
        </div>
    `;
}

/**
 * Оптимизация кэша и перезагрузка кластера серверов
 */
window.optimizeDevOpsServers = function() {
    addLog(`[DevOps] Кластер серверов оптимизирован: Redis-кэш сброшен, сетевая задержка снижена до 11ms!`, 'success');
    renderDevopsTab();
    playTone(750, 0.1);
};

/**
 * Отрисовка вкладки недвижимости и апгрейдов оборудования
 */
function renderOfficeTab() {
    const currentOffice = officeTiers.find(o => o.tier === gameState.officeTier) || officeTiers[0];
    const nextOffice = officeTiers.find(o => o.tier === gameState.officeTier + 1);
    const totalCurrentEmployees = Object.values(gameState.employees).reduce((sum, e) => sum + e.count, 0);

    // 1. Карточка текущего офиса и переезда
    const showcase = document.getElementById('office-showcase');
    if (showcase) {
        showcase.innerHTML = `
            <div class="office-details">
                <h3>${currentOffice.icon} ${currentOffice.name} <span class="badge text-cyan">Уровень ${currentOffice.tier}</span></h3>
                <p>${currentOffice.desc}</p>
                <p style="margin-top: 6px;">
                    Вместимость: <strong>${totalCurrentEmployees} / ${currentOffice.maxEmployees === 999 ? 'Безлимит' : currentOffice.maxEmployees}</strong> рабочих мест | 
                    Бонус скорости: <strong>+${Math.round((currentOffice.speedBuff - 1) * 100)}%</strong>
                </p>
            </div>
            <div>
                ${nextOffice ? `
                    <button class="btn btn-primary" onclick="upgradeOfficeTier()">
                        Переехать в «${nextOffice.name}» ($${nextOffice.cost.toLocaleString()})
                    </button>
                ` : `<span class="badge text-green">✓ МАКСИМАЛЬНЫЙ УРОВЕНЬ ОФИСА</span>`}
            </div>
        `;
    }

    // 2. Сетка оборудования
    const grid = document.getElementById('upgrades-grid');
    if (grid) {
        grid.innerHTML = '';
        equipmentCatalog.forEach(item => {
            const isBought = gameState.upgrades.includes(item.id);
            const card = document.createElement('div');
            card.className = `upgrade-card ${isBought ? 'purchased' : ''}`;
            card.innerHTML = `
                <div>
                    <div class="upgrade-card-header">
                        <span class="upgrade-icon">${item.icon}</span>
                        <h4>${item.name}</h4>
                    </div>
                    <p class="upgrade-desc">${item.desc}</p>
                </div>
                <div>
                    ${isBought ? `
                        <span class="badge text-green">✓ Установлено</span>
                    ` : `
                        <button class="btn btn-success btn-sm btn-block" onclick="buyEquipment('${item.id}')">
                            Купить ($${item.cost.toLocaleString()})
                        </button>
                    `}
                </div>
            `;
            grid.appendChild(card);
        });
    }
}

/**
 * Переезд в офис следующего уровня
 */
window.upgradeOfficeTier = function() {
    const nextOffice = officeTiers.find(o => o.tier === gameState.officeTier + 1);
    if (!nextOffice) return;

    if (gameState.money >= nextOffice.cost) {
        gameState.money -= nextOffice.cost;
        gameState.officeTier = nextOffice.tier;
        gameState.reputation += nextOffice.repBuff;
        addFeedMessage(`🏢 Компания переехала в новый офис: «${nextOffice.name}»! Лимит мест увеличен до ${nextOffice.maxEmployees}.`);
        playTone(784, 0.2);
        renderOfficeTab();
        updateUI();
    } else {
        alert(`Недостаточно средств для аренды нового офиса! Требуется $${nextOffice.cost.toLocaleString()}`);
    }
};

/**
 * Покупка оборудования и улучшений для офиса и серверов
 * Применяет мгновенные бонусы, списывает стоимость и реактивно обновляет UI.
 * @param {string} upgradeId - Уникальный идентификатор улучшения ('coffee' | 'server' | 'optic' | 'security' | 'chairs')
 */
window.buyEquipment = function(upgradeId) {
    if (gameState.upgrades.includes(upgradeId)) return;
    const item = equipmentCatalog.find(u => u.id === upgradeId);
    if (!item) return;

    if (gameState.money >= item.cost) {
        gameState.money -= item.cost;
        gameState.upgrades.push(upgradeId);

        if (upgradeId === 'security') gameState.reputation += 10;
        if (upgradeId === 'chairs') gameState.reputation += 15;

        // Мгновенная реактивность кнопки ручного написания кода при покупке Оптоволоконного гигабита
        if (upgradeId === 'optic') {
            const clickBtn = document.getElementById('start-click-work');
            if (clickBtn) {
                clickBtn.innerText = '⚡ Написать код вручную (+$100)';
            }
        }

        addFeedMessage(`⚙️ Приобретено улучшение: ${item.name}!`);
        playTone(659, 0.15);
        renderOfficeTab();
        updateUI();
    } else {
        alert(`Недостаточно средств для покупки оборудования! Требуется $${item.cost.toLocaleString()}`);
    }
};

// ============================================================================
// 6. ИГРОВОЙ ЦИКЛ (GAME TICK & LOOP)
// ============================================================================

function startGameLoop(speedMs = 3000) {
    if (gameLoopTimer) clearInterval(gameLoopTimer);
    gameState.tickSpeed = speedMs;

    gameLoopTimer = setInterval(() => {
        if (gameState.isPaused) return;

        gameState.day++;

        // Офисные и технические множители (баффы оборудования)
        const currentOffice = officeTiers.find(o => o.tier === gameState.officeTier) || officeTiers[0];
        let devMultiplier = currentOffice.speedBuff;
        if (gameState.upgrades.includes('coffee')) devMultiplier *= 1.15;
        if (gameState.upgrades.includes('chairs')) devMultiplier *= 1.10;

        // Множитель психологического климата и морали команды (Morale Impact)
        let moraleMultiplier = 1.0;
        const currentMorale = (gameState.morale !== undefined ? gameState.morale : 85);
        if (currentMorale >= 90) {
            moraleMultiplier = 1.20; // Высокая вовлеченность (+20% к производительности)
        } else if (currentMorale < 40) {
            moraleMultiplier = 0.50; // Профессиональное выгорание (-50% к производительности)
        }

        let passiveMultiplier = 1.0;
        if (gameState.upgrades.includes('server')) passiveMultiplier *= 1.20;

        // 1. Расчет эффективности разработчиков и авто-триаж багов
        let totalDevPower = 0;

        for (const emp of Object.values(gameState.employees)) {
            if (emp.devPower) totalDevPower += Math.round(emp.count * emp.devPower * devMultiplier * moraleMultiplier);
            if (emp.repPower) {
                const repBonus = gameState.upgrades.includes('chairs') ? 1.25 : 1.0;
                gameState.reputation = Math.min(100, gameState.reputation + (emp.count * emp.repPower * 0.1 * repBonus));
            }
        }

        // Автоматический триаж багов Senior-тимлидами
        const seniorCount = (gameState.employees && gameState.employees.senior) ? gameState.employees.senior.count : 0;
        if (seniorCount > 0 && Array.isArray(gameState.projects)) {
            gameState.projects.forEach(p => {
                if (p.hasBug && Math.random() < 0.25 * seniorCount) {
                    p.hasBug = false;
                    addFeedMessage(`🛡️ Senior тимлид автоматически локализовал и устранил баг в "${p.name}".`);
                }
            });
        }

        // 2. Случайное возникновение технических инцидентов (Production Bugs) в релизных проектах
        // 1.5% шанс в день (снижается до 0.5% при наличии биометрической безопасности и аудита)
        const bugChance = (gameState.upgrades && gameState.upgrades.includes('security')) ? 0.005 : 0.015;
        if (Array.isArray(gameState.projects)) {
            gameState.projects.forEach(p => {
                if (p.completed && !p.hasBug && Math.random() < bugChance) {
                    p.hasBug = true;
                    p.fixCost = Math.max(60, Math.round((p.reward || 1000) * 0.05));
                    addFeedMessage(`⚠️ В продакшене проекта "${p.name}" возник критический сбой! Доход снижен на 50%.`);
                }
            });
        }

        // 3. Движение разблокированных проектов (Tree Unlock Progression)
        gameState.projects.forEach(p => {
            if (!p.completed && isProjectUnlocked(p) && totalDevPower > 0) {
                p.progress += totalDevPower;
                if (p.progress >= p.maxProgress) {
                    completeProject(p);
                }
            }
        });

        // 4. Баланс прибыли за день (динамический расчет с учетом серверов, зарплат и бонусов)
        const netDailyProfit = calculateNetDailyProfit();
        gameState.money += netDailyProfit;

        // 5. Динамика морали коллектива (Employee Morale Dynamics)
        if (gameState.money < 0) {
            // Задолженность по зарплате и долги компании вызывают демотивацию
            gameState.morale = Math.max(0, (gameState.morale !== undefined ? gameState.morale : 85) - 3);
        } else {
            // Комфорт офиса и оснащение формируют целевую удовлетворенность
            let targetMorale = 75 + (gameState.officeTier - 1) * 3;
            if (gameState.upgrades.includes('coffee')) targetMorale += 12;
            if (gameState.upgrades.includes('chairs')) targetMorale += 13;
            targetMorale = Math.min(100, targetMorale);

            const m = (gameState.morale !== undefined ? gameState.morale : 85);
            if (m < targetMorale) {
                gameState.morale = Math.min(targetMorale, m + 2);
            } else if (m > targetMorale) {
                gameState.morale = Math.max(targetMorale, m - 1);
            }
        }
        gameState.morale = Math.max(0, Math.min(100, gameState.morale));

        // 6. Банкротство
        if (gameState.money < -5000) {
            alert("ВНИМАНИЕ! Долг компании превысил $5,000! Оптимизируйте штат и увольте лишних сотрудников!");
        }

        // 7. Случайные события (1.5% шанс)
        if (Math.random() < 0.015) {
            triggerRandomEvent();
        }

        // 8. Автосохранение (каждые 10 дней)
        const autosaveEl = document.getElementById('setting-autosave');
        if (gameState.day % 10 === 0 && autosaveEl && autosaveEl.checked) {
            saveGameToStorage(false);
        }

        renderProjects();
        updateUI();

    }, gameState.tickSpeed);
}

function stopGameTimers() {
    if (gameLoopTimer) clearInterval(gameLoopTimer);
    if (marketTimer) clearInterval(marketTimer);
}

/**
 * Возвращает актуальное суммарное число нанятых сотрудников всех категорий.
 * Чистая вспомогательная функция, агрегирующая данные из gameState.employees.
 * 
 * @returns {number} Общее количество специалистов в штате компании
 */
function getTotalEmployees() {
    return Object.values(gameState.employees).reduce((sum, emp) => sum + (emp.count || 0), 0);
}
if (typeof window !== 'undefined') {
    window.getTotalEmployees = getTotalEmployees;
}

/**
 * Вычисляет чистую суточную прибыль компании (Net Daily Profit).
 * 
 * Формула:
 * Чистая прибыль = Пассивный доход от завершенных проектов 
 *                - Суммарные зарплаты штата сотрудников (ФОТ)
 *                - Расходы на аренду серверов завершенных проектов.
 * 
 * Модификаторы:
 * 1. 'server' (GPU-серверный кластер): повышает пассивный доход на +20% и снижает серверные расходы на 30%.
 * 2. 'hasBug' (технический баг в проекте): снижает доход конкретного проекта на 50%.
 * 
 * @returns {number} Суммарный финансовый поток компании в долларах за 1 день симуляции
 */
function calculateNetDailyProfit() {
    // 1. Пассивный доход от всех завершенных проектов с учетом баффов оборудования и багов
    const passiveMultiplier = (gameState.upgrades && gameState.upgrades.includes('server')) ? 1.20 : 1.0;
    let totalPassiveIncome = 0;
    if (Array.isArray(gameState.projects)) {
        for (const p of gameState.projects) {
            if (p.completed) {
                let income = p.passiveIncome || 0;
                if (p.hasBug) {
                    income = Math.round(income * 0.5);
                }
                totalPassiveIncome += Math.round(income * passiveMultiplier);
            }
        }
    }

    // 2. Фонд оплаты труда: сумма ежедневных зарплат всех нанятых специалистов
    let totalSalaries = 0;
    if (gameState.employees) {
        for (const emp of Object.values(gameState.employees)) {
            totalSalaries += (emp.count || 0) * (emp.salary || 0);
        }
    }

    // 3. Затраты на серверную инфраструктуру для завершенных проектов (скидка 30% при GPU-кластере)
    const serverDiscount = (gameState.upgrades && gameState.upgrades.includes('server')) ? 0.70 : 1.0;
    let totalServerCosts = 0;
    if (Array.isArray(gameState.projects)) {
        for (const p of gameState.projects) {
            if (p.completed && p.serverCost) {
                totalServerCosts += Math.round(p.serverCost * serverDiscount);
            }
        }
    }

    return totalPassiveIncome - totalSalaries - totalServerCosts;
}
if (typeof window !== 'undefined') {
    window.calculateNetDailyProfit = calculateNetDailyProfit;
}

/**
 * Реактивное обновление всех индикаторов и счетчиков пользовательского интерфейса.
 * Синхронизирует баланс, суточную прибыль, репутацию, день, счетчик штата,
 * вместимость офиса, портфель акций и кнопку ручного кодинга с состоянием gameState.
 * 
 * По умолчанию вызывается без параметров и вычисляет все показатели динамически,
 * предотвращая сброс значений в 0 при кликах, найме, увольнении и тиках биржи.
 * 
 * @param {number|null} [overrideNetProfit=null] - Опциональный показатель суточной прибыли
 * @param {number|null} [overrideTotalEmp=null] - Опциональное количество сотрудников
 */
function updateUI(overrideNetProfit = null, overrideTotalEmp = null) {
    // 1. Динамический расчет числа сотрудников и чистой прибыли при отсутствии явного переопределения
    const totalEmployees = (overrideTotalEmp !== null && overrideTotalEmp !== undefined) ? overrideTotalEmp : getTotalEmployees();
    const netProfit = (overrideNetProfit !== null && overrideNetProfit !== undefined) ? overrideNetProfit : calculateNetDailyProfit();

    // 2. Текущий офис компании и лимит рабочих мест
    const currentOffice = officeTiers.find(o => o.tier === gameState.officeTier) || officeTiers[0];
    const maxPlaces = currentOffice.maxEmployees === 999 ? '∞' : currentOffice.maxEmployees;

    // 3. Баланс компании с форматированием знака и цветовой дифференциацией
    const moneyDisplay = document.getElementById('money-display');
    if (moneyDisplay) {
        const roundedMoney = Math.floor(gameState.money);
        moneyDisplay.innerText = `${roundedMoney < 0 ? '-$' : '$'}${Math.abs(roundedMoney).toLocaleString()}`;
        moneyDisplay.className = `metric-value ${roundedMoney >= 0 ? 'text-green' : 'text-red'}`;
    }

    // 4. Суточная прибыль / убыток
    const incomeDisplay = document.getElementById('income-display');
    if (incomeDisplay) {
        const sign = netProfit >= 0 ? '+' : '-';
        incomeDisplay.innerText = `${sign}$${Math.abs(netProfit).toLocaleString()}/день`;
        incomeDisplay.className = `metric-value ${netProfit >= 0 ? 'text-green' : 'text-red'}`;
    }

    // 5. Репутация и текущий игровой день
    const repDisplay = document.getElementById('reputation-display');
    if (repDisplay) {
        repDisplay.innerText = `⭐ ${Math.floor(gameState.reputation)}`;
    }

    const dayDisplay = document.getElementById('day-display');
    if (dayDisplay) {
        dayDisplay.innerText = `День ${gameState.day}`;
    }

    // 6. Бейдж общего количества сотрудников
    const totalEmployeesBadge = document.getElementById('total-employees');
    if (totalEmployeesBadge) {
        totalEmployeesBadge.innerText = `Сотрудников: ${totalEmployees}`;
    }

    // 7. Отображение офиса и занятых мест в шапке
    const officeDisplay = document.getElementById('office-display');
    if (officeDisplay) {
        officeDisplay.innerText = `${currentOffice.name} (${totalEmployees}/${maxPlaces})`;
    }

    // 8. Кнопка ручного кодинга: реактивное переключение бонуса (+$50 <-> +$100) при покупке оптоволокна
    const clickWorkBtn = document.getElementById('start-click-work');
    if (clickWorkBtn) {
        const hasOptic = gameState.upgrades && gameState.upgrades.includes('optic');
        clickWorkBtn.innerText = `⚡ Написать код вручную (+${hasOptic ? '$100' : '$50'})`;
    }

    // 9. Стоимость инвестиционного портфеля акций игрока
    const portfolioEl = document.getElementById('portfolio-value');
    if (portfolioEl && gameState.stocks) {
        const portfolioValue = (gameState.stocks.userOwned || 0) * (gameState.stocks.price || 0);
        portfolioEl.innerText = `$${portfolioValue.toLocaleString()}`;
    }

    // 10. Количество акций у игрока (реактивное синхронное обновление без задержки)
    const userSharesEl = document.getElementById('user-shares');
    if (userSharesEl && gameState.stocks) {
        userSharesEl.innerText = gameState.stocks.userOwned || 0;
    }

    // 11. Мораль и вовлеченность коллектива
    const moraleDisplay = document.getElementById('morale-display');
    if (moraleDisplay) {
        const moraleVal = Math.round(gameState.morale !== undefined ? gameState.morale : 85);
        const mood = moraleVal >= 80 ? '😊' : (moraleVal >= 40 ? '😐' : '😫');
        moraleDisplay.innerText = `${mood} ${moraleVal}%`;
        moraleDisplay.className = `metric-value ${moraleVal >= 70 ? 'text-green' : (moraleVal >= 40 ? 'text-yellow' : 'text-red')}`;
    }

    // 12. Синхронизация бейджей специалистов по каждой специальности
    if (gameState.employees) {
        for (const [role, emp] of Object.entries(gameState.employees)) {
            const badge = document.getElementById(`emp-count-${role}`);
            if (badge) {
                badge.innerText = String(emp.count || 0);
            }
        }
    }

    // 13. Обновление BI-вкладки или DevOps-вкладки, если они активны
    if (typeof currentActiveCentralTab !== 'undefined') {
        if (currentActiveCentralTab === 'bi') renderBiTab();
        else if (currentActiveCentralTab === 'devops') renderDevopsTab();
    }
}
if (typeof window !== 'undefined') {
    window.updateUI = updateUI;
}

// ============================================================================
// 7. СИСТЕМА ИНСАЙДЕРСКИХ НОВОСТЕЙ И УМНАЯ БИРЖА (STOCK MARKET ENGINE)
// ============================================================================

/**
 * Математический движок расчета курса акций биржи (Stock Market Engine)
 * 
 * Включает в себя:
 * 1. Внутреннюю точность с плавающей точкой (floatPrice), исключающую ловушку округления при $15.
 * 2. Упругий дрифт возврата к среднему (Ornstein-Uhlenbeck Mean Reversion) к равновесной цене ($100).
 * 3. Естественную рыночную волатильность (случайное блуждание -3.5%..+3.5%).
 * 4. Влияние новостного фона (Market Sentiment) с плавным угасанием импульса.
 * 5. Эластичное сопротивление у границ ценового коридора ($15 - $600).
 * 
 * @param {number} [currentPrice] - Текущая цена акции (если не передана, используется floatPrice из gameState)
 * @param {number} [trend] - Значение новостного тренда (-1..+1)
 * @param {Array<number>} [history] - История котировок
 * @returns {number} Целочисленный курс акции для отображения в интерфейсе и биржевых сделок
 */
function calculateStockPrice(currentPrice, trend, history) {
    const isInternalUpdate = (currentPrice === undefined || currentPrice === null);

    // Базовая цена: если передана явно - используем её, иначе внутренний floatPrice из gameState
    const basePrice = !isInternalUpdate
        ? (typeof currentPrice === 'number' && !isNaN(currentPrice) ? currentPrice : 100.0)
        : (gameState.stocks ? (gameState.stocks.floatPrice || gameState.stocks.price || 100.0) : 100.0);

    // Рыночный тренд новостей
    const currentTrend = (typeof trend === 'number' && !isNaN(trend))
        ? trend
        : (gameState.stocks ? (gameState.stocks.marketTrend || 0) : 0);

    // 1. Равновесная фундаментальная цена актива
    const targetPrice = 100.0;

    // 2. Упругий возврат к среднему (Mean-Reversion Drift)
    // При $15 создает сильный восходящий импульс (+2.125), при $600 - охлаждающий (-12.5)
    const meanReversion = (targetPrice - basePrice) * 0.025;

    // 3. Эластичные защитные буферы у границ коридора (Soft Boundary Repulsion)
    // Гарантируют невозможность залипания на дне ($15) или удержания на потолке ($600)
    const floorPush = basePrice <= 25 ? (25 - basePrice) * 0.06 : 0;
    const ceilingPush = basePrice >= 550 ? (basePrice - 550) * 0.06 : 0;

    // 4. Базовое естественное случайное блуждание (-3.5% .. +3.5%)
    let percentChange = (Math.random() * 0.07) - 0.035;

    // 5. Влияние новостного импульса (Market Sentiment)
    if (currentTrend !== 0) {
        const trendSign = currentTrend > 0 ? 1 : -1;
        const trendPower = Math.min(1.5, Math.abs(currentTrend));
        // Импульс от инсайдерской новости от 4% до 11% с учетом силы тренда
        percentChange += trendSign * ((Math.random() * 0.07) + 0.04) * trendPower;
    }

    // Расчет следующего значения в числах с плавающей точкой
    let nextFloat = basePrice * (1 + percentChange) + meanReversion + floorPush - ceilingPush;

    // Фиксация коридора безопасности $15..$600
    nextFloat = Math.max(15, Math.min(600, nextFloat));

    // При обновлении из основного игрового цикла сохраняем точное дробное значение
    if (isInternalUpdate && gameState && gameState.stocks) {
        gameState.stocks.floatPrice = nextFloat;
    }

    return Math.round(nextFloat);
}

/**
 * Симуляция биржи: реагирует на новости, обновляет котировки и перерисовывает график
 */
function startMarketSimulation() {
    if (marketTimer) clearInterval(marketTimer);

    marketTimer = setInterval(() => {
        if (gameState.isPaused) return;

        // Генерируем инсайдерскую новость, если предыдущая новость уже утихла (защита от спама)
        if (Math.abs(gameState.stocks.marketTrend) < 0.35 && Math.random() < 0.35) {
            triggerMarketNews();
        }

        // Расчет курса акции через устойчивый математический движок
        const newPrice = calculateStockPrice();

        // Плавное экспоненциальное затухание влияния новости
        if (gameState.stocks.marketTrend !== 0) {
            gameState.stocks.marketTrend *= 0.65;
            if (Math.abs(gameState.stocks.marketTrend) < 0.08) {
                gameState.stocks.marketTrend = 0;
            }
        }

        gameState.stocks.price = newPrice;
        gameState.stocks.history.push(newPrice);

        // Храним историю котировок за 120+ дней симуляции для непрерывного отображения тренда
        if (gameState.stocks.history.length > 120) {
            gameState.stocks.history.shift();
        }

        drawStockChart();

        const stockPriceEl = document.getElementById('stock-price');
        if (stockPriceEl) stockPriceEl.innerText = `$${gameState.stocks.price}`;
        const buyShareBtn = document.getElementById('buy-share-btn');
        if (buyShareBtn) buyShareBtn.innerText = `Купить ($${gameState.stocks.price})`;
        const userSharesEl = document.getElementById('user-shares');
        if (userSharesEl) userSharesEl.innerText = gameState.stocks.userOwned;

        updateUI();

    }, 5000); // Обновление каждые 5 секунд (плавно, без спешки)
}

/**
 * Публикует новостной сигнал, который определяет движение рынка
 */
function triggerMarketNews() {
    const news = marketNewsSignals[Math.floor(Math.random() * marketNewsSignals.length)];
    gameState.stocks.marketTrend = news.trend; // Задаем направление биржи

    const signalBox = document.getElementById('latest-news-signal');
    if (signalBox) {
        signalBox.innerHTML = `
            <div class="news-tag ${news.type}">${news.tag}</div>
            <p id="news-signal-text">${news.text}</p>
        `;
    }

    addFeedMessage(`[Инсайд биржи]: ${news.text}`);
}

/**
 * Отрисовка графика цен акций на HTML5 Canvas с динамическим масштабированием и градиентом
 * 
 * Особенности:
 * 1. Динамический расчет масштаба с 15% отступами сверху и снизу (min/max padding).
 * 2. Защита от деления на ноль (Zero-Division Guard): range = Math.max(1, maxVal - minVal).
 * 3. Корректный рендеринг при истории из 1 точки (стартовый уровень с точечным маркером).
 * 4. Плавная заливка градиентом под линией тренда (зеленый при росте, красный при падении).
 * 5. Поддержка отображения длинной истории (100+ точек) без NaN и артефактов.
 * 
 * @param {HTMLCanvasElement} [canvas] - Целевой элемент Canvas
 * @param {CanvasRenderingContext2D} [ctx] - Контекст 2D рисования
 * @param {Array<number>} [historyData] - Массив исторических цен
 */
function drawStockChart(canvas = chartCanvas, ctx = chartCtx, historyData) {
    const activeCanvas = canvas || (typeof document !== 'undefined' ? document.getElementById('market-chart') : null);
    if (!activeCanvas) return;

    const activeCtx = ctx || (typeof activeCanvas.getContext === 'function' ? activeCanvas.getContext('2d') : null);
    if (!activeCtx) return;

    const history = historyData || (gameState && gameState.stocks ? gameState.stocks.history : []);
    if (!history || history.length === 0) return;

    const w = activeCanvas.width;
    const h = activeCanvas.height;

    activeCtx.clearRect(0, 0, w, h);

    // Сетка фона графика
    activeCtx.strokeStyle = '#21262d';
    activeCtx.lineWidth = 1;
    for (let y = 25; y < h; y += 30) {
        activeCtx.beginPath();
        activeCtx.moveTo(0, y);
        activeCtx.lineTo(w, y);
        activeCtx.stroke();
    }

    // Внутренние отступы от краев Canvas, чтобы линия толщиной 2.5px не обрезалась
    const padTop = 12;
    const padBottom = 12;
    const plotH = h - padTop - padBottom;

    // Особый случай: игра только началась, в истории ровно 1 точка
    if (history.length === 1) {
        const y = padTop + plotH / 2;

        // Мягкий стартовый полупрозрачный градиент
        const grad = activeCtx.createLinearGradient(0, padTop, 0, h - padBottom);
        grad.addColorStop(0, 'rgba(88, 166, 255, 0.20)');
        grad.addColorStop(1, 'rgba(88, 166, 255, 0.00)');
        activeCtx.fillStyle = grad;
        activeCtx.fillRect(0, y, w, h - padBottom - y);

        // Горизонтальная линия начального уровня
        activeCtx.beginPath();
        activeCtx.strokeStyle = '#58a6ff';
        activeCtx.lineWidth = 2;
        activeCtx.moveTo(0, y);
        activeCtx.lineTo(w, y);
        activeCtx.stroke();

        // Начальная точка в центре графика
        activeCtx.beginPath();
        activeCtx.arc(w / 2, y, 4, 0, Math.PI * 2);
        activeCtx.fillStyle = '#58a6ff';
        activeCtx.fill();
        return;
    }

    // Динамический расчет шкалы с 15% отступом
    const rawMin = Math.min(...history);
    const rawMax = Math.max(...history);
    const span = rawMax - rawMin;
    const padding = span > 0 ? span * 0.15 : Math.max(10, rawMin * 0.15);
    const minVal = Math.max(0, rawMin - padding);
    const maxVal = rawMax + padding;

    // Защита от деления на 0 при одинаковых значениях котировок
    const range = Math.max(1, maxVal - minVal);
    const stepX = w / (history.length - 1);

    const lastVal = history[history.length - 1];
    const isGrowing = lastVal >= history[0];
    const lineColor = isGrowing ? '#2ea043' : '#f85149';
    const gradStart = isGrowing ? 'rgba(46, 160, 67, 0.30)' : 'rgba(248, 81, 73, 0.30)';
    const gradEnd = isGrowing ? 'rgba(46, 160, 67, 0.00)' : 'rgba(248, 81, 73, 0.00)';

    // 1. Заливка градиентом области под графиком
    activeCtx.beginPath();
    history.forEach((val, idx) => {
        const x = idx * stepX;
        const y = padTop + plotH - ((val - minVal) / range) * plotH;
        if (idx === 0) activeCtx.moveTo(x, y);
        else activeCtx.lineTo(x, y);
    });
    activeCtx.lineTo(w, h - padBottom);
    activeCtx.lineTo(0, h - padBottom);
    activeCtx.closePath();

    const grad = activeCtx.createLinearGradient(0, padTop, 0, h - padBottom);
    grad.addColorStop(0, gradStart);
    grad.addColorStop(1, gradEnd);
    activeCtx.fillStyle = grad;
    activeCtx.fill();

    // 2. Отрисовка основной линии тренда котировок
    activeCtx.beginPath();
    activeCtx.strokeStyle = lineColor;
    activeCtx.lineWidth = 2.5;
    history.forEach((val, idx) => {
        const x = idx * stepX;
        const y = padTop + plotH - ((val - minVal) / range) * plotH;
        if (idx === 0) activeCtx.moveTo(x, y);
        else activeCtx.lineTo(x, y);
    });
    activeCtx.stroke();

    // 3. Маркер текущей последней цены (светящаяся точка на конце графика)
    const lastX = (history.length - 1) * stepX;
    const lastY = padTop + plotH - ((lastVal - minVal) / range) * plotH;
    activeCtx.beginPath();
    activeCtx.arc(lastX, lastY, 3.5, 0, Math.PI * 2);
    activeCtx.fillStyle = lineColor;
    activeCtx.fill();
}

// ============================================================================
// 8. ОБРАБОТЧИКИ СОБЫТИЙ И КЛИКОВ ВНУТРИ ИГРЫ
// ============================================================================

function initInGameEventListeners() {
    // Ручной клик: написание фриланс-скрипта (бафф оптоволокна)
    document.getElementById('start-click-work').addEventListener('click', () => {
        const reward = gameState.upgrades.includes('optic') ? 100 : 50;
        gameState.money += reward;
        updateUI();
        addFeedMessage(`Вы написали кастомный скрипт и заработали $${reward}.`);
        logGitCommit(`feat(sprint): commit dev iteration (+$${reward})`);
        playTone(493, 0.05);
    });

    // Купить акцию
    document.getElementById('buy-share-btn').addEventListener('click', () => {
        if (gameState.money >= gameState.stocks.price) {
            gameState.money -= gameState.stocks.price;
            gameState.stocks.userOwned++;
            updateUI();
            addFeedMessage(`Куплена 1 акция по $${gameState.stocks.price}`);
            playTone(523, 0.07);
        } else {
            alert("Недостаточно средств для покупки акции!");
        }
    });

    // Продать акцию
    document.getElementById('sell-share-btn').addEventListener('click', () => {
        if (gameState.stocks.userOwned > 0) {
            gameState.money += gameState.stocks.price;
            gameState.stocks.userOwned--;
            updateUI();
            addFeedMessage(`Продана 1 акция за $${gameState.stocks.price}`);
            playTone(659, 0.07);
        } else {
            alert("У вас нет купленных акций для продажи!");
        }
    });

    // Скорость: 0.5x (5000 мс)
    document.getElementById('speed-slow-btn').addEventListener('click', () => {
        startGameLoop(5000);
        document.getElementById('speed-slow-btn').classList.add('active-speed');
        document.getElementById('speed-normal-btn').classList.remove('active-speed');
        addFeedMessage("Скорость симуляции: замедленная (5 сек/день).");
    });

    // Скорость: 1x (3000 мс)
    document.getElementById('speed-normal-btn').addEventListener('click', () => {
        startGameLoop(3000);
        document.getElementById('speed-normal-btn').classList.add('active-speed');
        document.getElementById('speed-slow-btn').classList.remove('active-speed');
        addFeedMessage("Скорость симуляции: стандартная (3 сек/день).");
    });

    // Пауза
    document.getElementById('pause-btn').addEventListener('click', () => {
        gameState.isPaused = !gameState.isPaused;
        document.getElementById('pause-btn').innerText = gameState.isPaused ? "▶ Продолжить" : "⏸ Пауза";
    });

    // Сохранить игру
    document.getElementById('save-btn').addEventListener('click', () => {
        saveGameToStorage(true);
    });
}

function saveGameToStorage(showAlert = true) {
    localStorage.setItem('cybertycoon_save', JSON.stringify(gameState));
    if (showAlert) alert("Прогресс успешно сохранён в памяти браузера!");
}

function loadGameFromStorage() {
    const data = localStorage.getItem('cybertycoon_save');
    if (data) {
        gameState = JSON.parse(data);
        // Обратная совместимость для точной цены с плавающей точкой
        if (gameState.stocks && typeof gameState.stocks.floatPrice !== 'number') {
            gameState.stocks.floatPrice = Number(gameState.stocks.price) || 100.0;
        }
        // Обратная совместимость для морали команды
        if (typeof gameState.morale !== 'number') {
            gameState.morale = 85;
        }
        closeModal('direction-modal');
        switchToGameScreen();

        // Проверка апгрейда 'optic' и синхронизация надписи кнопки ручной разработки кода
        const clickWorkBtn = document.getElementById('start-click-work');
        if (clickWorkBtn) {
            const hasOptic = gameState.upgrades && gameState.upgrades.includes('optic');
            clickWorkBtn.innerText = `⚡ Написать код вручную (+${hasOptic ? '$100' : '$50'})`;
        }

        alert("Сохранённая игра успешно загружена!");
    } else {
        alert("Сохранений не найдено.");
    }
}

window.resetSaveData = function() {
    if (confirm("Вы уверены, что хотите стереть все сохранения?")) {
        localStorage.removeItem('cybertycoon_save');
        alert("Сохранения сброшены.");
        location.reload();
    }
};

function addFeedMessage(text) {
    const feed = document.getElementById('event-feed');
    if (!feed) return;
    const item = document.createElement('div');
    item.className = 'feed-item';
    item.innerText = `[День ${gameState.day}] ${text}`;
    feed.prepend(item);
}

// ============================================================================
// 9. ВСПЛЫВАЮЩИЕ ОКНА (МОДАЛКИ) И СЛУЧАЙНЫЕ СОБЫТИЯ
// ============================================================================

window.openModal = function(id) {
    document.getElementById(id).classList.remove('hidden');
};

window.closeModal = function(id) {
    document.getElementById(id).classList.add('hidden');
};

function triggerRandomEvent() {
    gameState.isPaused = true;

    const events = [
        {
            title: "Предложение крупного инвестора",
            desc: "Бизнес-ангел предлагает вложить в ваш проект $4,000 в обмен на 15% будущей прибыли.",
            choices: [
                { text: "Отказаться (сохранить независимость)", action: () => { gameState.reputation += 5; } },
                { text: "Принять $4,000 (+деньги, -10 репутации)", action: () => { gameState.money += 4000; gameState.reputation -= 10; } }
            ]
        },
        {
            title: "Хакерская атака на базы данных",
            desc: "Злоумышленники попытались взломать ваши серверы. Нужно оперативно среагировать.",
            choices: [
                { text: "Нанять внешних аудиторов (-$150)", action: () => { gameState.money -= Math.min(150, Math.max(0, Math.round(gameState.money * 0.02))); } },
                { text: "Проигнорировать инцидент (-15 репутации)", action: () => { gameState.reputation -= 15; } }
            ]
        }
    ];

    const currentEvent = events[Math.floor(Math.random() * events.length)];
    const modal = document.getElementById('event-modal');
    document.getElementById('modal-title').innerText = currentEvent.title;
    document.getElementById('modal-desc').innerText = currentEvent.desc;

    const choicesContainer = document.getElementById('modal-choices');
    choicesContainer.innerHTML = '';

    currentEvent.choices.forEach(ch => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary';
        btn.innerText = ch.text;
        btn.onclick = () => {
            ch.action();
            modal.classList.add('hidden');
            gameState.isPaused = false;
            updateUI();
        };
        choicesContainer.appendChild(btn);
    });

    modal.classList.remove('hidden');
}

// ============================================================================
// 10. ВСТРОЕННЫЙ СИНТЕЗАТОР ЗВУКОВ (WEB AUDIO API)
// ============================================================================

/**
 * Синтезирует короткий приятный звуковой сигнал нужной частоты
 */
function playTone(freq, duration = 0.1) {
    const soundCheckbox = document.getElementById('setting-sound');
    if (soundCheckbox && !soundCheckbox.checked) return;

    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const audioCtx = new AudioContext();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
        // Игнорируем ограничения автовоспроизведения браузера
    }
}

// ============================================================================
// 11. ГЛОБАЛЬНЫЙ ДОСТУП И ЭКСПОРТ ДЛЯ ТЕСТИРОВАНИЯ (NODE.JS / COMMONJS)
// ============================================================================

// Регистрация в глобальной области видимости браузера
if (typeof window !== 'undefined') {
    window.calculateStockPrice = calculateStockPrice;
    window.drawStockChart = drawStockChart;
    window.getTotalEmployees = getTotalEmployees;
    window.calculateNetDailyProfit = calculateNetDailyProfit;
    window.updateUI = updateUI;
    window.fixProjectBug = fixProjectBug;
    window.isProjectUnlocked = isProjectUnlocked;
    window.isProjectCompleted = isProjectCompleted;
    window.renderBiTab = renderBiTab;
    window.exportFinancialReportCSV = exportFinancialReportCSV;
    window.renderDevopsTab = renderDevopsTab;
    window.optimizeDevOpsServers = optimizeDevOpsServers;
    window.logGitCommit = logGitCommit;
}
if (typeof global !== 'undefined') {
    global.isProjectUnlocked = isProjectUnlocked;
    global.isProjectCompleted = isProjectCompleted;
}

// Экспорт для автоматизированных E2E-тестов в среде Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        gameState,
        officeTiers,
        equipmentCatalog,
        directionProjectsCatalog,
        marketNewsSignals,
        calculateStockPrice,
        drawStockChart,
        startMarketSimulation,
        triggerMarketNews,
        getTotalEmployees,
        calculateNetDailyProfit,
        updateUI,
        switchToGameScreen,
        saveGameToStorage,
        loadGameFromStorage,
        fixProjectBug,
        isProjectUnlocked,
        isProjectCompleted,
        renderBiTab,
        exportFinancialReportCSV,
        renderDevopsTab,
        optimizeDevOpsServers,
        logGitCommit,
        playTone
    };
}

