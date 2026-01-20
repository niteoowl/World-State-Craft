// World State Craft - Authentication Module
import CONFIG from './config.js';

class AuthManager {
    constructor() {
        this.supabase = null;
        this.user = null;
        this.nation = null;

        // Initialization promise
        this.readyPromise = new Promise((resolve) => {
            this.resolveReady = resolve;
        });

        this.init();
    }

    async init() {
        try {
            // Initialize Supabase client
            const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
            this.supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

            // Check existing session - fail gracefully if aborted
            try {
                const { data: { session } } = await this.supabase.auth.getSession();
                if (session) {
                    this.user = session.user;
                    await this.loadNation();
                }
            } catch (err) {
                console.warn('Session check failed (likely network abort), proceeding as guest:', err);
            }

            // Listen for auth changes
            this.supabase.auth.onAuthStateChange(async (event, session) => {
                if (event === 'SIGNED_IN') {
                    this.user = session.user;
                    await this.loadNation();
                    window.dispatchEvent(new CustomEvent('auth:signin', { detail: this.user }));
                } else if (event === 'SIGNED_OUT') {
                    this.user = null;
                    this.nation = null;
                    window.dispatchEvent(new CustomEvent('auth:signout'));
                }
            });
        } catch (error) {
            console.error('Auth initialization failed:', error);
        } finally {
            this.resolveReady();
        }
    }

    async ensureReady() {
        return this.readyPromise;
    }

    async signUp(email, password, metadata = {}) {
        const { data, error } = await this.supabase.auth.signUp({
            email,
            password,
            options: {
                data: metadata,
                // If email confirmation is enabled, redirect back to here
                emailRedirectTo: window.location.origin
            }
        });

        if (error) throw error;

        // Auto sign-in after signup (no email verification)
        if (data.user && !data.session) {
            // If no session, sign in immediately
            return await this.signIn(email, password);
        }

        return data;
    }

    async signIn(email, password) {
        const { data, error } = await this.supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;
        return data;
    }

    async signOut() {
        const { error } = await this.supabase.auth.signOut();
        if (error) throw error;
    }

    async loadNation() {
        if (!this.user) return null;

        const { data, error } = await this.supabase
            .from('nations')
            .select('*')
            .eq('owner_id', this.user.id)
            .eq('owner_id', this.user.id)
            .maybeSingle(); // Use maybeSingle to avoid 406 error if no nation exists

        if (!error && data) {
            this.nation = data;
        }
        return this.nation;
    }

    async createNation(nationData) {
        if (!this.user) throw new Error('Must be logged in to create a nation');

        const { data, error } = await this.supabase
            .from('nations')
            .insert({
                ...nationData,
                owner_id: this.user.id,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        this.nation = data;
        return data;
    }

    hasNation() {
        return this.nation !== null;
    }

    isLoggedIn() {
        return this.user !== null;
    }

    getUser() {
        return this.user;
    }

    getNation() {
        return this.nation;
    }

    getSupabase() {
        return this.supabase;
    }
}

// Singleton instance
const auth = new AuthManager();
export default auth;
