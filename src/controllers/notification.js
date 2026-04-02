import db from "../database/db.js";
import z from "../utils/notification.zod.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

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

async function getUnreadNotificationsCount(req, res) {
  try {
    const unreadCount = await db.notification.count({
      where: {
        userId: req.user.id,
        isRead: false,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        unreadCount,
      },
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
  getUnreadNotificationsCount,
};
