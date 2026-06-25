import { prisma } from "@/lib/prisma";

export class ActivityService {
  /**
   * Logs a new event to the ActivityLog table.
   * Ensures failures are logged gracefully to the console without interrupting main workflows.
   */
  static async logEvent(eventType: string, studentId: string | null, message: string) {
    try {
      return await prisma.activityLog.create({
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
