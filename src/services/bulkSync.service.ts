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

  /**
   * Queue all eligible students who have both CodeChef and LeetCode usernames.
   * Runs database-driven queries in safe transactions with chunking (50 records per chunk).
   */
  static async queueAllPending(): Promise<{
    totalEligible: number;
    newlyQueued: number;
    alreadyQueued: number;
    missingPlatformData: number;
    failedToQueue: number;
  }> {
    // 1. Count students missing platform data (who are not verified)
    const missingPlatformData = await prisma.studentProfile.count({
      where: {
        OR: [
          { codechefUsername: null },
          { codechefUsername: "" },
          { leetcodeUsername: null },
          { leetcodeUsername: "" }
        ],
        profileStatus: { not: "VERIFIED" }
      }
    });

    // 2. Count students already queued/processing
    const alreadyQueued = await prisma.syncJob.count({
      where: {
        status: { in: ["QUEUED", "PROCESSING"] }
      }
    });

    // 3. Query all active student IDs in syncJob to exclude them
    const activeJobs = await prisma.syncJob.findMany({
      where: {
        status: { in: ["QUEUED", "PROCESSING"] }
      },
      select: { studentId: true }
    });
    const activeStudentIds = activeJobs.map(job => job.studentId);

    // 4. Query all eligible student IDs
    const eligibleStudents = await prisma.studentProfile.findMany({
      where: {
        AND: [
          ...(activeStudentIds.length > 0 ? [{ id: { notIn: activeStudentIds } }] : []),
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
    });

    const totalEligible = eligibleStudents.length;
    let newlyQueued = 0;
    let failedToQueue = 0;

    // Process in chunks of 50
    const chunkSize = 50;
    for (let i = 0; i < eligibleStudents.length; i += chunkSize) {
      const chunk = eligibleStudents.slice(i, i + chunkSize);
      
      for (const student of chunk) {
        try {
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
          newlyQueued++;
        } catch (err) {
          console.error(`Failed to queue student ${student.id}:`, err);
          failedToQueue++;
        }
      }
    }

    return {
      totalEligible,
      newlyQueued,
      alreadyQueued,
      missingPlatformData,
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
            status: { in: ["QUEUED", "PROCESSING", "RETRY_PENDING", "VERIFIED"] },
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

          // Create durable sync queue item
          await prisma.syncJob.create({
            data: {
              studentId: student.id,
              status: "QUEUED",
              attemptCount: 0,
            },
          });
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
    const failedJobs = await prisma.syncJob.findMany({
      where: { status: "FAILED" },
      select: { id: true, studentId: true },
    });

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
      return { processedCount: 0, successCount: 0, failedCount: 0, remainingCount: 0 };
    }

    // Fetch next queued or retry-pending jobs
    const jobs = await prisma.syncJob.findMany({
      where: {
        status: { in: ["QUEUED", "RETRY_PENDING"] },
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    if (jobs.length === 0) {
      const remainingCount = await prisma.syncJob.count({
        where: { status: { in: ["QUEUED", "RETRY_PENDING"] } },
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
        
        // Mark job as PROCESSING
        await prisma.syncJob.update({
          where: { id: currentJob.id },
          data: {
            status: "PROCESSING",
            attemptCount: currentJob.attemptCount + 1,
            lastAttemptedAt: new Date(),
          },
        });

        // Run sync for single student (skipping global rank recalculation inside loop)
        const syncResult = await SyncService.syncStudent(currentJob.studentId, "ADMIN_FORCE", true);

        // Check verified status after sync attempt
        const student = await prisma.studentProfile.findUnique({
          where: { id: currentJob.studentId },
          include: { codechefProfile: true, leetcodeProfile: true },
        });

        const ccVerified = Boolean(student?.codechefProfile && student.codechefProfile.username);
        const lcVerified = Boolean(student?.leetcodeProfile && student.leetcodeProfile.username);
        const bothVerified = ccVerified && lcVerified;

        if (syncResult.success && bothVerified) {
          successCount++;
          await prisma.syncJob.update({
            where: { id: currentJob.id },
            data: {
              status: "VERIFIED",
              lastSuccessfulAt: new Date(),
              error: null,
              errorCategory: null,
            },
          });
        } else {
          // Check partial status or failure
          let newStatus: QueueStatus = "FAILED";
          if (ccVerified && !lcVerified) {
            newStatus = "CODECHEF_VERIFIED";
          } else if (!ccVerified && lcVerified) {
            newStatus = "LEETCODE_VERIFIED";
          } else {
            newStatus = "FAILED";
          }

          const cat = this.categorizeError(syncResult.error);
          const maxRetries = 3;
          const isFinalFailure = (currentJob.attemptCount + 1) >= maxRetries;

          if (isFinalFailure && !bothVerified) {
            await prisma.studentProfile.update({
              where: { id: currentJob.studentId },
              data: {
                profileStatus: "INVALID",
                leaderboardEligible: false,
                dashboardEligible: false,
              },
            });
          } else if (!bothVerified) {
            await prisma.studentProfile.update({
              where: { id: currentJob.studentId },
              data: {
                profileStatus: "INCOMPLETE",
                leaderboardEligible: false,
                dashboardEligible: false,
              },
            });
          }

          failedCount++;
          await prisma.syncJob.update({
            where: { id: currentJob.id },
            data: {
              status: isFinalFailure ? "FAILED" : newStatus,
              errorCategory: cat,
              error: syncResult.error ? syncResult.error.slice(0, 250) : "Platform verification failed",
            },
          });
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
      where: { status: { in: ["QUEUED", "RETRY_PENDING"] } },
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
  static async getQueueProgressStats(): Promise<QueueProgressStats> {
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

    const remaining = await prisma.syncJob.count({
      where: { status: { in: ["QUEUED", "RETRY_PENDING", "PROCESSING"] } },
    });

    const lastJob = await prisma.syncJob.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    });

    const percentageCompleted = eligibleForQueue > 0 ? Math.round((verified / eligibleForQueue) * 100) : 0;

    return {
      totalProfiles,
      eligibleForQueue,
      queued,
      processing,
      verified,
      incomplete,
      failed,
      remaining,
      percentageCompleted,
      lastProcessingTime: lastJob?.updatedAt ? lastJob.updatedAt.toISOString() : null,
      isPaused: queueIsPaused,
    };
  }
}
