// World State Craft - Nation Management
import CONFIG from './config.js';
import auth from './auth.js';

class NationManager {
    constructor() {
        this.currentNation = null;
    }

    // Create a new nation
    async createNation(data) {
        const supabase = auth.getSupabase();
        const user = auth.getUser();

        if (!user) throw new Error('Must be logged in');

        // Check if user already has a nation
        const existing = await auth.loadNation();
        if (existing) {
            throw new Error('You already own a nation');
        }

        // Validate required fields
        if (!data.name || data.name.length < 2) {
            throw new Error('Nation name must be at least 2 characters');
        }

        // Upload flag if provided, otherwise use selected URL
        let flagUrl = data.flagUrl || null;
        if (data.flagFile) {
            flagUrl = await this.uploadFlag(data.flagFile);
        }

        // Create nation record
        const { data: nation, error } = await supabase
            .from('nations')
            .insert({
                name: data.name,
                motto: data.motto || '',
                currency_name: data.currencyName || 'Sover',
                flag_url: flagUrl,
                political_system: data.politicalSystem || 'democracy',
                geopolitical_trait: data.geopoliticalTrait || 'peninsula',
                national_bonus: data.nationalBonus || 'financial_hub',
                territory_geojson: data.territoryGeoJson || null,
                territory_center: data.territoryCenter || null,
                treasury: 10000, // Starting treasury
                gdp: 1000,
                stability: 80,
                population: 1,
                owner_id: user.id,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        // Initialize starting resources
        await this.initializeResources(nation.id);

        this.currentNation = nation;
        return nation;
    }

    // Upload flag with WebP compression
    async uploadFlag(file) {
        const supabase = auth.getSupabase();

        // Compress to WebP
        const compressedBlob = await this.compressToWebP(file);

        const fileName = `flags/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.webp`;

        const { data, error } = await supabase.storage
            .from('nation-assets')
            .upload(fileName, compressedBlob, {
                contentType: 'image/webp',
                cacheControl: '3600'
            });

        if (error) throw error;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('nation-assets')
            .getPublicUrl(fileName);

        return publicUrl;
    }

    // Compress image to WebP
    async compressToWebP(file, maxWidth = 256, quality = 0.8) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            img.onload = () => {
                // Calculate dimensions
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => resolve(blob),
                    'image/webp',
                    quality
                );
            };

            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }

    // Initialize starting resources for new nation
    async initializeResources(nationId) {
        const supabase = auth.getSupabase();

        const startingResources = [
            { resource_type: 'oil', amount: 500, production_rate: 10 },
            { resource_type: 'minerals', amount: 1000, production_rate: 15 },
            { resource_type: 'food', amount: 2000, production_rate: 25 },
            { resource_type: 'tech', amount: 100, production_rate: 5 }
        ];

        for (const resource of startingResources) {
            await supabase
                .from('resources')
                .insert({
                    nation_id: nationId,
                    ...resource
                });
        }
    }

    // Get nation by ID
    async getNation(nationId) {
        const supabase = auth.getSupabase();
        const { data, error } = await supabase
            .from('nations')
            .select('*')
            .eq('id', nationId)
            .single();

        if (error) throw error;
        return data;
    }

    // Get all nations
    async getAllNations() {
        const supabase = auth.getSupabase();
        const { data, error } = await supabase
            .from('nations')
            .select('id, name, flag_url, political_system, gdp, territory_center')
            .order('gdp', { ascending: false });

        if (error) throw error;
        return data || [];
    }

    // Get nation rankings
    async getRankings(category = 'gdp', limit = 10) {
        const supabase = auth.getSupabase();

        const validCategories = ['gdp', 'military_power', 'stability', 'population'];
        if (!validCategories.includes(category)) {
            category = 'gdp';
        }

        const { data, error } = await supabase
            .from('nations')
            .select('id, name, flag_url, gdp, stability, population')
            .order(category, { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    }

    // Update nation data
    async updateNation(nationId, updates) {
        const supabase = auth.getSupabase();

        // Validate owner
        const nation = await this.getNation(nationId);
        if (nation.owner_id !== auth.getUser()?.id) {
            throw new Error('Not authorized to update this nation');
        }

        const { data, error } = await supabase
            .from('nations')
            .update(updates)
            .eq('id', nationId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // Claim territory
    async claimTerritory(nationId, countryName, geoJson, center) {
        const supabase = auth.getSupabase();

        // Check if territory is already claimed
        const { data: existing } = await supabase
            .from('nations')
            .select('id, name')
            .contains('claimed_territories', [countryName])
            .single();

        if (existing) {
            throw new Error(`Territory already claimed by ${existing.name}`);
        }

        // Update nation's territory
        const { data: nation } = await supabase
            .from('nations')
            .select('claimed_territories')
            .eq('id', nationId)
            .single();

        const territories = nation.claimed_territories || [];
        territories.push(countryName);

        await supabase
            .from('nations')
            .update({
                claimed_territories: territories,
                territory_geojson: geoJson,
                territory_center: center
            })
            .eq('id', nationId);

        return true;
    }

    // Change political system (constitution change)
    async changePoliticalSystem(nationId, newSystem, byForce = false) {
        const supabase = auth.getSupabase();

        const nation = await this.getNation(nationId);

        // Check if valid transition
        if (!byForce && nation.political_system === 'democracy') {
            // Democracies need referendum
            throw new Error('Democratic nations require a referendum to change government');
        }

        // Apply stability penalty
        const stabilityPenalty = byForce ? 30 : 10;

        await supabase
            .from('nations')
            .update({
                political_system: newSystem,
                stability: Math.max(0, nation.stability - stabilityPenalty),
                system_changed_at: new Date().toISOString()
            })
            .eq('id', nationId);

        return true;
    }

    // Calculate nation power score
    calculatePowerScore(nation, resources, military, citizens) {
        let score = 0;

        // Economic power (40%)
        score += nation.gdp * 0.4;
        score += nation.treasury * 0.001;

        // Military power (35%)
        if (military) {
            for (const unit of military) {
                const config = CONFIG.UNITS[unit.unit_type.toUpperCase()];
                if (config) {
                    score += unit.count * (config.attack + config.defense) * 0.35;
                }
            }
        }

        // Stability and citizens (15%)
        score += nation.stability * 10;
        if (citizens) {
            score += citizens.length * 50;
        }

        // Technology (10%)
        // Would add tech score here

        return Math.round(score);
    }

    // Get nation color for map display
    getNationColor(nation) {
        // Generate consistent color from nation ID
        const hash = nation.id.split('').reduce((acc, char) => {
            return char.charCodeAt(0) + ((acc << 5) - acc);
        }, 0);

        const hue = Math.abs(hash) % 360;
        return `hsl(${hue}, 70%, 50%)`;
    }
}

const nationManager = new NationManager();
export default nationManager;
