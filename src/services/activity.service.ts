import { prisma } from "@/lib/prisma";

export class ActivityService {
  /**
   * Logs a new event to the ActivityLog table.
   * Ensures failures are logged gracefully to the console without interrupting main workflows.
   */
  static async logEvent(eventType: string, studentId: string | null, message: string, dbClient: any = prisma) {
    try {
      if (!dbClient || !(dbClient as any).activityLog) {
        console.warn("dbClient does not support activityLog logging. Skipping.");
        return;
      }
      return await dbClient.activityLog.create({
        data: {
          eventType,
          studentId,
          message,
        },
      });
    } catch (err) {
      console.error("Failed to log activity event in database:", err);
    }
  }
}
