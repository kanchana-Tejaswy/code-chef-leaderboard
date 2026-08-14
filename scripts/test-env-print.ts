console.log("DATABASE_URL in process.env:", !!process.env.DATABASE_URL);
console.log("POSTGRES_PRISMA_URL in process.env:", !!process.env.POSTGRES_PRISMA_URL);
console.log("POSTGRES_URL in process.env:", !!process.env.POSTGRES_URL);
console.log("Keys starting with DB/POSTGRES/SUPABASE/URL:", Object.keys(process.env).filter(k => k.includes("DB") || k.includes("POSTGRES") || k.includes("SUPABASE") || k.includes("URL")));
