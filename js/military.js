// World State Craft - Military System (Tribal Wars inspired)
import CONFIG from './config.js';
import auth from './auth.js';

class MilitaryManager {
    constructor() {
        this.activeAttacks = [];
        this.startAttackLoop();
    }

    startAttackLoop() {
        // Check for completed attacks every 10 seconds
        setInterval(() => this.processCompletedAttacks(), 10000);
    }

    // Get current military units for a nation
    async getMilitaryUnits(nationId) {
        const supabase = auth.getSupabase();
        const { data, error } = await supabase
            .from('military_units')
            .select('*')
            .eq('nation_id', nationId);

        if (error) throw error;
        return data || [];
    }

    // Train new units
    async trainUnits(nationId, unitType, count) {
        const supabase = auth.getSupabase();
        const unitConfig = CONFIG.UNITS[unitType.toUpperCase()];

        if (!unitConfig) throw new Error('Invalid unit type');

        // Check and deduct treasury
        const { data: nation } = await supabase
            .from('nations')
            .select('treasury, political_system')
            .eq('id', nationId)
            .single();

        // Military dictatorships get cost reduction
        let costMultiplier = 1;
        if (nation.political_system === 'dictatorship') {
            costMultiplier = 0.75;
        }

        const totalCost = unitConfig.cost * count * costMultiplier;

        if (nation.treasury < totalCost) {
            throw new Error('Insufficient funds');
        }

        // Deduct cost
        await supabase
            .from('nations')
            .update({ treasury: nation.treasury - totalCost })
            .eq('id', nationId);

        // Add or update units
        const { data: existing } = await supabase
            .from('military_units')
            .select('*')
            .eq('nation_id', nationId)
            .eq('unit_type', unitType)
            .single();

        if (existing) {
            await supabase
                .from('military_units')
                .update({ count: existing.count + count })
                .eq('id', existing.id);
        } else {
            await supabase
                .from('military_units')
                .insert({
                    nation_id: nationId,
                    unit_type: unitType,
                    count: count,
                    stationed_territory: null
                });
        }

        return { cost: totalCost, units: count };
    }

    // Launch attack (Tribal Wars style)
    async launchAttack(attackerNationId, defenderNationId, units, targetType = 'territory') {
        const supabase = auth.getSupabase();

        // Get both nations for distance calculation
        const { data: attacker } = await supabase
            .from('nations')
            .select('*, territory_center')
            .eq('id', attackerNationId)
            .single();

        const { data: defender } = await supabase
            .from('nations')
            .select('*, territory_center')
            .eq('id', defenderNationId)
            .single();

        // Check war declaration requirements
        if (attacker.political_system === 'democracy') {
            // Democracies need a vote - simplified to just checking if there's a casus belli
            const hasCasusBelli = await this.checkCasusBelli(attackerNationId, defenderNationId);
            if (!hasCasusBelli) {
                throw new Error('Democracy requires valid war reason (Casus Belli)');
            }
        }

        // Calculate travel time based on distance and slowest unit
        const distance = this.calculateDistance(attacker.territory_center, defender.territory_center);
        const slowestSpeed = this.getSlowestUnitSpeed(units);
        const travelTimeMinutes = Math.ceil(distance / slowestSpeed);

        const departureTime = new Date();
        const arrivalTime = new Date(departureTime.getTime() + travelTimeMinutes * 60000);

        // Deduct units from attacker
        for (const [unitType, count] of Object.entries(units)) {
            await this.removeUnits(attackerNationId, unitType, count);
        }

        // Create attack record
        const { data: attack, error } = await supabase
            .from('attacks')
            .insert({
                attacker_id: attackerNationId,
                defender_id: defenderNationId,
                units_sent: units,
                departure_time: departureTime.toISOString(),
                arrival_time: arrivalTime.toISOString(),
                target_type: targetType,
                status: 'traveling',
                result: null
            })
            .select()
            .single();

        if (error) throw error;

        return {
            attack,
            arrivalTime,
            travelTimeMinutes,
            distance
        };
    }

    // Calculate distance between two points (lat/lon)
    calculateDistance(point1, point2) {
        if (!point1 || !point2) return 100; // Default distance

        const R = 6371; // Earth radius in km
        const dLat = (point2.lat - point1.lat) * Math.PI / 180;
        const dLon = (point2.lon - point1.lon) * Math.PI / 180;

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    getSlowestUnitSpeed(units) {
        let slowest = Infinity;
        for (const unitType of Object.keys(units)) {
            const config = CONFIG.UNITS[unitType.toUpperCase()];
            if (config && config.speed < slowest) {
                slowest = config.speed;
            }
        }
        return slowest || 1;
    }

    async removeUnits(nationId, unitType, count) {
        const supabase = auth.getSupabase();

        const { data: existing } = await supabase
            .from('military_units')
            .select('*')
            .eq('nation_id', nationId)
            .eq('unit_type', unitType)
            .single();

        if (!existing || existing.count < count) {
            throw new Error(`Insufficient ${unitType} units`);
        }

        if (existing.count === count) {
            await supabase
                .from('military_units')
                .delete()
                .eq('id', existing.id);
        } else {
            await supabase
                .from('military_units')
                .update({ count: existing.count - count })
                .eq('id', existing.id);
        }
    }

    // Process completed attacks
    async processCompletedAttacks() {
        const supabase = auth.getSupabase();

        const now = new Date().toISOString();
        const { data: arrivedAttacks } = await supabase
            .from('attacks')
            .select('*')
            .eq('status', 'traveling')
            .lte('arrival_time', now);

        for (const attack of arrivedAttacks || []) {
            await this.resolveBattle(attack);
        }
    }

    // Resolve battle outcome
    async resolveBattle(attack) {
        const supabase = auth.getSupabase();

        // Get defender's units
        const defenderUnits = await this.getMilitaryUnits(attack.defender_id);

        // Calculate attack and defense power
        const attackPower = this.calculatePower(attack.units_sent, 'attack');

        // Include supply line penalty
        const supplyPenalty = this.calculateSupplyPenalty(attack);
        const effectiveAttackPower = attackPower * (1 - supplyPenalty);

        const defensePower = this.calculateDefensePower(defenderUnits);

        // Determine outcome
        const attackerWins = effectiveAttackPower > defensePower;
        const powerRatio = effectiveAttackPower / Math.max(defensePower, 1);

        // Calculate losses
        const attackerLosses = this.calculateLosses(attack.units_sent, attackerWins ? 0.3 : 0.7);
        const defenderLosses = this.calculateDefenderLosses(defenderUnits, attackerWins ? 0.7 : 0.3);

        // Apply losses
        for (const [unitType, count] of Object.entries(defenderLosses)) {
            await this.removeUnits(attack.defender_id, unitType, count);
        }

        // Return surviving attackers to attacker nation
        const survivors = {};
        for (const [unitType, sent] of Object.entries(attack.units_sent)) {
            const lost = attackerLosses[unitType] || 0;
            const surviving = sent - lost;
            if (surviving > 0) {
                survivors[unitType] = surviving;
                await this.addUnits(attack.attacker_id, unitType, surviving);
            }
        }

        // Update attack record
        const result = {
            winner: attackerWins ? 'attacker' : 'defender',
            attackerLosses,
            defenderLosses,
            survivors,
            effectivePower: effectiveAttackPower,
            defensePower,
            supplyPenalty
        };

        await supabase
            .from('attacks')
            .update({
                status: 'completed',
                result: result
            })
            .eq('id', attack.id);

        // If infrastructure target, apply damage
        if (attackerWins && attack.target_type !== 'territory') {
            await this.applyInfrastructureDamage(attack.defender_id, attack.target_type, powerRatio);
        }

        return result;
    }

    calculatePower(units, type) {
        let total = 0;
        for (const [unitType, count] of Object.entries(units)) {
            const config = CONFIG.UNITS[unitType.toUpperCase()];
            if (config) {
                total += config[type] * count;
            }
        }
        return total;
    }

    calculateDefensePower(units) {
        let total = 0;
        for (const unit of units) {
            const config = CONFIG.UNITS[unit.unit_type.toUpperCase()];
            if (config) {
                total += config.defense * unit.count;
            }
        }
        return total;
    }

    calculateSupplyPenalty(attack) {
        // The farther from home, the higher the penalty (max 50%)
        const distance = 1000; // Would calculate from actual coordinates
        return Math.min(0.5, distance / 10000);
    }

    calculateLosses(units, lossRate) {
        const losses = {};
        for (const [unitType, count] of Object.entries(units)) {
            losses[unitType] = Math.ceil(count * lossRate * (0.5 + Math.random() * 0.5));
        }
        return losses;
    }

    calculateDefenderLosses(units, lossRate) {
        const losses = {};
        for (const unit of units) {
            losses[unit.unit_type] = Math.ceil(unit.count * lossRate * (0.5 + Math.random() * 0.5));
        }
        return losses;
    }

    async addUnits(nationId, unitType, count) {
        const supabase = auth.getSupabase();

        const { data: existing } = await supabase
            .from('military_units')
            .select('*')
            .eq('nation_id', nationId)
            .eq('unit_type', unitType)
            .single();

        if (existing) {
            await supabase
                .from('military_units')
                .update({ count: existing.count + count })
                .eq('id', existing.id);
        } else {
            await supabase
                .from('military_units')
                .insert({
                    nation_id: nationId,
                    unit_type: unitType,
                    count: count
                });
        }
    }

    async applyInfrastructureDamage(nationId, targetType, powerRatio) {
        const supabase = auth.getSupabase();

        // Reduce production based on target
        const damageAmount = Math.min(50, powerRatio * 20); // Max 50% damage

        // This would update the nation's production rates
        // For now, just log the damage
        console.log(`Infrastructure damage: ${targetType} -${damageAmount}%`);
    }

    async checkCasusBelli(attackerId, defenderId) {
        // Simplified: Check if there's a valid reason for war
        // In full implementation, would check treaties, border disputes, etc.
        return true;
    }

    // Precision strike (missile attack on specific building)
    async launchPrecisionStrike(attackerNationId, defenderNationId, targetBuilding, missileCount) {
        const supabase = auth.getSupabase();

        // Check if attacker has missiles
        const units = await this.getMilitaryUnits(attackerNationId);
        const missiles = units.find(u => u.unit_type === 'missile');

        if (!missiles || missiles.count < missileCount) {
            throw new Error('Insufficient missiles');
        }

        // Remove missiles
        await this.removeUnits(attackerNationId, 'missile', missileCount);

        // Apply damage to target building
        const damage = missileCount * CONFIG.UNITS.MISSILE.attack;
        await this.applyInfrastructureDamage(defenderNationId, targetBuilding, damage / 100);

        return {
            missilesUsed: missileCount,
            damage,
            target: targetBuilding
        };
    }
}

const military = new MilitaryManager();
export default military;
