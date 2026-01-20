// World State Craft - Politics & World Assembly System
import CONFIG from './config.js';
import auth from './auth.js';

class PoliticsManager {
    constructor() {
        this.securityCouncil = []; // Top 5 nations
    }

    // Get World Assembly resolutions
    async getResolutions(status = 'voting') {
        const supabase = auth.getSupabase();
        const { data, error } = await supabase
            .from('resolutions')
            .select('*, proposer:nations(name, flag_url)')
            .eq('status', status)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }

    // Propose new resolution
    async proposeResolution(nationId, title, description, type) {
        const supabase = auth.getSupabase();

        // Check if nation can propose (needs certain standing)
        const { data: nation } = await supabase
            .from('nations')
            .select('*')
            .eq('id', nationId)
            .single();

        const { data, error } = await supabase
            .from('resolutions')
            .insert({
                title,
                description,
                proposer_id: nationId,
                resolution_type: type,
                votes_for: 0,
                votes_against: 0,
                status: 'voting',
                created_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // Vote on resolution
    async voteOnResolution(resolutionId, nationId, vote) {
        const supabase = auth.getSupabase();

        // Check if already voted
        const { data: existing } = await supabase
            .from('resolution_votes')
            .select('*')
            .eq('resolution_id', resolutionId)
            .eq('nation_id', nationId)
            .single();

        if (existing) {
            throw new Error('Already voted on this resolution');
        }

        // Get nation's voting power (based on GDP)
        const { data: nation } = await supabase
            .from('nations')
            .select('gdp')
            .eq('id', nationId)
            .single();

        const votingPower = Math.ceil(Math.log10(nation.gdp || 1000));

        // Record vote
        await supabase
            .from('resolution_votes')
            .insert({
                resolution_id: resolutionId,
                nation_id: nationId,
                vote: vote,
                voting_power: votingPower
            });

        // Update resolution totals
        const { data: resolution } = await supabase
            .from('resolutions')
            .select('*')
            .eq('id', resolutionId)
            .single();

        const updateField = vote === 'for' ? 'votes_for' : 'votes_against';
        await supabase
            .from('resolutions')
            .update({
                [updateField]: resolution[updateField] + votingPower
            })
            .eq('id', resolutionId);

        return { votingPower, vote };
    }

    // Security Council veto
    async vetoResolution(resolutionId, nationId) {
        const supabase = auth.getSupabase();

        // Check if nation is on Security Council
        const isOnCouncil = await this.isSecurityCouncilMember(nationId);
        if (!isOnCouncil) {
            throw new Error('Only Security Council members can veto');
        }

        await supabase
            .from('resolutions')
            .update({
                status: 'vetoed',
                vetoed_by: nationId
            })
            .eq('id', resolutionId);

        return true;
    }

    // Check Security Council membership
    async isSecurityCouncilMember(nationId) {
        const council = await this.getSecurityCouncil();
        return council.some(n => n.id === nationId);
    }

    // Get top 5 nations (Security Council)
    async getSecurityCouncil() {
        const supabase = auth.getSupabase();
        const { data } = await supabase
            .from('nations')
            .select('id, name, flag_url, gdp')
            .order('gdp', { ascending: false })
            .limit(5);

        this.securityCouncil = data || [];
        return this.securityCouncil;
    }

    // Issue sanctions against a nation
    async issueSanctions(targetNationId, issuerId, reason) {
        const supabase = auth.getSupabase();

        // Create sanction proposal
        const { data, error } = await supabase
            .from('sanctions')
            .insert({
                target_nation: targetNationId,
                issuer_id: issuerId,
                reason: reason,
                votes: 1,
                active: false, // Needs Security Council approval
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // Apply active sanctions effects
    async applySanctionsEffects(nationId) {
        const supabase = auth.getSupabase();

        const { data: sanctions } = await supabase
            .from('sanctions')
            .select('*')
            .eq('target_nation', nationId)
            .eq('active', true);

        if (!sanctions || sanctions.length === 0) return null;

        // Calculate total sanctions impact
        let tradePenalty = 0;
        let treasuryFreeze = false;

        for (const sanction of sanctions) {
            tradePenalty += 0.2; // 20% per sanction
            if (sanction.reason === 'war_crimes' || sanction.reason === 'nuclear') {
                treasuryFreeze = true;
            }
        }

        return {
            tradePenalty: Math.min(tradePenalty, 0.9), // Max 90%
            treasuryFreeze,
            sanctionCount: sanctions.length
        };
    }

    // Create alliance/treaty
    async createTreaty(nationAId, nationBId, treatyType, terms) {
        const supabase = auth.getSupabase();

        const { data, error } = await supabase
            .from('treaties')
            .insert({
                nation_a: nationAId,
                nation_b: nationBId,
                treaty_type: treatyType, // alliance, non-aggression, trade, mutual_defense
                terms: terms,
                status: 'pending',
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // Accept treaty
    async acceptTreaty(treatyId, nationId) {
        const supabase = auth.getSupabase();

        const { data: treaty } = await supabase
            .from('treaties')
            .select('*')
            .eq('id', treatyId)
            .single();

        if (!treaty || treaty.nation_b !== nationId) {
            throw new Error('Cannot accept this treaty');
        }

        await supabase
            .from('treaties')
            .update({
                status: 'active',
                accepted_at: new Date().toISOString()
            })
            .eq('id', treatyId);

        return true;
    }

    // Get nation's treaties
    async getNationTreaties(nationId) {
        const supabase = auth.getSupabase();

        const { data } = await supabase
            .from('treaties')
            .select('*, nation_a:nations!treaties_nation_a_fkey(*), nation_b:nations!treaties_nation_b_fkey(*)')
            .or(`nation_a.eq.${nationId},nation_b.eq.${nationId}`)
            .eq('status', 'active');

        return data || [];
    }

    // Check if two nations are allies
    async areAllies(nationAId, nationBId) {
        const treaties = await this.getNationTreaties(nationAId);
        return treaties.some(t =>
            (t.treaty_type === 'alliance' || t.treaty_type === 'mutual_defense') &&
            (t.nation_a === nationBId || t.nation_b === nationBId)
        );
    }

    // Deploy PKF (Peace Keeping Forces)
    async deployPKF(targetNationId, contributingNations) {
        const supabase = auth.getSupabase();

        // Collect units from contributing nations
        const pkfUnits = {};
        for (const { nationId, units } of contributingNations) {
            for (const [unitType, count] of Object.entries(units)) {
                pkfUnits[unitType] = (pkfUnits[unitType] || 0) + count;
            }
        }

        // Create PKF deployment
        const { data, error } = await supabase
            .from('pkf_deployments')
            .insert({
                target_nation: targetNationId,
                contributing_nations: contributingNations.map(c => c.nationId),
                units: pkfUnits,
                status: 'active',
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // Get base currency nation (highest GDP)
    async getBaseCurrencyNation() {
        const supabase = auth.getSupabase();
        const { data } = await supabase
            .from('nations')
            .select('id, name, currency_name')
            .order('gdp', { ascending: false })
            .limit(1)
            .single();

        return data;
    }
}

const politics = new PoliticsManager();
export default politics;
