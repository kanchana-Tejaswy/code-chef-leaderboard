import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const studentCount = await prisma.$queryRaw`SELECT count(*) FROM student_profiles;`;
    
    const emailCol = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'student_profiles' AND column_name = 'email';
    `;
    
    const emailIndex = await prisma.$queryRaw`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'student_profiles' AND indexname = 'student_profiles_email_key';
    `;

    return NextResponse.json({
      studentCount: Number((studentCount as any[])[0]?.count || 0),
      emailColumnExists: (emailCol as any[]).length > 0,
      emailIndexExists: (emailIndex as any[]).length > 0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
