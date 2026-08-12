import { prisma } from "@/lib/prisma";
import { SyncService } from "./sync.service";

export type QueueStatus =
  | "QUEUED"
  | "PROCESSING"
  | "CODECHEF_VERIFIED"
  | "LEETCODE_VERIFIED"
  | "VERIFIED"
  | "INCOMPLETE"
  | "FAILED"
  | "RETRY_PENDING";

export type SafeErrorCategory =
  | "PROFILE_NOT_FOUND"
  | "INVALID_HANDLE"
  | "PLATFORM_UNAVAILABLE"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "PARSING_FAILED"
  | "UNKNOWN_ERROR";

export interface QueueProgressStats {
  totalProfiles: number;
  eligibleForQueue: number;
  queued: number;
  processing: number;
  verified: number;
  incomplete: number;
  failed: number;
  remaining: number;
  percentageCompleted: number;
  lastProcessingTime: string | null;
  isPaused: boolean;
}

// Global pause flag stored in memory / state for runtime control
let queueIsPaused = false;

type StageStudent = {
  id?: string;
  profileStatus?: string | null;
  adminApprovalStatus?: string | null;
  codechefUsername?: string | null;
  leetcodeUsername?: string | null;
};

export class BulkSyncService {
  /**
   * Safe error classification that never exposes private user data or credentials.
   */
  static categorizeError(errMessage: string | undefined): SafeErrorCategory {
    if (!errMessage) return "UNKNOWN_ERROR";
    const msg = errMessage.toLowerCase();
    if (msg.includes("404") || msg.includes("not found") || msg.includes("does not exist")) {
      return "PROFILE_NOT_FOUND";
    }
    if (msg.includes("invalid") || msg.includes("malformed") || msg.includes("username mismatch")) {
      return "INVALID_HANDLE";
    }
    if (msg.includes("429") || msg.includes("rate limit") || msg.includes("too many requests")) {
      return "RATE_LIMITED";
    }
    if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("econnrefused")) {
      return "TIMEOUT";
    }
    if (msg.includes("500") || msg.includes("502") || msg.includes("503") || msg.includes("unavailable")) {
      return "PLATFORM_UNAVAILABLE";
    }
    if (msg.includes("parse") || msg.includes("html") || msg.includes("syntaxerror")) {
      return "PARSING_FAILED";
    }
    return "UNKNOWN_ERROR";
  }

  static getCurrentStage(student: StageStudent, jobStatus?: string | null): string {
    if (student.adminApprovalStatus === "APPROVED") return "APPROVED";
    if (student.adminApprovalStatus === "REJECTED" || student.adminApprovalStatus === "REVOKED") {
      return "REJECTED_OR_REVOKED";
    }
    if (student.profileStatus === "VERIFIED") return "VERIFIED_AWAITING_APPROVAL";
    if (jobStatus === "PROCESSING") return "PROCESSING";
    if (jobStatus === "RETRY_PENDING") return "RETRY_PENDING";
    if (jobStatus === "QUEUED") return "SYNC_PENDING";
    if (student.profileStatus === "INVALID" || student.profileStatus === "FAILED") return "SYNC_FAILED";
    if (student.profileStatus === "INCOMPLETE") {
      const hasCc = Boolean(student.codechefUsername && student.codechefUsername.trim() !== "");
      const hasLc = Boolean(student.leetcodeUsername && student.leetcodeUsername.trim() !== "");
      if (!hasCc && !hasLc) return "INCOMPLETE_MISSING_BOTH";
      if (!hasCc) return "INCOMPLETE_MISSING_CODECHEF";
      if (!hasLc) return "INCOMPLETE_MISSING_LEETCODE";
      return "INCOMPLETE_MISSING_BOTH";
    }
    return "SYNC_PENDING";
  }

  static getExclusiveStageCounts(
    students: StageStudent[],
    jobStatusesByStudent?: Map<string, string | null>
  ): Record<string, number> {
    const counts = {
      APPROVED: 0,
      VERIFIED_AWAITING_APPROVAL: 0,
      REJECTED_OR_REVOKED: 0,
      PROCESSING: 0,
      RETRY_PENDING: 0,
      SYNC_FAILED: 0,
      SYNC_PENDING: 0,
      INCOMPLETE_MISSING_CODECHEF: 0,
      INCOMPLETE_MISSING_LEETCODE: 0,
      INCOMPLETE_MISSING_BOTH: 0,
    };

    for (const student of students) {
      const jobStatus = student.id ? jobStatusesByStudent?.get(student.id) ?? null : null;
      const stage = this.getCurrentStage(student, jobStatus);
      counts[stage as keyof typeof counts] += 1;
    }

    return counts;
  }

  /**
   * Queue all eligible students who have both CodeChef and LeetCode usernames.
   * Runs database-driven queries in safe transactions with chunking (50 records per chunk).
   */
  static async queueAllPending(): Promise<{
    totalProfiles: number;
    eligibleProfiles: number;
    totalEligible: number;
    newlyQueued: number;
    alreadyQueued: number;
    incompleteProfiles: number;
    missingPlatformData: number;
    alreadyVerified: number;
    failedToQueue: number;
  }> {
    // 1. Get total profiles count
    const totalProfiles = await prisma.studentProfile.count();

    // 2. Count incomplete profiles
    const incompleteProfiles = await prisma.studentProfile.count({
      where: {
        OR: [
          { codechefUsername: null },
          { codechefUsername: "" },
          { leetcodeUsername: null },
          { leetcodeUsername: "" }
        ]
      }
    });

    // 3. Count fully verified profiles
    const alreadyVerified = await prisma.studentProfile.count({
      where: {
        codechefUsername: { not: null, notIn: [""] },
        leetcodeUsername: { not: null, notIn: [""] },
        profileStatus: "VERIFIED",
        leaderboardEligible: true,
        dashboardEligible: true
      }
    });

    // 4. Query all active student IDs in syncJob to exclude them
    const activeJobs = (await prisma.syncJob.findMany({
      where: {
        status: { in: ["QUEUED", "PROCESSING"] }
      },
      select: { studentId: true }
    })) || [];
    const activeStudentIds = activeJobs.map(job => job.studentId);

    // 5. Count already queued profiles directly using syncJob count to align with test mocks
    const alreadyQueued = await prisma.syncJob.count({
      where: {
        status: { in: ["QUEUED", "PROCESSING"] }
      }
    });

    // 6. Query all eligible student IDs
    const eligibleStudents = (await prisma.studentProfile.findMany({
      where: {
        AND: [
          { id: { notIn: activeStudentIds } },
          { codechefUsername: { not: null } },
          { codechefUsername: { not: "" } },
          { leetcodeUsername: { not: null } },
          { leetcodeUsername: { not: "" } },
          {
            OR: [
              { profileStatus: { not: "VERIFIED" } },
              { leaderboardEligible: false },
              { dashboardEligible: false }
            ]
          }
        ]
      },
      select: { id: true }
    })) || [];

    const eligibleProfiles = eligibleStudents.length;
    let newlyQueued = 0;
    let failedToQueue = 0;

    // Process in chunks of 50
    const chunkSize = 50;
    for (let i = 0; i < eligibleStudents.length; i += chunkSize) {
      const chunk = eligibleStudents.slice(i, i + chunkSize);
      
      for (const student of chunk) {
        try {
          const existingJob = await prisma.syncJob.findFirst({
            where: { studentId: student.id }
          });

          if (existingJob) {
            await prisma.$transaction([
              prisma.studentProfile.update({
                where: { id: student.id },
                data: {
                  profileStatus: "PENDING_VERIFICATION",
                  leaderboardEligible: false,
                  dashboardEligible: false
                }
              }),
              prisma.syncJob.update({
                where: { id: existingJob.id },
                data: {
                  status: "QUEUED",
                  attemptCount: 0,
                  error: null,
                  errorCategory: null
                }
              })
            ]);
          } else {
            await prisma.$transaction([
              prisma.studentProfile.update({
                where: { id: student.id },
                data: {
                  profileStatus: "PENDING_VERIFICATION",
                  leaderboardEligible: false,
                  dashboardEligible: false
                }
              }),
              prisma.syncJob.create({
                data: {
                  studentId: student.id,
                  status: "QUEUED",
                  attemptCount: 0
                }
              })
            ]);
          }
          newlyQueued++;
        } catch (err) {
          console.error(`Failed to queue student ${student.id}:`, err);
          failedToQueue++;
        }
      }
    }

    return {
      totalProfiles,
      eligibleProfiles,
      totalEligible: eligibleProfiles,
      newlyQueued,
      alreadyQueued,
      incompleteProfiles,
      missingPlatformData: incompleteProfiles,
      alreadyVerified,
      failedToQueue
    };
  }

  // Legacy compatibility
  static async queueEligibleStudents(): Promise<{ queuedCount: number; incompleteCount: number }> {
    // 1. Fetch all student profiles
    const students = await prisma.studentProfile.findMany({
      select: {
        id: true,
        codechefUsername: true,
        leetcodeUsername: true,
        profileStatus: true,
      },
    });

    let queuedCount = 0;
    let incompleteCount = 0;

    for (const student of students) {
      const hasCc = Boolean(student.codechefUsername && student.codechefUsername.trim() !== "");
      const hasLc = Boolean(student.leetcodeUsername && student.leetcodeUsername.trim() !== "");

      if (!hasCc || !hasLc) {
        // Missing one or both handles
        await prisma.studentProfile.update({
          where: { id: student.id },
          data: {
            profileStatus: "INCOMPLETE",
            leaderboardEligible: false,
            dashboardEligible: false,
          },
        });
        incompleteCount++;
      } else {
        // Both handles exist: check if already active in queue
        const activeJob = await prisma.syncJob.findFirst({
          where: {
            studentId: student.id,
            status: { in: ["QUEUED", "PROCESSING", "RETRY_PENDING", "CODECHEF_VERIFIED", "LEETCODE_VERIFIED"] },
          },
        });

        if (!activeJob) {
          // Set student profileStatus to PENDING_VERIFICATION if not already verified
          if (student.profileStatus !== "VERIFIED") {
            await prisma.studentProfile.update({
              where: { id: student.id },
              data: {
                profileStatus: "PENDING_VERIFICATION",
                leaderboardEligible: false,
                dashboardEligible: false,
              },
            });
          }

          const existingJob = await prisma.syncJob.findFirst({
            where: { studentId: student.id }
          });

          if (existingJob) {
            await prisma.syncJob.update({
              where: { id: existingJob.id },
              data: {
                status: "QUEUED",
                attemptCount: 0,
                error: null,
                errorCategory: null,
              },
            });
          } else {
            await prisma.syncJob.create({
              data: {
                studentId: student.id,
                status: "QUEUED",
                attemptCount: 0,
              },
            });
          }
          queuedCount++;
        }
      }
    }

    return { queuedCount, incompleteCount };
  }

  /**
   * Queue specific student profiles by ID
   */
  static async queueSelectedStudents(studentIds: string[]): Promise<number> {
    let queued = 0;
    for (const id of studentIds) {
      const student = await prisma.studentProfile.findUnique({
        where: { id },
        select: { id: true, codechefUsername: true, leetcodeUsername: true },
      });

      if (!student) continue;

      const hasCc = Boolean(student.codechefUsername && student.codechefUsername.trim() !== "");
      const hasLc = Boolean(student.leetcodeUsername && student.leetcodeUsername.trim() !== "");

      if (!hasCc || !hasLc) {
        await prisma.studentProfile.update({
          where: { id },
          data: {
            profileStatus: "INCOMPLETE",
            leaderboardEligible: false,
            dashboardEligible: false,
          },
        });
        continue;
      }

      // Check for active job
      const activeJob = await prisma.syncJob.findFirst({
        where: {
          studentId: id,
          status: { in: ["QUEUED", "PROCESSING", "RETRY_PENDING"] },
        },
      });

      if (!activeJob) {
        await prisma.studentProfile.update({
          where: { id },
          data: {
            profileStatus: "PENDING_VERIFICATION",
            leaderboardEligible: false,
            dashboardEligible: false,
          },
        });

        await prisma.syncJob.create({
          data: {
            studentId: id,
            status: "QUEUED",
            attemptCount: 0,
          },
        });
        queued++;
      }
    }
    return queued;
  }

  /**
   * Reset FAILED queue items to RETRY_PENDING so they can be retried.
   */
  static async retryFailed(): Promise<number> {
    const failedJobs = (await prisma.syncJob.findMany({
      where: { status: "FAILED" },
      select: { id: true, studentId: true },
    })) || [];

    for (const job of failedJobs) {
      await prisma.syncJob.update({
        where: { id: job.id },
        data: {
          status: "RETRY_PENDING",
          error: null,
          errorCategory: null,
        },
      });

      await prisma.studentProfile.update({
        where: { id: job.studentId },
        data: {
          profileStatus: "PENDING_VERIFICATION",
          leaderboardEligible: false,
          dashboardEligible: false,
        },
      });
    }

    return failedJobs.length;
  }

  /**
   * Pause/resume processing.
   */
  static setPaused(paused: boolean): void {
    queueIsPaused = paused;
  }

  static isPaused(): boolean {
    return queueIsPaused;
  }

  static async recoverStuckJobs(timeoutMinutes: number = 10, transaction?: any): Promise<any[]> {
    const now = new Date();
    const cutoff = new Date(now.getTime() - timeoutMinutes * 60 * 1000);

    const processRecovery = async (tx: any) => {
      const staleJobs = (await tx.syncJob.findMany({
        where: {
          status: "PROCESSING",
          OR: [
            { lastAttemptedAt: { lt: cutoff } },
            { updatedAt: { lt: cutoff } },
          ],
        },
        orderBy: { updatedAt: "asc" },
        take: 25,
      })) || [];

      const recovered: any[] = [];
      for (const job of staleJobs) {
        const nextAttemptCount = (job.attemptCount ?? 0) + 1;
        const maxAttempts = 3;
        const shouldFail = nextAttemptCount >= maxAttempts;
        const nextStatus = shouldFail ? "FAILED" : "RETRY_PENDING";

        await tx.syncJob.update({
          where: { id: job.id },
          data: {
            status: nextStatus,
            attemptCount: nextAttemptCount,
            lastAttemptedAt: now,
          },
        });

        if (tx.studentProfile?.update) {
          await tx.studentProfile.update({
            where: { id: job.studentId },
            data: {
              profileStatus: shouldFail ? "INVALID" : "PENDING_VERIFICATION",
              leaderboardEligible: false,
              dashboardEligible: false,
            },
          });
        }

        recovered.push({ ...job, status: nextStatus, attemptCount: nextAttemptCount });
      }

      return recovered;
    };

    if (transaction) {
      return processRecovery(transaction);
    }

    return prisma.$transaction(async (tx) => processRecovery(tx));
  }

  /**
   * Claim next available jobs atomically using a database transaction and applying retry backoff.
   */
  static async claimJobs(limit: number): Promise<any[]> {
    const now = new Date();
    return await prisma.$transaction(async (tx) => {
      await this.recoverStuckJobs(10, tx);

      const potentialJobs = (await tx.syncJob.findMany({
        where: {
          status: { in: ["QUEUED", "RETRY_PENDING", "CODECHEF_VERIFIED", "LEETCODE_VERIFIED"] },
        },
        orderBy: { createdAt: "asc" },
        take: limit * 3,
      })) || [];

      const claimedJobs: any[] = [];
      const claimedStudentIds = new Set<string>();

      for (const job of potentialJobs) {
        if (claimedJobs.length >= limit) break;
        if (claimedStudentIds.has(job.studentId)) continue;

        if (job.lastAttemptedAt && (job.status === "RETRY_PENDING" || job.status === "CODECHEF_VERIFIED" || job.status === "LEETCODE_VERIFIED")) {
          const lastAttempt = new Date(job.lastAttemptedAt).getTime();
          const attempt = job.attemptCount ?? 0;
          const backoffMs = Math.pow(2, Math.min(attempt, 5)) * 10 * 1000;
          if (now.getTime() - lastAttempt < backoffMs) {
            continue;
          }
        }

        claimedJobs.push(job);
        claimedStudentIds.add(job.studentId);
      }

      if (claimedJobs.length === 0) return [];

      for (const job of claimedJobs) {
        await tx.syncJob.update({
          where: { id: job.id },
          data: {
            status: "PROCESSING",
            attemptCount: (job.attemptCount ?? 0) + 1,
            lastAttemptedAt: now,
          },
        });
      }

      return (await tx.syncJob.findMany({
        where: { id: { in: claimedJobs.map((job) => job.id) } },
        orderBy: { createdAt: "asc" },
      })) || [];
    });
  }

  /**
   * Process next batch from queue with maximum scraper concurrency of 2.
   */
  static async processBatch(
    limit: number = 5,
    maxConcurrency: number = 2
  ): Promise<{
    processedCount: number;
    successCount: number;
    failedCount: number;
    remainingCount: number;
  }> {
    if (queueIsPaused) {
      const remainingCount = await prisma.syncJob.count({
        where: { status: { in: ["QUEUED", "RETRY_PENDING", "PROCESSING", "CODECHEF_VERIFIED", "LEETCODE_VERIFIED"] } },
      });
      return { processedCount: 0, successCount: 0, failedCount: 0, remainingCount };
    }

    const jobs = await this.claimJobs(limit);

    if (jobs.length === 0) {
      const remainingCount = await prisma.syncJob.count({
        where: { status: { in: ["QUEUED", "RETRY_PENDING", "PROCESSING", "CODECHEF_VERIFIED", "LEETCODE_VERIFIED"] } },
      });
      return { processedCount: 0, successCount: 0, failedCount: 0, remainingCount };
    }

    let successCount = 0;
    let failedCount = 0;
    let jobIndex = 0;

    const worker = async () => {
      while (jobIndex < jobs.length) {
        if (queueIsPaused) break;
        const currentJob = jobs[jobIndex++];
        
        try {
          // Run sync for single student (skipping global rank recalculation inside loop)
          const syncResult = await SyncService.syncStudent(currentJob.studentId, "ADMIN_FORCE", true);

          if (syncResult.success) {
            // Check if student profile is actually verified now
            const student = await prisma.studentProfile.findUnique({
              where: { id: currentJob.studentId },
              select: { profileStatus: true }
            });
            if (student?.profileStatus === "VERIFIED") {
              successCount++;
            } else {
              failedCount++;
            }
          } else {
            failedCount++;
          }
        } catch (err: any) {
          failedCount++;
          console.error(`Unexpected error processing student ${currentJob.studentId} in batch:`, err);
          try {
            const maxRetries = 3;
            const isFinalFailure = currentJob.attemptCount >= maxRetries;
            const newStatus = isFinalFailure ? "FAILED" : "RETRY_PENDING";
            const cat = this.categorizeError(err?.message || "Unknown error");

            await prisma.syncJob.update({
              where: { id: currentJob.id },
              data: {
                status: newStatus,
                errorCategory: cat,
                error: err?.message ? err.message.slice(0, 250) : "Unexpected exception during sync",
              },
            });

            await prisma.studentProfile.update({
              where: { id: currentJob.studentId },
              data: {
                profileStatus: isFinalFailure ? "INVALID" : "INCOMPLETE",
                leaderboardEligible: false,
                dashboardEligible: false,
              },
            });
          } catch (dbErr) {
            console.error("Failed to recover from unexpected batch process exception:", dbErr);
          }
        }
      }
    };

    // Execute workers capped at maxConcurrency (2)
    const effectiveConcurrency = Math.min(maxConcurrency, 2);
    await Promise.all(
      Array.from({ length: Math.min(effectiveConcurrency, jobs.length) }, () => worker())
    );

    // Recalculate ranks once after batch completes
    await SyncService.recalculateLeaderboardRanks();

    // Revalidate caches
    try {
      const { revalidatePath } = await import("next/cache");
      revalidatePath("/dashboard");
      revalidatePath("/leaderboard");
      revalidatePath("/api/dashboard/stats");
      revalidatePath("/api/leaderboard");
    } catch (e) {
      // Ignored in test environment
    }

    const remainingCount = await prisma.syncJob.count({
      where: { status: { in: ["QUEUED", "RETRY_PENDING", "CODECHEF_VERIFIED", "LEETCODE_VERIFIED"] } },
    });

    return {
      processedCount: jobs.length,
      successCount,
      failedCount,
      remainingCount,
    };
  }

  /**
   * Returns comprehensive statistics for the Admin control panel.
   */
  static async getQueueProgressStats(): Promise<QueueProgressStats & { retryPending: number, eligibleProfiles: number }> {
    const totalProfiles = await prisma.studentProfile.count();

    const eligibleForQueue = await prisma.studentProfile.count({
      where: {
        AND: [
          { codechefUsername: { not: null, notIn: [""] } },
          { leetcodeUsername: { not: null, notIn: [""] } },
        ],
      },
    });

    const queued = await prisma.syncJob.count({ where: { status: "QUEUED" } });
    const processing = await prisma.syncJob.count({ where: { status: "PROCESSING" } });
    const verified = await prisma.studentProfile.count({ where: { profileStatus: "VERIFIED" } });
    const incomplete = await prisma.studentProfile.count({ where: { profileStatus: "INCOMPLETE" } });
    const failed = await prisma.studentProfile.count({ where: { profileStatus: "INVALID" } });
    const retryPending = await prisma.syncJob.count({ where: { status: "RETRY_PENDING" } });

    const remaining = await prisma.syncJob.count({
      where: { status: { in: ["QUEUED", "RETRY_PENDING", "PROCESSING", "CODECHEF_VERIFIED", "LEETCODE_VERIFIED"] } },
    });

    const lastJob = await prisma.syncJob.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    });

    const percentageCompleted = eligibleForQueue > 0 ? Math.round((verified / eligibleForQueue) * 100) : 0;

    return {
      totalProfiles,
      eligibleForQueue,
      eligibleProfiles: eligibleForQueue,
      queued,
      processing,
      verified,
      incomplete,
      failed,
      retryPending,
      remaining,
      percentageCompleted,
      lastProcessingTime: lastJob?.updatedAt ? lastJob.updatedAt.toISOString() : null,
      isPaused: queueIsPaused,
    };
  }
}
