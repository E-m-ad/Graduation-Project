import db from "../database/db.js";
import z from "../utils/notification.zod.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const BOOKING_NOTIFICATION_TYPES = new Set([
  "rental_approved",
  "rental_rejected",
  "rental_started",
  "rental_ending_soon",
]);
const RENTAL_NOTIFICATION_TYPES = new Set(["rental_request"]);

const NOTIFICATION_SELECT = {
  id: true,
  userId: true,
  rentalId: true,
  type: true,
  title: true,
  message: true,
  data: true,
  isRead: true,
  readAt: true,
  createdAt: true,
  rental: {
    select: {
      id: true,
      productId: true,
      status: true,
      startDate: true,
      endDate: true,
      actualReturnDate: true,
      product: {
        select: {
          id: true,
          title: true,
          images: {
            take: 1,
            orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
            select: {
              id: true,
              imageUrl: true,
              thumbnailUrl: true,
              isPrimary: true,
            },
          },
        },
      },
    },
  },
};

const UNREAD_NOTIFICATION_SCOPE_SELECT = {
  id: true,
  type: true,
  data: true,
  rental: {
    select: {
      ownerId: true,
      renterId: true,
    },
  },
};

function getScopedNotificationUserId(notification, field) {
  if (
    typeof notification?.rental?.[field] === "string" &&
    notification.rental[field]
  ) {
    return notification.rental[field];
  }

  const dataValue = notification?.data?.[field];
  return typeof dataValue === "string" && dataValue ? dataValue : null;
}

function isBookingNotificationForUser(notification, userId) {
  if (BOOKING_NOTIFICATION_TYPES.has(notification.type)) {
    return true;
  }

  return (
    (notification.type === "rental_cancelled" ||
      notification.type === "rental_completed") &&
    getScopedNotificationUserId(notification, "renterId") === userId
  );
}

function isRentalNotificationForUser(notification, userId) {
  if (RENTAL_NOTIFICATION_TYPES.has(notification.type)) {
    return true;
  }

  return (
    (notification.type === "rental_cancelled" ||
      notification.type === "rental_completed") &&
    getScopedNotificationUserId(notification, "ownerId") === userId
  );
}

function getUnreadNotificationCounts(notifications, userId) {
  return notifications.reduce(
    (counts, notification) => {
      counts.unreadCount += 1;

      if (isBookingNotificationForUser(notification, userId)) {
        counts.bookingUnreadCount += 1;
      }

      if (isRentalNotificationForUser(notification, userId)) {
        counts.rentalUnreadCount += 1;
      }

      return counts;
    },
    {
      unreadCount: 0,
      bookingUnreadCount: 0,
      rentalUnreadCount: 0,
    },
  );
}

function matchesNotificationScope(notification, userId, scope) {
  if (scope === "notifications") {
    return true;
  }

  if (scope === "bookings") {
    return isBookingNotificationForUser(notification, userId);
  }

  if (scope === "rentals") {
    return isRentalNotificationForUser(notification, userId);
  }

  return false;
}

async function fetchUnreadNotificationEntries(userId, prismaClient = db) {
  return prismaClient.notification.findMany({
    where: {
      userId,
      isRead: false,
    },
    select: UNREAD_NOTIFICATION_SCOPE_SELECT,
  });
}

async function fetchUnreadNotificationCounts(userId, prismaClient = db) {
  const unreadNotifications = await fetchUnreadNotificationEntries(
    userId,
    prismaClient,
  );

  return getUnreadNotificationCounts(unreadNotifications, userId);
}

function buildPagination(page, limit, totalItems) {
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);

  return {
    page,
    limit,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

async function getNotifications(req, res) {
  const data = z.notificationListQuerySchema.safeParse(req.query);
  if (!data.success) {
    return res.status(400).json({
      success: false,
      message: data.error.issues[0].message,
    });
  }

  const page = data.data.page ?? DEFAULT_PAGE;
  const limit = Math.min(data.data.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const offset = (page - 1) * limit;
  const where = {
    userId: req.user.id,
    ...(data.data.isRead !== undefined ? { isRead: data.data.isRead } : {}),
    ...(data.data.type ? { type: data.data.type } : {}),
  };

  try {
    const [notifications, totalItems, unreadCount] = await db.$transaction([
      db.notification.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: [{ createdAt: "desc" }],
        select: NOTIFICATION_SELECT,
      }),
      db.notification.count({ where }),
      db.notification.count({
        where: {
          userId: req.user.id,
          isRead: false,
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        notifications,
        pagination: buildPagination(page, limit, totalItems),
        filters: {
          isRead: data.data.isRead ?? null,
          type: data.data.type ?? null,
        },
        unreadCount,
      },
    });
  } catch (error) {
    console.error("getNotifications error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
    });
  }
}

async function markNotificationAsRead(req, res) {
  const data = z.notificationIdParamSchema.safeParse(req.params);
  if (!data.success) {
    return res.status(400).json({
      success: false,
      message: data.error.issues[0].message,
    });
  }

  try {
    const existingNotification = await db.notification.findFirst({
      where: {
        id: data.data.id,
        userId: req.user.id,
      },
      select: NOTIFICATION_SELECT,
    });

    if (!existingNotification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    if (existingNotification.isRead) {
      return res.status(200).json({
        success: true,
        message: "Notification is already marked as read",
        data: existingNotification,
      });
    }

    const notification = await db.notification.update({
      where: { id: existingNotification.id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
      select: NOTIFICATION_SELECT,
    });

    return res.status(200).json({
      success: true,
      message: "Notification marked as read successfully",
      data: notification,
    });
  } catch (error) {
    console.error("markNotificationAsRead error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark notification as read",
    });
  }
}

async function markAllNotificationsAsRead(req, res) {
  try {
    const result = await db.notification.updateMany({
      where: {
        userId: req.user.id,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read successfully",
      data: {
        markedCount: result.count,
      },
    });
  } catch (error) {
    console.error("markAllNotificationsAsRead error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark all notifications as read",
    });
  }
}

async function deleteNotification(req, res) {
  const data = z.notificationIdParamSchema.safeParse(req.params);
  if (!data.success) {
    return res.status(400).json({
      success: false,
      message: data.error.issues[0].message,
    });
  }

  try {
    const existingNotification = await db.notification.findFirst({
      where: {
        id: data.data.id,
        userId: req.user.id,
      },
      select: NOTIFICATION_SELECT,
    });

    if (!existingNotification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    await db.notification.delete({
      where: {
        id: existingNotification.id,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
      data: {
        id: existingNotification.id,
      },
    });
  } catch (error) {
    console.error("deleteNotification error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete notification",
    });
  }
}

async function markRentalNotificationsAsRead(req, res) {
  const data = z.notificationRentalIdParamSchema.safeParse(req.params);
  if (!data.success) {
    return res.status(400).json({
      success: false,
      message: data.error.issues[0].message,
    });
  }

  try {
    const result = await db.notification.updateMany({
      where: {
        rentalId: data.data.id,
        userId: req.user.id,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    const unreadCounts = await fetchUnreadNotificationCounts(req.user.id);

    return res.status(200).json({
      success: true,
      message: "Rental notifications marked as read successfully",
      data: {
        rentalId: data.data.id,
        markedCount: result.count,
        ...unreadCounts,
      },
    });
  } catch (error) {
    console.error("markRentalNotificationsAsRead error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update rental notifications",
    });
  }
}

async function markNotificationScopeAsRead(req, res) {
  const data = z.notificationScopeParamSchema.safeParse(req.params);
  if (!data.success) {
    return res.status(400).json({
      success: false,
      message: data.error.issues[0].message,
    });
  }

  try {
    const unreadNotifications = await fetchUnreadNotificationEntries(
      req.user.id,
    );
    const matchingNotificationIds = unreadNotifications
      .filter((notification) =>
        matchesNotificationScope(notification, req.user.id, data.data.scope),
      )
      .map((notification) => notification.id);

    if (matchingNotificationIds.length) {
      await db.notification.updateMany({
        where: {
          id: {
            in: matchingNotificationIds,
          },
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });
    }

    const unreadCounts = await fetchUnreadNotificationCounts(req.user.id);

    return res.status(200).json({
      success: true,
      message: "Notification scope marked as read successfully",
      data: {
        scope: data.data.scope,
        markedCount: matchingNotificationIds.length,
        ...unreadCounts,
      },
    });
  } catch (error) {
    console.error("markNotificationScopeAsRead error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update notification scope",
    });
  }
}

async function getUnreadNotificationsCount(req, res) {
  try {
    return res.status(200).json({
      success: true,
      data: await fetchUnreadNotificationCounts(req.user.id),
    });
  } catch (error) {
    console.error("getUnreadNotificationsCount error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch unread notification count",
    });
  }
}

export default {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  markRentalNotificationsAsRead,
  markNotificationScopeAsRead,
  deleteNotification,
  getUnreadNotificationsCount,
};
