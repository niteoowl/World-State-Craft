-- FIX SIGNUP 500 ERROR
-- Run this script in the Supabase SQL Editor

-- 1. Drop the existing broken trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Create a standard profiles table if it doesn't exist
-- This ensures user data has a place to live even if the frontend doesn't use it yet.
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT,
    full_name TEXT,
    avatar_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to view/edit their own profile
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- 3. Create a ROBUST handle_new_user function
-- We add 'SECURITY DEFINER' to run as admin
-- We add 'SET search_path = public' to fix the "mutable search_path" security warning
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, full_name, avatar_url)
    VALUES (
        new.id,
        -- Use email prefix as default username if none provided
        COALESCE(new.raw_user_meta_data->>'username', SPLIT_PART(new.email, '@', 1)),
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'avatar_url'
    );
    RETURN new;
EXCEPTION WHEN OTHERS THEN
    -- If profile creation fails, we LOG the error but DO NOT FAIL the signup transaction.
    -- This ensures the user is still created in auth.users.
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Re-attach the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5. Fix RLS Policy Performance (Optional but recommended by your logs)
-- Using (SELECT auth.uid()) is faster than auth.uid() in loops
DROP POLICY IF EXISTS "Users can create their own nation" ON nations;
CREATE POLICY "Users can create their own nation" ON nations
    FOR INSERT WITH CHECK ((SELECT auth.uid()) = owner_id);

DROP POLICY IF EXISTS "Users can update their own nation" ON nations;
CREATE POLICY "Users can update their own nation" ON nations
    FOR UPDATE USING ((SELECT auth.uid()) = owner_id);
