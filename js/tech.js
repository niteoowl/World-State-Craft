// World State Craft - Technology System
import CONFIG from './config.js';
import auth from './auth.js';

class TechManager {
    constructor() {
        this.techTree = this.initializeTechTree();
    }

    initializeTechTree() {
        return {
            // Tier 1 - Basic Industry
            mining: {
                id: 'mining',
                name: '광물 채굴',
                tier: 1,
                icon: '⛏️',
                description: '기본 자원 채굴 효율 증가',
                cost: 1000,
                researchTime: 300, // seconds
                prerequisites: [],
                effects: { resourceProduction: 0.2 }
            },
            basic_military: {
                id: 'basic_military',
                name: '기초 군사학',
                tier: 1,
                icon: '⚔️',
                description: '보병 및 기초 병력 훈련',
                cost: 1500,
                researchTime: 360,
                prerequisites: [],
                effects: { unlockUnit: 'infantry' }
            },
            agriculture: {
                id: 'agriculture',
                name: '농업 기술',
                tier: 1,
                icon: '🌾',
                description: '식량 생산량 증가',
                cost: 800,
                researchTime: 240,
                prerequisites: [],
                effects: { foodProduction: 0.25 }
            },

            // Tier 2 - Information Age
            espionage: {
                id: 'espionage',
                name: '첩보 기관',
                tier: 2,
                icon: '🕵️',
                description: '스파이 활동 활성화, 적국 정보 수집',
                cost: 5000,
                researchTime: 600,
                prerequisites: ['basic_military'],
                effects: { enableSpies: true, intelGathering: 0.3 }
            },
            missiles: {
                id: 'missiles',
                name: '미사일 기술',
                tier: 2,
                icon: '🚀',
                description: '원거리 정밀 타격 능력',
                cost: 8000,
                researchTime: 900,
                prerequisites: ['basic_military'],
                effects: { unlockUnit: 'missile' }
            },
            economic_data: {
                id: 'economic_data',
                name: '경제 분석',
                tier: 2,
                icon: '📊',
                description: '실시간 시장 데이터 접근, 환율 분석',
                cost: 4000,
                researchTime: 480,
                prerequisites: ['mining'],
                effects: { marketInsight: true, tradeEfficiency: 0.15 }
            },
            armored_warfare: {
                id: 'armored_warfare',
                name: '기갑 전술',
                tier: 2,
                icon: '🛡️',
                description: '전차 및 중장비 운용',
                cost: 6000,
                researchTime: 720,
                prerequisites: ['basic_military'],
                effects: { unlockUnit: 'tank' }
            },
            naval_power: {
                id: 'naval_power',
                name: '해군력',
                tier: 2,
                icon: '🚢',
                description: '함대 건조 및 해상 작전',
                cost: 7000,
                researchTime: 840,
                prerequisites: ['basic_military'],
                effects: { unlockUnit: 'navy' }
            },
            aviation: {
                id: 'aviation',
                name: '항공 기술',
                tier: 2,
                icon: '✈️',
                description: '전투기 및 공중 우위',
                cost: 7500,
                researchTime: 900,
                prerequisites: ['basic_military'],
                effects: { unlockUnit: 'aircraft' }
            },

            // Tier 3 - Quantum & Space
            nuclear: {
                id: 'nuclear',
                name: '핵 억지력',
                tier: 3,
                icon: '☢️',
                description: '핵무기 개발, 외교적 우위',
                cost: 50000,
                researchTime: 3600,
                prerequisites: ['missiles', 'espionage'],
                effects: {
                    nuclearCapability: true,
                    diplomaticWeight: 0.5,
                    unlockUnit: 'nuclear_missile'
                }
            },
            satellite_defense: {
                id: 'satellite_defense',
                name: '위성 방어 시스템',
                tier: 3,
                icon: '🛰️',
                description: '적 미사일 요격, 전장 감시',
                cost: 40000,
                researchTime: 3000,
                prerequisites: ['missiles', 'aviation'],
                effects: { missileDefense: 0.5, globalSurveillance: true }
            },
            ai_bureaucracy: {
                id: 'ai_bureaucracy',
                name: 'AI 관료 시스템',
                tier: 3,
                icon: '🤖',
                description: '행정 자동화, 국가 효율 극대화',
                cost: 35000,
                researchTime: 2400,
                prerequisites: ['economic_data', 'espionage'],
                effects: {
                    adminEfficiency: 0.4,
                    citizenProductivity: 0.2,
                    corruptionReduction: 0.3
                }
            },
            quantum_computing: {
                id: 'quantum_computing',
                name: '양자 컴퓨팅',
                tier: 3,
                icon: '🔮',
                description: '암호 해독, 연구 속도 극대화',
                cost: 60000,
                researchTime: 4200,
                prerequisites: ['economic_data', 'espionage'],
                effects: {
                    researchSpeed: 0.5,
                    codeBreaking: true,
                    cyberWarfare: true
                }
            }
        };
    }

    // Get nation's researched technologies
    async getNationTech(nationId) {
        const supabase = auth.getSupabase();
        const { data, error } = await supabase
            .from('technologies')
            .select('*')
            .eq('nation_id', nationId);

        if (error) throw error;
        return data || [];
    }

    // Check if tech can be researched
    async canResearch(nationId, techId) {
        const tech = this.techTree[techId];
        if (!tech) return { can: false, reason: 'Technology not found' };

        // Check prerequisites
        const nationTech = await this.getNationTech(nationId);
        const researchedIds = nationTech.map(t => t.tech_name);

        for (const prereq of tech.prerequisites) {
            if (!researchedIds.includes(prereq)) {
                return {
                    can: false,
                    reason: `Requires ${this.techTree[prereq]?.name || prereq}`
                };
            }
        }

        // Check if already researched
        if (researchedIds.includes(techId)) {
            return { can: false, reason: 'Already researched' };
        }

        // Check if currently researching
        const researching = nationTech.find(t => t.status === 'researching');
        if (researching) {
            return {
                can: false,
                reason: `Currently researching ${this.techTree[researching.tech_name]?.name}`
            };
        }

        return { can: true };
    }

    // Start research
    async startResearch(nationId, techId) {
        const supabase = auth.getSupabase();
        const tech = this.techTree[techId];

        if (!tech) throw new Error('Technology not found');

        const canResearchResult = await this.canResearch(nationId, techId);
        if (!canResearchResult.can) {
            throw new Error(canResearchResult.reason);
        }

        // Check and deduct treasury
        const { data: nation } = await supabase
            .from('nations')
            .select('treasury, political_system')
            .eq('id', nationId)
            .single();

        if (nation.treasury < tech.cost) {
            throw new Error('Insufficient funds');
        }

        // Academic hubs get research bonus
        let researchTimeMultiplier = 1;
        // Would check for academic hub bonus here

        const completionTime = new Date(Date.now() + tech.researchTime * 1000 * researchTimeMultiplier);

        // Deduct cost and create research entry
        await supabase
            .from('nations')
            .update({ treasury: nation.treasury - tech.cost })
            .eq('id', nationId);

        const { data, error } = await supabase
            .from('technologies')
            .insert({
                nation_id: nationId,
                tech_name: techId,
                level: 1,
                status: 'researching',
                started_at: new Date().toISOString(),
                completes_at: completionTime.toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        return { tech: data, completesAt: completionTime };
    }

    // Check and complete research
    async checkResearchCompletion(nationId) {
        const supabase = auth.getSupabase();

        const { data: researching } = await supabase
            .from('technologies')
            .select('*')
            .eq('nation_id', nationId)
            .eq('status', 'researching')
            .lte('completes_at', new Date().toISOString());

        const completed = [];
        for (const research of researching || []) {
            await supabase
                .from('technologies')
                .update({
                    status: 'completed',
                    unlocked_at: new Date().toISOString()
                })
                .eq('id', research.id);

            // Apply tech effects
            await this.applyTechEffects(nationId, research.tech_name);
            completed.push(research.tech_name);
        }

        return completed;
    }

    // Apply technology effects to nation
    async applyTechEffects(nationId, techId) {
        const tech = this.techTree[techId];
        if (!tech) return;

        const supabase = auth.getSupabase();

        // Handle unit unlocks
        if (tech.effects.unlockUnit) {
            // This would update a nation's available units list
            console.log(`Unlocked unit: ${tech.effects.unlockUnit}`);
        }

        // Handle production bonuses
        if (tech.effects.resourceProduction) {
            // Update nation's production multipliers
            console.log(`Production bonus: +${tech.effects.resourceProduction * 100}%`);
        }

        // Handle special abilities
        if (tech.effects.nuclearCapability) {
            await supabase
                .from('nations')
                .update({ has_nuclear: true })
                .eq('id', nationId);
        }
    }

    // Share technology with ally
    async shareTech(fromNationId, toNationId, techId) {
        const supabase = auth.getSupabase();

        // Check if nations are allies
        const { data: treaty } = await supabase
            .from('treaties')
            .select('*')
            .or(`and(nation_a.eq.${fromNationId},nation_b.eq.${toNationId}),and(nation_a.eq.${toNationId},nation_b.eq.${fromNationId})`)
            .eq('status', 'active')
            .single();

        if (!treaty) {
            throw new Error('No active treaty between nations');
        }

        // Check if sharing nation has the tech
        const fromTech = await this.getNationTech(fromNationId);
        if (!fromTech.find(t => t.tech_name === techId && t.status === 'completed')) {
            throw new Error('Nation does not have this technology');
        }

        // Check if receiving nation already has tech
        const toTech = await this.getNationTech(toNationId);
        if (toTech.find(t => t.tech_name === techId)) {
            throw new Error('Receiving nation already has this technology');
        }

        // Transfer tech (instant with reduced level)
        await supabase
            .from('technologies')
            .insert({
                nation_id: toNationId,
                tech_name: techId,
                level: 1,
                status: 'completed',
                unlocked_at: new Date().toISOString(),
                shared_from: fromNationId
            });

        return true;
    }

    // Get available techs for research
    getAvailableTechs(researchedTechIds) {
        const available = [];

        for (const [id, tech] of Object.entries(this.techTree)) {
            if (researchedTechIds.includes(id)) continue;

            const prereqsMet = tech.prerequisites.every(p => researchedTechIds.includes(p));
            if (prereqsMet) {
                available.push(tech);
            }
        }

        return available;
    }

    getTechTree() {
        return this.techTree;
    }
}

const tech = new TechManager();
export default tech;
