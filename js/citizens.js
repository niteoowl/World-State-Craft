// World State Craft - Citizens System
import CONFIG from './config.js';
import auth from './auth.js';

class CitizenManager {
    constructor() {
        this.jobTypes = {
            industrial: {
                name: '산업 노동자',
                icon: '🏭',
                effect: 'resourceProduction',
                multiplier: 0.1
            },
            research: {
                name: '연구원',
                icon: '🔬',
                effect: 'researchSpeed',
                multiplier: 0.05
            },
            military: {
                name: '군인',
                icon: '🪖',
                effect: 'militaryStrength',
                multiplier: 0.08
            },
            administrative: {
                name: '행정관',
                icon: '📋',
                effect: 'efficiency',
                multiplier: 0.03
            },
            trader: {
                name: '상인',
                icon: '💼',
                effect: 'tradeBonus',
                multiplier: 0.07
            }
        };
    }

    // Get all citizens of a nation
    async getNationCitizens(nationId) {
        const supabase = auth.getSupabase();
        const { data, error } = await supabase
            .from('citizens')
            .select('*, user:users(email)')
            .eq('nation_id', nationId);

        if (error) throw error;
        return data || [];
    }

    // Join a nation as citizen
    async joinNation(userId, nationId) {
        const supabase = auth.getSupabase();

        // Check if already a citizen somewhere
        const { data: existing } = await supabase
            .from('citizens')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (existing) {
            throw new Error('Already a citizen of another nation. Leave first.');
        }

        // Check if nation exists and can accept more citizens
        const { data: nation } = await supabase
            .from('nations')
            .select('*')
            .eq('id', nationId)
            .single();

        if (!nation) {
            throw new Error('Nation not found');
        }

        const currentCitizens = await this.getNationCitizens(nationId);
        if (currentCitizens.length >= CONFIG.GAME.MAX_CITIZENS_PER_NATION) {
            throw new Error('Nation is at maximum capacity');
        }

        // Create citizenship
        const { data, error } = await supabase
            .from('citizens')
            .insert({
                user_id: userId,
                nation_id: nationId,
                job_type: 'industrial', // Default job
                expertise_level: 1,
                joined_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // Leave nation
    async leaveNation(userId) {
        const supabase = auth.getSupabase();

        const { error } = await supabase
            .from('citizens')
            .delete()
            .eq('user_id', userId);

        if (error) throw error;
        return true;
    }

    // Change job assignment
    async changeJob(citizenId, newJobType) {
        const supabase = auth.getSupabase();

        if (!this.jobTypes[newJobType]) {
            throw new Error('Invalid job type');
        }

        const { error } = await supabase
            .from('citizens')
            .update({
                job_type: newJobType,
                job_changed_at: new Date().toISOString()
            })
            .eq('id', citizenId);

        if (error) throw error;
        return true;
    }

    // Calculate citizen bonus for nation
    async calculateCitizenBonus(nationId) {
        const citizens = await this.getNationCitizens(nationId);

        const bonuses = {
            resourceProduction: 1,
            researchSpeed: 1,
            militaryStrength: 1,
            efficiency: 1,
            tradeBonus: 1
        };

        for (const citizen of citizens) {
            const job = this.jobTypes[citizen.job_type];
            if (job) {
                const expertiseMultiplier = 1 + (citizen.expertise_level - 1) * 0.1;
                bonuses[job.effect] += job.multiplier * expertiseMultiplier;
            }
        }

        return bonuses;
    }

    // Increase citizen expertise (based on activity)
    async gainExpertise(citizenId, amount = 1) {
        const supabase = auth.getSupabase();

        const { data: citizen } = await supabase
            .from('citizens')
            .select('*')
            .eq('id', citizenId)
            .single();

        if (!citizen) return;

        const newLevel = Math.min(10, citizen.expertise_level + amount * 0.1);

        await supabase
            .from('citizens')
            .update({ expertise_level: newLevel })
            .eq('id', citizenId);
    }

    // Get citizen statistics
    async getCitizenStats(nationId) {
        const citizens = await this.getNationCitizens(nationId);

        const stats = {
            total: citizens.length,
            byJob: {},
            averageExpertise: 0
        };

        let totalExpertise = 0;

        for (const citizen of citizens) {
            stats.byJob[citizen.job_type] = (stats.byJob[citizen.job_type] || 0) + 1;
            totalExpertise += citizen.expertise_level;
        }

        stats.averageExpertise = citizens.length > 0
            ? totalExpertise / citizens.length
            : 0;

        return stats;
    }

    // Brain drain: Citizens leaving for better nations
    async processBrainDrain() {
        const supabase = auth.getSupabase();

        // Get all nations sorted by quality of life
        const { data: nations } = await supabase
            .from('nations')
            .select('id, stability, tax_rate, gdp')
            .order('stability', { ascending: false });

        if (!nations || nations.length < 2) return [];

        const migrations = [];

        // Citizens from low-stability nations might migrate
        for (const nation of nations.slice(Math.floor(nations.length / 2))) {
            const citizens = await this.getNationCitizens(nation.id);

            for (const citizen of citizens) {
                // High expertise citizens more likely to leave
                const leaveChance = (citizen.expertise_level / 10) * (1 - nation.stability / 100);

                if (Math.random() < leaveChance * 0.1) { // 10% of calculated chance per tick
                    // Find a better nation
                    const betterNation = nations.find(n =>
                        n.id !== nation.id && n.stability > nation.stability
                    );

                    if (betterNation) {
                        await this.leaveNation(citizen.user_id);
                        await this.joinNation(citizen.user_id, betterNation.id);
                        migrations.push({
                            from: nation.id,
                            to: betterNation.id,
                            citizenId: citizen.id
                        });
                    }
                }
            }
        }

        return migrations;
    }

    // Unlock expertise bonus (high-skilled citizens provide nation-wide bonus)
    async checkExpertiseUnlocks(nationId) {
        const citizens = await this.getNationCitizens(nationId);
        const unlocks = [];

        // Count experts in each field
        const expertCounts = {};
        for (const citizen of citizens) {
            if (citizen.expertise_level >= 8) {
                expertCounts[citizen.job_type] = (expertCounts[citizen.job_type] || 0) + 1;
            }
        }

        // 5+ experts in a field unlocks nation-wide bonus
        for (const [jobType, count] of Object.entries(expertCounts)) {
            if (count >= 5) {
                unlocks.push({
                    type: jobType,
                    bonus: this.jobTypes[jobType].multiplier * 2, // Double bonus
                    experts: count
                });
            }
        }

        return unlocks;
    }

    // Pay citizens (from nation treasury)
    async payCitizens(nationId) {
        const supabase = auth.getSupabase();

        const citizens = await this.getNationCitizens(nationId);
        const { data: nation } = await supabase
            .from('nations')
            .select('treasury, political_system')
            .eq('id', nationId)
            .single();

        // Base wage calculation
        let baseWage = 100;

        // Socialist nations pay less
        if (nation.political_system === 'socialist') {
            baseWage *= 0.6;
        }

        const totalPayment = citizens.length * baseWage;

        if (nation.treasury < totalPayment) {
            // Can't pay - stability decreases
            return {
                success: false,
                unpaidAmount: totalPayment - nation.treasury
            };
        }

        await supabase
            .from('nations')
            .update({ treasury: nation.treasury - totalPayment })
            .eq('id', nationId);

        return {
            success: true,
            paid: citizens.length,
            amount: totalPayment
        };
    }

    getJobTypes() {
        return this.jobTypes;
    }
}

const citizens = new CitizenManager();
export default citizens;
