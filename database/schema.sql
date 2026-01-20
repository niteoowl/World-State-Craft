-- World State Craft Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================================================
-- NATIONS TABLE
-- ==================================================
CREATE TABLE IF NOT EXISTS nations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    motto VARCHAR(200),
    currency_name VARCHAR(50) DEFAULT 'Sover',
    flag_url TEXT,
    
    -- Core attributes
    political_system VARCHAR(50) DEFAULT 'democracy',
    geopolitical_trait VARCHAR(50) DEFAULT 'peninsula',
    national_bonus VARCHAR(50) DEFAULT 'financial_hub',
    
    -- Economy
    treasury BIGINT DEFAULT 10000,
    gdp BIGINT DEFAULT 1000,
    exchange_rate_stability DECIMAL(5,2) DEFAULT 100.00,
    monthly_spending BIGINT DEFAULT 0,
    
    -- Status
    stability DECIMAL(5,2) DEFAULT 80.00,
    population INTEGER DEFAULT 1,
    
    -- Territory
    territory_geojson JSONB,
    territory_center JSONB,
    claimed_territories TEXT[],
    
    -- Special flags
    has_nuclear BOOLEAN DEFAULT FALSE,
    
    -- Ownership
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    system_changed_at TIMESTAMP WITH TIME ZONE
);

-- Index for faster lookups
CREATE INDEX idx_nations_owner ON nations(owner_id);
CREATE INDEX idx_nations_gdp ON nations(gdp DESC);

-- ==================================================
-- CITIZENS TABLE
-- ==================================================
CREATE TABLE IF NOT EXISTS citizens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    nation_id UUID REFERENCES nations(id) ON DELETE CASCADE,
    
    -- Job assignment
    job_type VARCHAR(50) DEFAULT 'industrial',
    expertise_level DECIMAL(4,2) DEFAULT 1.00,
    
    -- Timestamps
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    job_changed_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(user_id) -- Each user can only be citizen of one nation
);

CREATE INDEX idx_citizens_nation ON citizens(nation_id);

-- ==================================================
-- RESOURCES TABLE
-- ==================================================
CREATE TABLE IF NOT EXISTS resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nation_id UUID REFERENCES nations(id) ON DELETE CASCADE,
    
    resource_type VARCHAR(50) NOT NULL,
    amount BIGINT DEFAULT 0,
    production_rate DECIMAL(10,2) DEFAULT 10.00,
    
    UNIQUE(nation_id, resource_type)
);

CREATE INDEX idx_resources_nation ON resources(nation_id);

-- ==================================================
-- TECHNOLOGIES TABLE
-- ==================================================
CREATE TABLE IF NOT EXISTS technologies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nation_id UUID REFERENCES nations(id) ON DELETE CASCADE,
    
    tech_name VARCHAR(100) NOT NULL,
    level INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'completed',
    
    -- Research timing
    started_at TIMESTAMP WITH TIME ZONE,
    completes_at TIMESTAMP WITH TIME ZONE,
    unlocked_at TIMESTAMP WITH TIME ZONE,
    
    -- If shared from ally
    shared_from UUID REFERENCES nations(id),
    
    UNIQUE(nation_id, tech_name)
);

CREATE INDEX idx_tech_nation ON technologies(nation_id);

-- ==================================================
-- MILITARY UNITS TABLE
-- ==================================================
CREATE TABLE IF NOT EXISTS military_units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nation_id UUID REFERENCES nations(id) ON DELETE CASCADE,
    
    unit_type VARCHAR(50) NOT NULL,
    count INTEGER DEFAULT 0,
    stationed_territory VARCHAR(200),
    
    UNIQUE(nation_id, unit_type)
);

CREATE INDEX idx_military_nation ON military_units(nation_id);

-- ==================================================
-- ATTACKS TABLE (Tribal Wars style)
-- ==================================================
CREATE TABLE IF NOT EXISTS attacks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attacker_id UUID REFERENCES nations(id) ON DELETE CASCADE,
    defender_id UUID REFERENCES nations(id) ON DELETE CASCADE,
    
    units_sent JSONB NOT NULL,
    target_type VARCHAR(50) DEFAULT 'territory',
    
    -- Timing
    departure_time TIMESTAMP WITH TIME ZONE NOT NULL,
    arrival_time TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Status & Result
    status VARCHAR(50) DEFAULT 'traveling',
    result JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_attacks_attacker ON attacks(attacker_id);
CREATE INDEX idx_attacks_defender ON attacks(defender_id);
CREATE INDEX idx_attacks_status ON attacks(status);
CREATE INDEX idx_attacks_arrival ON attacks(arrival_time);

-- ==================================================
-- TREATIES TABLE
-- ==================================================
CREATE TABLE IF NOT EXISTS treaties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nation_a UUID REFERENCES nations(id) ON DELETE CASCADE,
    nation_b UUID REFERENCES nations(id) ON DELETE CASCADE,
    
    treaty_type VARCHAR(50) NOT NULL,
    terms JSONB,
    status VARCHAR(50) DEFAULT 'pending',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    accepted_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_treaties_nations ON treaties(nation_a, nation_b);

-- ==================================================
-- TRADE OFFERS TABLE
-- ==================================================
CREATE TABLE IF NOT EXISTS trade_offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_nation UUID REFERENCES nations(id) ON DELETE CASCADE,
    to_nation UUID REFERENCES nations(id) ON DELETE CASCADE,
    
    offer_resources JSONB NOT NULL,
    request_resources JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_trade_from ON trade_offers(from_nation);
CREATE INDEX idx_trade_to ON trade_offers(to_nation);

-- ==================================================
-- SANCTIONS TABLE
-- ==================================================
CREATE TABLE IF NOT EXISTS sanctions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_nation UUID REFERENCES nations(id) ON DELETE CASCADE,
    issuer_id UUID REFERENCES nations(id) ON DELETE SET NULL,
    
    reason VARCHAR(200),
    votes INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ==================================================
-- RESOLUTIONS TABLE (World Assembly)
-- ==================================================
CREATE TABLE IF NOT EXISTS resolutions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    resolution_type VARCHAR(50),
    
    proposer_id UUID REFERENCES nations(id) ON DELETE SET NULL,
    
    votes_for INTEGER DEFAULT 0,
    votes_against INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'voting',
    vetoed_by UUID REFERENCES nations(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_resolutions_status ON resolutions(status);

-- ==================================================
-- RESOLUTION VOTES TABLE
-- ==================================================
CREATE TABLE IF NOT EXISTS resolution_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resolution_id UUID REFERENCES resolutions(id) ON DELETE CASCADE,
    nation_id UUID REFERENCES nations(id) ON DELETE CASCADE,
    
    vote VARCHAR(10) NOT NULL,
    voting_power INTEGER DEFAULT 1,
    
    UNIQUE(resolution_id, nation_id)
);

-- ==================================================
-- PKF DEPLOYMENTS TABLE
-- ==================================================
CREATE TABLE IF NOT EXISTS pkf_deployments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_nation UUID REFERENCES nations(id) ON DELETE CASCADE,
    
    contributing_nations UUID[],
    units JSONB,
    status VARCHAR(50) DEFAULT 'active',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ==================================================
-- ROW LEVEL SECURITY (RLS)
-- ==================================================

-- Enable RLS
ALTER TABLE nations ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizens ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE technologies ENABLE ROW LEVEL SECURITY;
ALTER TABLE military_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE attacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE treaties ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sanctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE resolution_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pkf_deployments ENABLE ROW LEVEL SECURITY;

-- Nations: Anyone can read, only owner can update
CREATE POLICY "Nations are viewable by everyone" ON nations
    FOR SELECT USING (true);

CREATE POLICY "Users can create their own nation" ON nations
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own nation" ON nations
    FOR UPDATE USING (auth.uid() = owner_id);

-- Citizens: Anyone can read, user controls own citizenship
CREATE POLICY "Citizens are viewable by everyone" ON citizens
    FOR SELECT USING (true);

CREATE POLICY "Users can join nations" ON citizens
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave nations" ON citizens
    FOR DELETE USING (auth.uid() = user_id);

-- Resources: Viewable by all, only nation owner can modify
CREATE POLICY "Resources are viewable by everyone" ON resources
    FOR SELECT USING (true);

CREATE POLICY "Nation owners can manage resources" ON resources
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM nations 
            WHERE nations.id = resources.nation_id 
            AND nations.owner_id = auth.uid()
        )
    );

-- Technologies: Viewable by all, owner manages
CREATE POLICY "Technologies are viewable by everyone" ON technologies
    FOR SELECT USING (true);

CREATE POLICY "Nation owners can research" ON technologies
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM nations 
            WHERE nations.id = technologies.nation_id 
            AND nations.owner_id = auth.uid()
        )
    );

CREATE POLICY "Nation owners can update tech" ON technologies
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM nations 
            WHERE nations.id = technologies.nation_id 
            AND nations.owner_id = auth.uid()
        )
    );

-- Military: Viewable by all, owner manages
CREATE POLICY "Military viewable by all" ON military_units
    FOR SELECT USING (true);

CREATE POLICY "Owner manages military" ON military_units
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM nations 
            WHERE nations.id = military_units.nation_id 
            AND nations.owner_id = auth.uid()
        )
    );

-- Attacks: Viewable by participants
CREATE POLICY "Attacks viewable by participants" ON attacks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM nations 
            WHERE (nations.id = attacks.attacker_id OR nations.id = attacks.defender_id)
            AND nations.owner_id = auth.uid()
        ) OR true -- For now, all visible for debugging
    );

CREATE POLICY "Attacker can create attacks" ON attacks
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM nations 
            WHERE nations.id = attacks.attacker_id 
            AND nations.owner_id = auth.uid()
        )
    );

-- Treaties, Trade, etc: Generally viewable
CREATE POLICY "Treaties viewable by all" ON treaties FOR SELECT USING (true);
CREATE POLICY "Trade offers viewable by participants" ON trade_offers FOR SELECT USING (true);
CREATE POLICY "Sanctions viewable by all" ON sanctions FOR SELECT USING (true);
CREATE POLICY "Resolutions viewable by all" ON resolutions FOR SELECT USING (true);
CREATE POLICY "Resolution votes viewable" ON resolution_votes FOR SELECT USING (true);
CREATE POLICY "PKF deployments viewable" ON pkf_deployments FOR SELECT USING (true);

-- Insert policies for diplomatic actions
CREATE POLICY "Create treaties" ON treaties
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM nations WHERE nations.id = treaties.nation_a AND nations.owner_id = auth.uid())
    );

CREATE POLICY "Accept treaties" ON treaties
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM nations WHERE nations.id = treaties.nation_b AND nations.owner_id = auth.uid())
    );

CREATE POLICY "Create trade offers" ON trade_offers
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM nations WHERE nations.id = trade_offers.from_nation AND nations.owner_id = auth.uid())
    );

CREATE POLICY "Propose resolutions" ON resolutions
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM nations WHERE nations.id = resolutions.proposer_id AND nations.owner_id = auth.uid())
    );

CREATE POLICY "Vote on resolutions" ON resolution_votes
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM nations WHERE nations.id = resolution_votes.nation_id AND nations.owner_id = auth.uid())
    );

-- ==================================================
-- STORAGE BUCKET FOR FLAGS
-- ==================================================
-- Run this in Supabase Storage settings or SQL:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('nation-assets', 'nation-assets', true);
