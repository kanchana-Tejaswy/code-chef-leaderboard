import { prisma } from "@/lib/prisma";

export class ActivityService {
  /**
   * Logs a new event to the ActivityLog table.
   * Ensures failures are logged gracefully without interrupting main workflows or aborting active transactions.
   */
  static async logEvent(eventType: string, studentId: string | null, message: string, dbClient: any = prisma) {
    try {
      const client = (dbClient && (dbClient as any).activityLog) ? dbClient : prisma;
      if (!client || !(client as any).activityLog) {
        return;
      }
      return await client.activityLog.create({
        data: {
          eventType,
          studentId,
          message,
        },
      });
    } catch (err: any) {
      console.warn("Activity log event creation skipped:", err?.message || err);
    }
  }
}
