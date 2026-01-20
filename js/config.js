// World State Craft - Configuration
const CONFIG = {
    // Supabase
    SUPABASE_URL: 'https://whtukvttudrzyxemphqy.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndodHVrdnR0dWRyenl4ZW1waHF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MTE2NDMsImV4cCI6MjA4NDA4NzY0M30.nmyAmQP2OY23K3t-ShWKeHTpkkPs8QZjNRgbDP-BIV8',

    // Game Constants
    GAME: {
        TICK_RATE: 60000, // 1 minute per game tick
        MAX_CITIZENS_PER_NATION: 1000,
        BASE_RESOURCE_PRODUCTION: 10,
        BASE_RESEARCH_SPEED: 1,
    },

    // Geopolitical Traits
    TRAITS: {
        PENINSULA: {
            id: 'peninsula',
            name: '반도국 (Peninsula)',
            icon: '🏝️',
            description: '해상 무역 효율 +20%, 해군 유지비 -15%',
            bonuses: { seaTrade: 0.2, navyMaintenance: -0.15 },
            penalties: { landDefense: -0.1 }
        },
        LANDLOCKED: {
            id: 'landlocked',
            name: '내륙국 (Landlocked)',
            icon: '🏔️',
            description: '육상 물류 속도 +30%, 자원 생산량 +10%',
            bonuses: { landLogistics: 0.3, resourceProduction: 0.1 },
            penalties: { seaAccess: -1 }
        },
        RESOURCE_RICH: {
            id: 'resource_rich',
            name: '자원 풍부국 (Resource Rich)',
            icon: '💎',
            description: '자원 매장량 +50%, 초기 경제 성장 빠름',
            bonuses: { resourceDeposits: 0.5, earlyGrowth: 0.25 },
            penalties: { invasionRisk: 0.2 }
        }
    },

    // National Bonuses
    NATIONAL_BONUSES: {
        FINANCIAL_HUB: {
            id: 'financial_hub',
            name: '금융 허브',
            icon: '🏦',
            description: '국제 거래 수수료 면제, 환율 방어력 +25%',
            effects: { tradeFee: 0, exchangeDefense: 0.25 }
        },
        MILITARY_BONUS: {
            id: 'military_bonus',
            name: '군사 보너스',
            icon: '🛡️',
            description: '방어 구조물 비용 -30%, 군대 사기 저하 속도 감소',
            effects: { defenseCost: -0.3, moraleDecay: -0.2 }
        },
        ACADEMIC_HUB: {
            id: 'academic_hub',
            name: '학술 허브',
            icon: '📚',
            description: '연구 슬롯 +1, 연구원 효율 +15%',
            effects: { researchSlots: 1, researcherEfficiency: 0.15 }
        }
    },

    // Political Systems
    POLITICAL_SYSTEMS: {
        DEMOCRACY: {
            id: 'democracy',
            name: '자유 민주주의',
            icon: '🗳️',
            description: '투표를 통한 주기적 정권 교체',
            bonuses: { citizenEfficiency: 0.2, researchSpeed: 0.15 },
            penalties: { decisionSpeed: -0.3, warDeclaration: 'requires_vote' }
        },
        DICTATORSHIP: {
            id: 'dictatorship',
            name: '군사 독재',
            icon: '👊',
            description: '무력에 의한 1인 집권',
            bonuses: { militaryProduction: 0.25, instantWar: true },
            penalties: { sanctionVulnerability: 0.3, techStagnation: 0.15, coupeRisk: 0.1 }
        },
        SOCIALIST: {
            id: 'socialist',
            name: '사회주의 공화국',
            icon: '⭐',
            description: '국고 중심의 강력한 통제 경제',
            bonuses: { treasuryGrowth: 0.3, projectCost: -0.2 },
            penalties: { citizenWage: -0.4, brainDrain: 0.2 }
        }
    },

    // Resource Types
    RESOURCES: {
        OIL: { id: 'oil', name: '석유', icon: '🛢️', baseValue: 100 },
        MINERALS: { id: 'minerals', name: '광물', icon: '⛏️', baseValue: 50 },
        FOOD: { id: 'food', name: '식량', icon: '🌾', baseValue: 30 },
        TECH: { id: 'tech', name: '기술 부품', icon: '🔧', baseValue: 200 },
        RARE_EARTH: { id: 'rare_earth', name: '희토류', icon: '💠', baseValue: 500 }
    },

    // Military Units
    UNITS: {
        INFANTRY: { id: 'infantry', name: '보병', icon: '🪖', cost: 100, attack: 10, defense: 15, speed: 1 },
        TANK: { id: 'tank', name: '전차', icon: '🛡️', cost: 500, attack: 50, defense: 40, speed: 0.7 },
        AIRCRAFT: { id: 'aircraft', name: '전투기', icon: '✈️', cost: 1000, attack: 80, defense: 20, speed: 3 },
        NAVY: { id: 'navy', name: '함선', icon: '🚢', cost: 2000, attack: 60, defense: 70, speed: 0.5 },
        MISSILE: { id: 'missile', name: '미사일', icon: '🚀', cost: 5000, attack: 200, defense: 0, speed: 10 }
    },

    // Technology Tiers
    TECH_TIERS: {
        TIER_1: {
            name: '기초 공업',
            techs: ['mining', 'basic_military', 'agriculture']
        },
        TIER_2: {
            name: '정보화 시대',
            techs: ['espionage', 'missiles', 'economic_data']
        },
        TIER_3: {
            name: '양자 및 우주',
            techs: ['nuclear', 'satellite_defense', 'ai_bureaucracy']
        }
    }
};

// Freeze config to prevent modifications
Object.freeze(CONFIG);
Object.freeze(CONFIG.TRAITS);
Object.freeze(CONFIG.POLITICAL_SYSTEMS);
Object.freeze(CONFIG.RESOURCES);
Object.freeze(CONFIG.UNITS);

export default CONFIG;
