export type JobStatusEnum = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED';

export interface JobStatus {
  id: string;
  requestedBy: string;
  mode: 'STALE_ONLY' | 'ALL' | 'FAILED_ONLY';
  startedAt: Date;
  completedAt?: Date;
  totalStudents: number;
  processedStudents: number;
  successfulStudents: number;
  failedStudents: number;
  skippedStudents: number;
  currentStudent?: string;
  status: JobStatusEnum;
  errors: string[];
}

// In-memory store for bulk sync jobs. 
// Note: In a heavily scaled serverless environment this would be replaced with Redis/KV.
export const refreshJobs = new Map<string, JobStatus>();

export function getJob(jobId: string): JobStatus | undefined {
  return refreshJobs.get(jobId);
}

export function createJob(jobId: string, requestedBy: string, mode: 'STALE_ONLY' | 'ALL' | 'FAILED_ONLY', totalStudents: number): JobStatus {
  const job: JobStatus = {
    id: jobId,
    requestedBy,
    mode,
    startedAt: new Date(),
    totalStudents,
    processedStudents: 0,
    successfulStudents: 0,
    failedStudents: 0,
    skippedStudents: 0,
    status: 'RUNNING',
    errors: [],
  };
  refreshJobs.set(jobId, job);
  return job;
}

export function updateJobProgress(jobId: string, updates: Partial<JobStatus>) {
  const job = refreshJobs.get(jobId);
  if (job) {
    Object.assign(job, updates);
  }
}
