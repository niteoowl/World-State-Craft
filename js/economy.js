// World State Craft - Economy System
import CONFIG from './config.js';
import auth from './auth.js';

class EconomyManager {
    constructor() {
        this.marketPrices = {};
        this.exchangeRates = {};
        this.initializeMarket();
    }

    initializeMarket() {
        // Set base market prices from config
        Object.entries(CONFIG.RESOURCES).forEach(([key, resource]) => {
            this.marketPrices[resource.id] = resource.baseValue;
        });
    }

    // Get current resources for a nation
    async getNationResources(nationId) {
        const supabase = auth.getSupabase();
        const { data, error } = await supabase
            .from('resources')
            .select('*')
            .eq('nation_id', nationId);

        if (error) throw error;
        return data;
    }

    // Update resource amount
    async updateResource(nationId, resourceType, amount) {
        const supabase = auth.getSupabase();

        const { data: existing } = await supabase
            .from('resources')
            .select('*')
            .eq('nation_id', nationId)
            .eq('resource_type', resourceType)
            .single();

        if (existing) {
            const { error } = await supabase
                .from('resources')
                .update({ amount: existing.amount + amount })
                .eq('id', existing.id);
            if (error) throw error;
        } else {
            const { error } = await supabase
                .from('resources')
                .insert({
                    nation_id: nationId,
                    resource_type: resourceType,
                    amount: amount,
                    production_rate: CONFIG.GAME.BASE_RESOURCE_PRODUCTION
                });
            if (error) throw error;
        }
    }

    // Process resource production tick
    async processProductionTick(nationId) {
        const supabase = auth.getSupabase();

        // Get nation's territories and calculate production
        const { data: nation } = await supabase
            .from('nations')
            .select('*, territories(*)')
            .eq('id', nationId)
            .single();

        if (!nation) return;

        // Get citizen bonuses
        const { data: citizens } = await supabase
            .from('citizens')
            .select('*')
            .eq('nation_id', nationId)
            .eq('job_type', 'industrial');

        const citizenBonus = citizens ? 1 + (citizens.length * 0.1) : 1;

        // Get trait bonuses
        const traitBonus = this.getTraitProductionBonus(nation.geopolitical_trait);

        // Update each resource
        const resources = await this.getNationResources(nationId);
        for (const resource of resources) {
            const production = resource.production_rate * citizenBonus * traitBonus;
            await this.updateResource(nationId, resource.resource_type, production);
        }

        // Update treasury (GDP-based income)
        await supabase
            .from('nations')
            .update({
                treasury: nation.treasury + (nation.gdp * 0.01),
                updated_at: new Date().toISOString()
            })
            .eq('id', nationId);
    }

    getTraitProductionBonus(trait) {
        const traitConfig = CONFIG.TRAITS[trait?.toUpperCase()];
        if (traitConfig?.bonuses?.resourceProduction) {
            return 1 + traitConfig.bonuses.resourceProduction;
        }
        return 1;
    }

    // Create trade offer
    async createTradeOffer(fromNationId, toNationId, offerResources, requestResources) {
        const supabase = auth.getSupabase();

        const { data, error } = await supabase
            .from('trade_offers')
            .insert({
                from_nation: fromNationId,
                to_nation: toNationId,
                offer_resources: offerResources,
                request_resources: requestResources,
                status: 'pending',
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // Accept trade offer
    async acceptTradeOffer(offerId) {
        const supabase = auth.getSupabase();

        const { data: offer } = await supabase
            .from('trade_offers')
            .select('*')
            .eq('id', offerId)
            .single();

        if (!offer || offer.status !== 'pending') {
            throw new Error('Trade offer not available');
        }

        // Transfer resources
        for (const [resource, amount] of Object.entries(offer.offer_resources)) {
            await this.updateResource(offer.from_nation, resource, -amount);
            await this.updateResource(offer.to_nation, resource, amount);
        }

        for (const [resource, amount] of Object.entries(offer.request_resources)) {
            await this.updateResource(offer.to_nation, resource, -amount);
            await this.updateResource(offer.from_nation, resource, amount);
        }

        // Update offer status
        await supabase
            .from('trade_offers')
            .update({ status: 'accepted' })
            .eq('id', offerId);

        return true;
    }

    // Calculate inflation based on treasury spending
    calculateInflation(nation) {
        const spendingRate = nation.monthly_spending / nation.gdp;
        if (spendingRate > 0.3) {
            return (spendingRate - 0.3) * 100; // Inflation percentage
        }
        return 0;
    }

    // Currency exchange attack
    async performCurrencyAttack(attackerNationId, targetNationId, amount) {
        const supabase = auth.getSupabase();

        // Deduct from attacker's treasury
        const { data: attacker } = await supabase
            .from('nations')
            .select('*')
            .eq('id', attackerNationId)
            .single();

        if (attacker.treasury < amount) {
            throw new Error('Insufficient funds for currency attack');
        }

        // Apply damage to target's exchange rate stability
        const { data: target } = await supabase
            .from('nations')
            .select('*')
            .eq('id', targetNationId)
            .single();

        const damage = amount / target.gdp * 10; // 10% of target GDP = 10% exchange rate damage

        await supabase
            .from('nations')
            .update({
                treasury: attacker.treasury - amount,
                exchange_rate_stability: Math.max(0, (attacker.exchange_rate_stability || 100) - 5)
            })
            .eq('id', attackerNationId);

        await supabase
            .from('nations')
            .update({
                exchange_rate_stability: Math.max(0, (target.exchange_rate_stability || 100) - damage)
            })
            .eq('id', targetNationId);

        return { damage, cost: amount };
    }

    // Get market prices with supply/demand
    getMarketPrice(resourceType, supply, demand) {
        const basePrice = this.marketPrices[resourceType] || 100;
        const ratio = demand / Math.max(supply, 1);
        return Math.round(basePrice * ratio);
    }
}

const economy = new EconomyManager();
export default economy;
