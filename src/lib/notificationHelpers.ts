// src/lib/notificationHelpers.ts

import { createNotification } from "./notifications";
import { NOTIFICATION_EVENTS } from "./notificationTypes";

// ==========================================
// 1. ATTENDANCE MODULE
// ==========================================

export const sendCheckInReminder = (userId: string, timeStr: string) =>
  createNotification({
    userId,
    type: "info",
    title: "Clock-In Reminder ⏰",
    message: `It's ${timeStr}. Don't forget to mark your attendance today!`,
    category: "attendance",
    event: NOTIFICATION_EVENTS.attendance.CHECK_IN_REMINDER,
    priority: "medium",
    clickAction: "/employee?action=checkin",
  });

export const sendCheckOutReminder = (userId: string, timeStr: string) =>
  createNotification({
    userId,
    type: "info",
    title: "Clock-Out Reminder ⏰",
    message: `It's ${timeStr}. Remember to clock out before leaving.`,
    category: "attendance",
    event: NOTIFICATION_EVENTS.attendance.CHECK_OUT_REMINDER,
    priority: "medium",
    clickAction: "/employee?action=checkout",
  });

export const sendBreakExceeded = (userId: string, maxMinutes: number, actualMinutes: number) =>
  createNotification({
    userId,
    type: "warning",
    title: "Break Limit Exceeded ⚠️",
    message: `Your break exceeded the ${maxMinutes}m limit. Total break: ${actualMinutes}m.`,
    category: "attendance",
    event: NOTIFICATION_EVENTS.attendance.BREAK_EXCEEDED,
    priority: "high",
    clickAction: "/employee",
  });

export const sendCheckinSuccess = (userId: string, timeStr: string) =>
  createNotification({
    userId,
    type: "success",
    title: "Checked In Successfully ✓",
    message: `Successfully clocked in at ${timeStr}. Have a great day!`,
    category: "attendance",
    event: NOTIFICATION_EVENTS.attendance.CHECKIN_SUCCESS,
    priority: "low",
    clickAction: "/employee",
  });

export const sendCheckoutSuccess = (userId: string, timeStr: string) =>
  createNotification({
    userId,
    type: "success",
    title: "Checked Out Successfully ✓",
    message: `Successfully clocked out at ${timeStr}. Rest well!`,
    category: "attendance",
    event: NOTIFICATION_EVENTS.attendance.CHECKOUT_SUCCESS,
    priority: "low",
    clickAction: "/employee",
  });

export const sendLateWarning = (userId: string, lateMinutes: number) =>
  createNotification({
    userId,
    type: "warning",
    title: "Late Entry Logged",
    message: `You clocked in ${lateMinutes} minutes past the start time today.`,
    category: "attendance",
    event: NOTIFICATION_EVENTS.attendance.LATE_WARNING,
    priority: "medium",
    clickAction: "/employee",
  });

export const sendMissedAttendance = (userId: string, dateStr: string) =>
  createNotification({
    userId,
    type: "error",
    title: "Missing Attendance Alert ⚠️",
    message: `No attendance record found for yesterday (${dateStr}). Apply for correction if needed.`,
    category: "attendance",
    event: NOTIFICATION_EVENTS.attendance.MISSED_ATTENDANCE,
    priority: "high",
    clickAction: "/employee",
  });

export const sendOvertimeDetected = (userId: string, hours: number) =>
  createNotification({
    userId,
    type: "success",
    title: "Overtime Logged ⚡",
    message: `You logged ${hours.toFixed(1)} hours of overtime. Thank you for your effort!`,
    category: "attendance",
    event: NOTIFICATION_EVENTS.attendance.OVERTIME_DETECTED,
    priority: "low",
    clickAction: "/employee",
  });

export const sendCorrectionSubmitted = (userId: string, managerId: string, employeeName: string, dateStr: string) =>
  createNotification({
    userId: managerId,
    type: "info",
    title: "Attendance Correction Submitted",
    message: `${employeeName} requested attendance correction for ${dateStr}.`,
    category: "attendance",
    event: NOTIFICATION_EVENTS.attendance.CORRECTION_SUBMITTED,
    priority: "medium",
    clickAction: "/admin/employeedetails",
  });

export const sendCorrectionApproved = (userId: string, dateStr: string) =>
  createNotification({
    userId,
    type: "success",
    title: "Attendance Correction Approved ✓",
    message: `Your correction request for ${dateStr} has been approved.`,
    category: "attendance",
    event: NOTIFICATION_EVENTS.attendance.CORRECTION_APPROVED,
    priority: "medium",
    clickAction: "/employee",
  });

export const sendCorrectionRejected = (userId: string, dateStr: string, reason: string) =>
  createNotification({
    userId,
    type: "error",
    title: "Correction Request Rejected",
    message: `Your correction for ${dateStr} was rejected. Reason: ${reason}`,
    category: "attendance",
    event: NOTIFICATION_EVENTS.attendance.CORRECTION_REJECTED,
    priority: "medium",
    clickAction: "/employee",
  });

export const sendEmployeeAbsentAlert = (managerId: string, employeeName: string, dateStr: string) =>
  createNotification({
    userId: managerId,
    type: "warning",
    title: "Unexcused Absence Alert",
    message: `${employeeName} has not checked in today (${dateStr}) and has no approved leave.`,
    category: "attendance",
    event: NOTIFICATION_EVENTS.attendance.EMPLOYEE_ABSENT,
    priority: "medium",
    clickAction: "/admin/employeedetails",
  });

export const sendSuspiciousLoginAlert = (adminId: string, employeeName: string, ip: string, device: string) =>
  createNotification({
    userId: adminId,
    type: "error",
    title: "Suspicious Login Attempt 🚨",
    message: `${employeeName} logged in from unusual IP: ${ip} on device: ${device}.`,
    category: "attendance",
    event: NOTIFICATION_EVENTS.attendance.SUSPICIOUS_LOGIN,
    priority: "high",
    clickAction: "/admin/employeedetails",
  });

// ==========================================
// 2. LEAVE MANAGEMENT MODULE
// ==========================================

export const sendLeaveSubmitted = (userId: string, managerId: string, employeeName: string, dates: string) =>
  createNotification({
    userId: managerId,
    type: "info",
    title: "New Leave Application",
    message: `${employeeName} applied for leave on ${dates}.`,
    category: "leave",
    event: NOTIFICATION_EVENTS.leave.LEAVE_SUBMITTED,
    priority: "medium",
    clickAction: "/admin/leaverequests",
    actionButtons: [
      { action: "approve", title: "Approve" },
      { action: "view", title: "Review" },
    ],
  });

export const sendLeaveBalanceLow = (userId: string, remainingDays: number) =>
  createNotification({
    userId,
    type: "warning",
    title: "Leave Balance Alert ⚠️",
    message: `Your casual/sick leave balance is low (${remainingDays} days remaining).`,
    category: "leave",
    event: NOTIFICATION_EVENTS.leave.LEAVE_BALANCE_LOW,
    priority: "medium",
    clickAction: "/employee?tab=leave",
  });

export const sendLeaveStartsTomorrow = (userId: string, dates: string) =>
  createNotification({
    userId,
    type: "info",
    title: "Leave Starts Tomorrow 🌴",
    message: `Your approved leave for ${dates} starts tomorrow. Make sure tasks are handed over!`,
    category: "leave",
    event: NOTIFICATION_EVENTS.leave.LEAVE_STARTS_TOMORROW,
    priority: "medium",
    clickAction: "/employee",
  });

export const sendReturnReminder = (userId: string) =>
  createNotification({
    userId,
    type: "info",
    title: "Return from Leave Reminder ⏰",
    message: "Welcome back! Don't forget to check in and submit any pending work updates.",
    category: "leave",
    event: NOTIFICATION_EVENTS.leave.RETURN_REMINDER,
    priority: "medium",
    clickAction: "/employee",
  });

export const sendTeamShortageWarning = (managerId: string, department: string, dateStr: string, activeCount: number) =>
  createNotification({
    userId: managerId,
    type: "warning",
    title: "Team Staffing Shortage ⚠️",
    message: `Critical shortage in ${department} on ${dateStr}. Only ${activeCount} members active.`,
    category: "leave",
    event: NOTIFICATION_EVENTS.leave.TEAM_SHORTAGE,
    priority: "high",
    clickAction: "/admin/leaverequests",
  });

// ==========================================
// 3. KANBAN/TASK MANAGEMENT MODULE
// ==========================================

export const sendTaskAssigned = (userId: string, taskTitle: string, taskId: string) =>
  createNotification({
    userId,
    type: "info",
    title: "New Task Assigned 🎯",
    message: `You have been assigned: "${taskTitle}".`,
    category: "task",
    event: NOTIFICATION_EVENTS.task.TASK_ASSIGNED,
    priority: "medium",
    clickAction: `/employee?tab=tasks&taskId=${taskId}`,
  });

export const sendTaskUpdated = (userId: string, taskTitle: string, taskId: string, changedBy: string) =>
  createNotification({
    userId,
    type: "info",
    title: "Task Updated 📝",
    message: `"${taskTitle}" was updated by ${changedBy}.`,
    category: "task",
    event: NOTIFICATION_EVENTS.task.TASK_UPDATED,
    priority: "low",
    clickAction: `/employee?tab=tasks&taskId=${taskId}`,
  });

export const sendTaskPriorityChanged = (userId: string, taskTitle: string, taskId: string, newPriority: string) =>
  createNotification({
    userId,
    type: "warning",
    title: "Task Priority Raised ⚡",
    message: `Priority for "${taskTitle}" changed to ${newPriority}.`,
    category: "task",
    event: NOTIFICATION_EVENTS.task.PRIORITY_CHANGED,
    priority: "high",
    clickAction: `/employee?tab=tasks&taskId=${taskId}`,
  });

export const sendDeadlineApproaching = (userId: string, taskTitle: string, taskId: string, timeStr: string) =>
  createNotification({
    userId,
    type: "warning",
    title: "Deadline Approaching ⏰",
    message: `The deadline for "${taskTitle}" is in ${timeStr}.`,
    category: "task",
    event: NOTIFICATION_EVENTS.task.DEADLINE_APPROACHING,
    priority: "high",
    clickAction: `/employee?tab=tasks&taskId=${taskId}`,
  });

export const sendDeadlineMissed = (userId: string, taskTitle: string, taskId: string) =>
  createNotification({
    userId,
    type: "error",
    title: "Task Overdue ❌",
    message: `The deadline for "${taskTitle}" has passed. Update progress ASAP.`,
    category: "task",
    event: NOTIFICATION_EVENTS.task.DEADLINE_MISSED,
    priority: "high",
    clickAction: `/employee?tab=tasks&taskId=${taskId}`,
  });

export const sendTaskCommented = (userId: string, taskTitle: string, taskId: string, author: string, commentSnippet: string) =>
  createNotification({
    userId,
    type: "info",
    title: "New Comment on Task 💬",
    message: `${author}: "${commentSnippet}" on "${taskTitle}"`,
    category: "task",
    event: NOTIFICATION_EVENTS.task.TASK_COMMENTED,
    priority: "medium",
    clickAction: `/employee?tab=tasks&taskId=${taskId}`,
  });

export const sendTaskApproved = (userId: string, taskTitle: string, taskId: string) =>
  createNotification({
    userId,
    type: "success",
    title: "Task Completed & Approved ✓",
    message: `Your work on "${taskTitle}" has been approved. Well done!`,
    category: "task",
    event: NOTIFICATION_EVENTS.task.TASK_APPROVED,
    priority: "medium",
    clickAction: `/employee?tab=tasks&taskId=${taskId}`,
  });

export const sendTaskRejected = (userId: string, taskTitle: string, taskId: string, feedback: string) =>
  createNotification({
    userId,
    type: "error",
    title: "Task Rejected / Revision Needed",
    message: `"${taskTitle}" needs revision. Feedback: ${feedback}`,
    category: "task",
    event: NOTIFICATION_EVENTS.task.TASK_REJECTED,
    priority: "high",
    clickAction: `/employee?tab=tasks&taskId=${taskId}`,
  });

export const sendMentionedInComment = (userId: string, taskTitle: string, taskId: string, author: string) =>
  createNotification({
    userId,
    type: "warning",
    title: "You were mentioned 💬",
    message: `${author} mentioned you in a comment on "${taskTitle}".`,
    category: "task",
    event: NOTIFICATION_EVENTS.task.MENTIONED_IN_COMMENT,
    priority: "high",
    clickAction: `/employee?tab=tasks&taskId=${taskId}`,
  });

export const sendSubtaskAssigned = (userId: string, subtaskTitle: string, parentTaskId: string) =>
  createNotification({
    userId,
    type: "info",
    title: "New Subtask Assigned",
    message: `Subtask: "${subtaskTitle}" has been assigned to you.`,
    category: "task",
    event: NOTIFICATION_EVENTS.task.SUBTASK_ASSIGNED,
    priority: "low",
    clickAction: `/employee?tab=tasks&taskId=${parentTaskId}`,
  });

export const sendTaskOverdueAlert = (managerId: string, employeeName: string, taskTitle: string) =>
  createNotification({
    userId: managerId,
    type: "warning",
    title: "Employee Task Overdue Alert",
    message: `${employeeName}'s task "${taskTitle}" is overdue.`,
    category: "task",
    event: NOTIFICATION_EVENTS.task.TASK_OVERDUE,
    priority: "medium",
    clickAction: "/admin/employeedetails",
  });

export const sendSprintDelayedWarning = (managerId: string, sprintName: string, delayedTasksCount: number) =>
  createNotification({
    userId: managerId,
    type: "error",
    title: "Sprint Delivery Risk 🚨",
    message: `Sprint "${sprintName}" is at risk: ${delayedTasksCount} tasks are currently overdue.`,
    category: "task",
    event: NOTIFICATION_EVENTS.task.SPRINT_DELAYED,
    priority: "high",
    clickAction: "/admin",
  });

// ==========================================
// 4. MEETINGS MODULE
// ==========================================

export const sendMeetingScheduled = (userId: string, meetingTitle: string, dateStr: string, timeStr: string, meetingUrl?: string) =>
  createNotification({
    userId,
    type: "info",
    title: "New Meeting Scheduled 📅",
    message: `"${meetingTitle}" is scheduled for ${dateStr} at ${timeStr}.`,
    category: "meeting",
    event: NOTIFICATION_EVENTS.meeting.MEETING_SCHEDULED,
    priority: "medium",
    clickAction: "/employee",
    actionButtons: meetingUrl ? [{ action: "join-meeting", title: "Join" }] : undefined,
    data: meetingUrl ? { meetingUrl } : undefined,
  });

export const sendMeetingReminder15 = (userId: string, meetingTitle: string, timeStr: string, meetingUrl?: string) =>
  createNotification({
    userId,
    type: "warning",
    title: "Meeting Starts in 15 mins 📹",
    message: `"${meetingTitle}" starts at ${timeStr}. Ready up your camera!`,
    category: "meeting",
    event: NOTIFICATION_EVENTS.meeting.MEETING_REMINDER_15,
    priority: "high",
    clickAction: "/employee",
    actionButtons: meetingUrl ? [{ action: "join-meeting", title: "Join" }] : undefined,
    data: meetingUrl ? { meetingUrl } : undefined,
  });

export const sendMeetingCancelled = (userId: string, meetingTitle: string, dateStr: string) =>
  createNotification({
    userId,
    type: "error",
    title: "Meeting Cancelled ✕",
    message: `"${meetingTitle}" scheduled for ${dateStr} has been cancelled.`,
    category: "meeting",
    event: NOTIFICATION_EVENTS.meeting.MEETING_CANCELLED,
    priority: "medium",
    clickAction: "/employee",
  });

export const sendMeetingRescheduled = (userId: string, meetingTitle: string, newTimeStr: string) =>
  createNotification({
    userId,
    type: "info",
    title: "Meeting Rescheduled 📅",
    message: `"${meetingTitle}" has been moved to ${newTimeStr}.`,
    category: "meeting",
    event: NOTIFICATION_EVENTS.meeting.MEETING_RESCHEDULED,
    priority: "medium",
    clickAction: "/employee",
  });

export const sendRecordingAvailable = (userId: string, meetingTitle: string, videoUrl: string) =>
  createNotification({
    userId,
    type: "info",
    title: "Meeting Recording Available 📹",
    message: `Recording for "${meetingTitle}" is ready. Watch now.`,
    category: "meeting",
    event: NOTIFICATION_EVENTS.meeting.RECORDING_AVAILABLE,
    priority: "low",
    clickAction: "/employee",
    data: { videoUrl },
  });

export const sendAISummaryReady = (userId: string, meetingTitle: string) =>
  createNotification({
    userId,
    type: "success",
    title: "AI Meeting Summary Ready ✨",
    message: `Gemini AI summary and action items are ready for "${meetingTitle}".`,
    category: "meeting",
    event: NOTIFICATION_EVENTS.meeting.AI_SUMMARY_READY,
    priority: "low",
    clickAction: "/employee",
  });

// ==========================================
// 5. EMERGENCY ANNOUNCEMENTS
// ==========================================

export const sendOfficeClosedAlert = (userId: string, reason: string, dates: string) =>
  createNotification({
    userId,
    type: "error",
    title: "🚨 OFFICE CLOSED ALERT",
    message: `Office is CLOSED on ${dates} due to ${reason}. Work from home enabled.`,
    category: "emergency",
    event: NOTIFICATION_EVENTS.emergency.OFFICE_CLOSED,
    priority: "emergency",
    clickAction: "/notifications?filter=emergency",
  });

export const sendSystemOutageAlert = (userId: string, serviceName: string) =>
  createNotification({
    userId,
    type: "error",
    title: "🚨 SYSTEM OUTAGE DETECTED",
    message: `Service "${serviceName}" is experiencing outage. Tech teams are working on it.`,
    category: "emergency",
    event: NOTIFICATION_EVENTS.emergency.OUTAGE_ALERT,
    priority: "emergency",
    clickAction: "/notifications?filter=emergency",
  });

export const sendSecurityEmergencyAlert = (userId: string, instruction: string) =>
  createNotification({
    userId,
    type: "error",
    title: "🚨 SECURITY EMERGENCY",
    message: `Security alert triggered. Instructions: ${instruction}`,
    category: "emergency",
    event: NOTIFICATION_EVENTS.emergency.SECURITY_EMERGENCY,
    priority: "emergency",
    clickAction: "/notifications?filter=emergency",
  });

// ==========================================
// 6. AI INSIGHTS & ADVISOR
// ==========================================

export const sendBurnoutWarning = (userId: string, focusReason: string) =>
  createNotification({
    userId,
    type: "warning",
    title: "AI Wellbeing Guide 🌿",
    message: `You logged excessive overtime recently. ${focusReason} Suggesting a short break.`,
    category: "ai",
    event: NOTIFICATION_EVENTS.ai.BURNOUT_RISK,
    priority: "medium",
    clickAction: "/employee",
  });

export const sendFocusModePrompt = (userId: string) =>
  createNotification({
    userId,
    type: "info",
    title: "Deep Focus Session? 🧠",
    message: "No meetings scheduled for next 3 hours. Enable Focus Mode to minimize alerts?",
    category: "ai",
    event: NOTIFICATION_EVENTS.ai.FOCUS_MODE,
    priority: "low",
    clickAction: "/employee",
  });

export const sendDailyUpdatePending = (userId: string) =>
  createNotification({
    userId,
    type: "info",
    title: "AI Voice Update Pending 🎤",
    message: "Standup report is due. Tap here to record your voice update in 10 seconds.",
    category: "ai",
    event: NOTIFICATION_EVENTS.ai.DAILY_UPDATE_PENDING,
    priority: "high",
    clickAction: "/employee?action=voiceupdate",
  });

// ==========================================
// 7. PRODUCTIVITY CHAMPION
// ==========================================

export const sendMilestoneReached = (userId: string, milestoneName: string) =>
  createNotification({
    userId,
    type: "success",
    title: "Milestone Reached! 🎉",
    message: `Congratulations! You unlocked: "${milestoneName}".`,
    category: "productivity",
    event: NOTIFICATION_EVENTS.productivity.MILESTONE_REACHED,
    priority: "medium",
    clickAction: "/employee",
  });

export const sendFocusStreakReward = (userId: string, days: number) =>
  createNotification({
    userId,
    type: "success",
    title: "Productivity Streak! 🔥",
    message: `You maintained a focus streak of ${days} days. Keep up the high performance!`,
    category: "productivity",
    event: NOTIFICATION_EVENTS.productivity.FOCUS_STREAK,
    priority: "medium",
    clickAction: "/employee",
  });

export const sendBadgeEarned = (userId: string, badgeName: string, emoji: string) =>
  createNotification({
    userId,
    type: "success",
    title: `Badge Earned ${emoji}`,
    message: `Awesome! You earned the "${badgeName}" badge today.`,
    category: "productivity",
    event: NOTIFICATION_EVENTS.productivity.BADGE_EARNED,
    priority: "medium",
    clickAction: "/employee",
  });
