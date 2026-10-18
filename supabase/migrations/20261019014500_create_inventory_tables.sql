-- ==============================================================================
-- ShelfSafe Schema Migration: Inventory Tables, Constraints, Indexes & RLS
-- ==============================================================================

-- 1. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed standard categories
INSERT INTO public.categories (name) VALUES
    ('Beverages'),
    ('Canned Goods'),
    ('Biscuits and Snacks'),
    ('Noodles'),
    ('Condiments'),
    ('Dairy Products'),
    ('Over-the-Counter Medicines')
ON CONFLICT (name) DO NOTHING;

-- 2. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    barcode TEXT,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (price >= 0),
    low_stock_level INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_level >= 0),
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rule: Same barcode can exist only once per owner (allowing multiple barcode-less items)
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_owner_barcode 
    ON public.products (owner_id, barcode) 
    WHERE barcode IS NOT NULL AND barcode <> '';

-- Performance indexes for products
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products (barcode);
CREATE INDEX IF NOT EXISTS idx_products_owner_id ON public.products (owner_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products (category_id);

-- 3. BATCHES TABLE
-- Rule: ON DELETE RESTRICT on product_id ensures a product with batches cannot be deleted (must be archived)
CREATE TABLE IF NOT EXISTS public.batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity_left INTEGER NOT NULL DEFAULT 0 CHECK (quantity_left >= 0),
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiration_date DATE NOT NULL,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_batches_expiration_date CHECK (expiration_date >= purchase_date)
);

-- Performance indexes for batches (crucial for FEFO sorting and product lookups)
CREATE INDEX IF NOT EXISTS idx_batches_expiration_date ON public.batches (expiration_date);
CREATE INDEX IF NOT EXISTS idx_batches_product_id ON public.batches (product_id);

-- 4. SALES_SCANS TABLE
CREATE TABLE IF NOT EXISTS public.sales_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_undone BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_sales_scans_owner_id ON public.sales_scans (owner_id);

-- 5. DEDUCTIONS TABLE
-- Rule: ON DELETE RESTRICT on batch_id and sales_scan_id ensures records with history cannot be deleted
CREATE TABLE IF NOT EXISTS public.deductions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_scan_id UUID NOT NULL REFERENCES public.sales_scans(id) ON DELETE RESTRICT,
    batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deductions_sales_scan_id ON public.deductions (sales_scan_id);
CREATE INDEX IF NOT EXISTS idx_deductions_batch_id ON public.deductions (batch_id);


-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deductions ENABLE ROW LEVEL SECURITY;

-- Categories RLS: Authenticated users can view categories
CREATE POLICY "Allow authenticated users to read categories"
    ON public.categories FOR SELECT
    TO authenticated
    USING (true);

-- Products RLS: Owner only
CREATE POLICY "Users can view their own products"
    ON public.products FOR SELECT
    TO authenticated
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own products"
    ON public.products FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own products"
    ON public.products FOR UPDATE
    TO authenticated
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own products"
    ON public.products FOR DELETE
    TO authenticated
    USING (auth.uid() = owner_id);

-- Batches RLS: Owner via products join
CREATE POLICY "Users can view batches of their products"
    ON public.batches FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.products
            WHERE products.id = batches.product_id
              AND products.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert batches for their products"
    ON public.batches FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.products
            WHERE products.id = batches.product_id
              AND products.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can update batches of their products"
    ON public.batches FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.products
            WHERE products.id = batches.product_id
              AND products.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.products
            WHERE products.id = batches.product_id
              AND products.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete batches of their products"
    ON public.batches FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.products
            WHERE products.id = batches.product_id
              AND products.owner_id = auth.uid()
        )
    );

-- Sales Scans RLS: Owner only
CREATE POLICY "Users can view their own sales scans"
    ON public.sales_scans FOR SELECT
    TO authenticated
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own sales scans"
    ON public.sales_scans FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own sales scans"
    ON public.sales_scans FOR UPDATE
    TO authenticated
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

-- Deductions RLS: Users can only SELECT and INSERT (NO UPDATE or DELETE policies)
CREATE POLICY "Users can view deductions for their sales scans"
    ON public.deductions FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.sales_scans
            WHERE sales_scans.id = deductions.sales_scan_id
              AND sales_scans.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert deductions for their sales scans"
    ON public.deductions FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.sales_scans
            WHERE sales_scans.id = deductions.sales_scan_id
              AND sales_scans.owner_id = auth.uid()
        )
    );
