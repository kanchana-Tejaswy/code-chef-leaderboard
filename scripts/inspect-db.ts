import { prisma } from '../src/lib/prisma'

async function main() {
  const verifiedCount = await prisma.studentProfile.count({
    where: { profileStatus: 'VERIFIED' }
  })
  
  const approvedCount = await prisma.studentProfile.count({
    where: { adminApprovalStatus: 'APPROVED' }
  })
  
  const verifiedPendingCount = await prisma.studentProfile.count({
    where: { profileStatus: 'VERIFIED', adminApprovalStatus: 'PENDING' }
  })
  
  const leaderboardEligibleCount = await prisma.studentProfile.count({
    where: { leaderboardEligible: true }
  })
  
  const dashboardEligibleCount = await prisma.studentProfile.count({
    where: { dashboardEligible: true }
  })
  
  const leaderboardEntryCount = await prisma.leaderboardEntry.count()
  
  const rank0Count = await prisma.leaderboardEntry.count({
    where: { rank: 0 }
  })
  
  const approvedWithoutEntryCount = await prisma.studentProfile.count({
    where: { 
      adminApprovalStatus: 'APPROVED',
      leaderboardEntry: { is: null }
    }
  })
  
  const approvedNotEligibleCount = await prisma.studentProfile.count({
    where: { 
      adminApprovalStatus: 'APPROVED',
      leaderboardEligible: false
    }
  })

  console.log({
    verifiedCount,
    approvedCount,
    verifiedPendingCount,
    leaderboardEligibleCount,
    dashboardEligibleCount,
    leaderboardEntryCount,
    rank0Count,
    approvedWithoutEntryCount,
    approvedNotEligibleCount
  })
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
