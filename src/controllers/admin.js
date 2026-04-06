import db from "../database/db.js";
import z from "../utils/admin.zod.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const PUBLIC_PRODUCT_STATUSES = ["available", "rented", "unavailable"];
const BOOKED_RENTAL_STATUSES = ["approved", "active", "completed", "overdue"];

const ADMIN_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  avatarUrl: true,
  role: true,
  address: true,
  city: true,
  bio: true,
  isActive: true,
  isVerified: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      productsOwned: true,
      rentalsAsRenter: true,
      rentalsAsOwner: true,
      reviewsWritten: true,
      wishlists: true,
      notifications: true,
    },
  },
};

const ADMIN_PRODUCT_SELECT = {
  id: true,
  ownerId: true,
  categoryId: true,
  title: true,
  description: true,
  pricePerHour: true,
  pricePerDay: true,
  pricePerWeek: true,
  pricePerMonth: true,
  securityDeposit: true,
  city: true,
  status: true,
  condition: true,
  avgRating: true,
  totalReviews: true,
  totalRentals: true,
  viewCount: true,
  isApproved: true,
  isFeatured: true,
  adminReviewNote: true,
  ownerReviewReply: true,
  adminReviewedAt: true,
  ownerRepliedAt: true,
  createdAt: true,
  updatedAt: true,
  owner: {
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      city: true,
      isActive: true,
      isVerified: true,
    },
  },
  category: {
    select: {
      id: true,
      name: true,
      iconUrl: true,
    },
  },
  images: {
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
    select: {
      id: true,
      imageUrl: true,
      thumbnailUrl: true,
      isPrimary: true,
    },
  },
};

const ADMIN_RENTAL_SELECT = {
  id: true,
  productId: true,
  renterId: true,
  ownerId: true,
  startDate: true,
  endDate: true,
  actualReturnDate: true,
  rentalPeriodType: true,
  quantity: true,
  unitPrice: true,
  totalPrice: true,
  securityDeposit: true,
  platformFee: true,
  status: true,
  cancellationReason: true,
  cancelledBy: true,
  ownerNotes: true,
  renterNotes: true,
  createdAt: true,
  updatedAt: true,
  product: {
    select: {
      id: true,
      title: true,
      status: true,
      city: true,
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
  renter: {
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      isActive: true,
    },
  },
  owner: {
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      isActive: true,
    },
  },
  review: {
    select: {
      id: true,
      rating: true,
      createdAt: true,
    },
  },
};

function ensureAdmin(req, res) {
  if (req.user?.role !== "admin") {
    res.status(403).json({
      success: false,
      message: "Only admins can access this resource",
    });
    return false;
  }

  return true;
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

function toNumber(value) {
  return value == null ? 0 : Number(value);
}

function roundNumber(value, digits = 2) {
  return Number(Number(value).toFixed(digits));
}

function getMonthStartUtc(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonthsUtc(date, months) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function getMonthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function buildMonthlySeries(items, months, now = new Date()) {
  const currentMonthStart = getMonthStartUtc(now);
  const firstMonthStart = addMonthsUtc(currentMonthStart, -(months - 1));
  const counts = new Map();
  const monthsList = [];

  for (let index = 0; index < months; index += 1) {
    const bucketDate = addMonthsUtc(firstMonthStart, index);
    const key = getMonthKey(bucketDate);
    counts.set(key, 0);
    monthsList.push(key);
  }

  for (const item of items) {
    const itemDate = new Date(item.createdAt);
    const key = getMonthKey(itemDate);

    if (counts.has(key)) {
      counts.set(key, counts.get(key) + 1);
    }
  }

  return monthsList.map((month) => ({
    month,
    count: counts.get(month) ?? 0,
  }));
}

async function createSystemNotification(tx, input) {
  return tx.notification.create({
    data: {
      userId: input.userId,
      type: "system",
      title: input.title,
      message: input.message,
      data: input.data,
    },
  });
}

async function getDashboard(req, res) {
  if (!ensureAdmin(req, res)) {
    return;
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

  try {
    const [
      totalUsers,
      activeUsers,
      totalProducts,
      approvedProducts,
      pendingProducts,
      suspendedProducts,
      totalRentals,
      pendingRentals,
      activeRentals,
      overdueRentals,
      completedRentals,
      totalReviews,
      totalCategories,
      revenueAggregate,
      newUsersLast30Days,
      newProductsLast30Days,
      newRentalsLast30Days,
      newReviewsLast30Days,
      recentUsers,
      recentPendingProducts,
      recentRentals,
    ] = await db.$transaction([
      db.user.count(),
      db.user.count({ where: { isActive: true } }),
      db.product.count(),
      db.product.count({ where: { isApproved: true } }),
      db.product.count({
        where: {
          isApproved: false,
          status: "under_review",
        },
      }),
      db.product.count({
        where: {
          status: "suspended",
        },
      }),
      db.rental.count(),
      db.rental.count({ where: { status: "pending" } }),
      db.rental.count({ where: { status: "active" } }),
      db.rental.count({ where: { status: "overdue" } }),
      db.rental.count({ where: { status: "completed" } }),
      db.review.count(),
      db.category.count(),
      db.rental.aggregate({
        where: {
          status: {
            in: BOOKED_RENTAL_STATUSES,
          },
        },
        _sum: {
          totalPrice: true,
          platformFee: true,
        },
      }),
      db.user.count({
        where: {
          createdAt: {
            gte: thirtyDaysAgo,
          },
        },
      }),
      db.product.count({
        where: {
          createdAt: {
            gte: thirtyDaysAgo,
          },
        },
      }),
      db.rental.count({
        where: {
          createdAt: {
            gte: thirtyDaysAgo,
          },
        },
      }),
      db.review.count({
        where: {
          createdAt: {
            gte: thirtyDaysAgo,
          },
        },
      }),
      db.user.findMany({
        take: 5,
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      }),
      db.product.findMany({
        where: {
          isApproved: false,
          status: "under_review",
        },
        take: 5,
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          title: true,
          createdAt: true,
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      db.rental.findMany({
        take: 5,
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          status: true,
          totalPrice: true,
          createdAt: true,
          product: {
            select: {
              id: true,
              title: true,
            },
          },
          renter: {
            select: {
              id: true,
              name: true,
            },
          },
          owner: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          users: {
            total: totalUsers,
            active: activeUsers,
            suspended: totalUsers - activeUsers,
          },
          products: {
            total: totalProducts,
            approved: approvedProducts,
            pendingReview: pendingProducts,
            suspended: suspendedProducts,
          },
          rentals: {
            total: totalRentals,
            pending: pendingRentals,
            active: activeRentals,
            overdue: overdueRentals,
            completed: completedRentals,
          },
          content: {
            reviews: totalReviews,
            categories: totalCategories,
          },
        },
        financial: {
          bookedValue: roundNumber(toNumber(revenueAggregate._sum.totalPrice)),
          platformFees: roundNumber(toNumber(revenueAggregate._sum.platformFee)),
        },
        growthLast30Days: {
          users: newUsersLast30Days,
          products: newProductsLast30Days,
          rentals: newRentalsLast30Days,
          reviews: newReviewsLast30Days,
        },
        recent: {
          users: recentUsers,
          pendingProducts: recentPendingProducts,
          rentals: recentRentals,
        },
      },
    });
  } catch (error) {
    console.error("getDashboard error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics",
    });
  }
}

async function getUsers(req, res) {
  if (!ensureAdmin(req, res)) {
    return;
  }

  const data = z.adminUsersQuerySchema.safeParse(req.query);
  if (!data.success) {
    return res.status(400).json({
      success: false,
      message: data.error.issues[0].message,
    });
  }

  const page = data.data.page ?? DEFAULT_PAGE;
  const limit = Math.min(data.data.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const offset = (page - 1) * limit;
  const where = {};

  if (data.data.role) {
    where.role = data.data.role;
  }

  if (data.data.isActive !== undefined) {
    where.isActive = data.data.isActive;
  }

  if (data.data.search) {
    where.OR = [
      {
        name: {
          contains: data.data.search,
          mode: "insensitive",
        },
      },
      {
        email: {
          contains: data.data.search,
          mode: "insensitive",
        },
      },
      {
        phone: {
          contains: data.data.search,
          mode: "insensitive",
        },
      },
      {
        city: {
          contains: data.data.search,
          mode: "insensitive",
        },
      },
    ];
  }

  try {
    const [users, totalItems] = await db.$transaction([
      db.user.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: [{ createdAt: "desc" }],
        select: ADMIN_USER_SELECT,
      }),
      db.user.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        users,
        pagination: buildPagination(page, limit, totalItems),
        filters: {
          search: data.data.search ?? null,
          role: data.data.role ?? null,
          isActive: data.data.isActive ?? null,
        },
      },
    });
  } catch (error) {
    console.error("getUsers error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
}

async function updateUserStatus(req, res) {
  if (!ensureAdmin(req, res)) {
    return;
  }

  const paramsData = z.userIdParamSchema.safeParse(req.params);
  if (!paramsData.success) {
    return res.status(400).json({
      success: false,
      message: paramsData.error.issues[0].message,
    });
  }

  const bodyData = z.adminUserStatusSchema.safeParse(req.body);
  if (!bodyData.success) {
    return res.status(400).json({
      success: false,
      message: bodyData.error.issues[0].message,
    });
  }

  try {
    const user = await db.user.findUnique({
      where: { id: paramsData.data.id },
      select: ADMIN_USER_SELECT,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.id === req.user.id && bodyData.data.isActive === false) {
      return res.status(409).json({
        success: false,
        message: "You cannot suspend your own account",
      });
    }

    if (user.isActive === bodyData.data.isActive) {
      return res.status(200).json({
        success: true,
        message: user.isActive
          ? "User is already active"
          : "User is already suspended",
        data: user,
      });
    }

    const updatedUser = await db.$transaction(async (tx) => {
      const nextUser = await tx.user.update({
        where: { id: user.id },
        data: {
          isActive: bodyData.data.isActive,
        },
        select: ADMIN_USER_SELECT,
      });

      if (!bodyData.data.isActive) {
        await tx.refreshToken.updateMany({
          where: { userId: user.id },
          data: { isRevoked: true },
        });
      }

      await createSystemNotification(tx, {
        userId: user.id,
        title: bodyData.data.isActive
          ? "Account activated"
          : "Account suspended",
        message: bodyData.data.isActive
          ? "Your account has been activated by an administrator"
          : "Your account has been suspended by an administrator",
        data: {
          action: bodyData.data.isActive ? "activated" : "suspended",
          adminId: req.user.id,
          reason: bodyData.data.reason ?? null,
        },
      });

      return nextUser;
    });

    return res.status(200).json({
      success: true,
      message: bodyData.data.isActive
        ? "User activated successfully"
        : "User suspended successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("updateUserStatus error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update user status",
    });
  }
}

async function getProducts(req, res) {
  if (!ensureAdmin(req, res)) {
    return;
  }

  const data = z.adminProductsQuerySchema.safeParse(req.query);
  if (!data.success) {
    return res.status(400).json({
      success: false,
      message: data.error.issues[0].message,
    });
  }

  const page = data.data.page ?? DEFAULT_PAGE;
  const limit = Math.min(data.data.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const offset = (page - 1) * limit;
  const where = {};

  if (data.data.status) {
    where.status = data.data.status;
  }

  if (data.data.isApproved !== undefined) {
    where.isApproved = data.data.isApproved;
  }

  if (data.data.ownerId) {
    where.ownerId = data.data.ownerId;
  }

  if (data.data.categoryId) {
    where.categoryId = data.data.categoryId;
  }

  if (data.data.city) {
    where.city = {
      contains: data.data.city,
      mode: "insensitive",
    };
  }

  if (data.data.search) {
    where.OR = [
      {
        title: {
          contains: data.data.search,
          mode: "insensitive",
        },
      },
      {
        description: {
          contains: data.data.search,
          mode: "insensitive",
        },
      },
      {
        city: {
          contains: data.data.search,
          mode: "insensitive",
        },
      },
      {
        owner: {
          is: {
            name: {
              contains: data.data.search,
              mode: "insensitive",
            },
          },
        },
      },
      {
        owner: {
          is: {
            email: {
              contains: data.data.search,
              mode: "insensitive",
            },
          },
        },
      },
    ];
  }

  try {
    const [products, totalItems] = await db.$transaction([
      db.product.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: [{ createdAt: "desc" }],
        select: ADMIN_PRODUCT_SELECT,
      }),
      db.product.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        products,
        pagination: buildPagination(page, limit, totalItems),
        filters: {
          search: data.data.search ?? null,
          status: data.data.status ?? null,
          isApproved: data.data.isApproved ?? null,
          ownerId: data.data.ownerId ?? null,
          categoryId: data.data.categoryId ?? null,
          city: data.data.city ?? null,
        },
      },
    });
  } catch (error) {
    console.error("getProducts error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch products",
    });
  }
}

async function approveProduct(req, res) {
  if (!ensureAdmin(req, res)) {
    return;
  }

  const paramsData = z.productIdParamSchema.safeParse(req.params);
  if (!paramsData.success) {
    return res.status(400).json({
      success: false,
      message: paramsData.error.issues[0].message,
    });
  }

  const bodyData = z.adminProductModerationSchema.safeParse(req.body);
  if (!bodyData.success) {
    return res.status(400).json({
      success: false,
      message: bodyData.error.issues[0].message,
    });
  }

  try {
    const product = await db.product.findUnique({
      where: { id: paramsData.data.id },
      select: {
        id: true,
        ownerId: true,
        title: true,
        status: true,
        isApproved: true,
      },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (product.isApproved && PUBLIC_PRODUCT_STATUSES.includes(product.status)) {
      const existingProduct = await db.product.findUnique({
        where: { id: product.id },
        select: ADMIN_PRODUCT_SELECT,
      });

      return res.status(200).json({
        success: true,
        message: "Listing is already approved",
        data: existingProduct,
      });
    }

    const nextStatus = PUBLIC_PRODUCT_STATUSES.includes(product.status)
      ? product.status
      : "available";

    const updatedProduct = await db.$transaction(async (tx) => {
      const nextProduct = await tx.product.update({
        where: { id: product.id },
        data: {
          isApproved: true,
          status: nextStatus,
          adminReviewNote: null,
          ownerReviewReply: null,
          adminReviewedAt: new Date(),
          ownerRepliedAt: null,
        },
        select: ADMIN_PRODUCT_SELECT,
      });

      await createSystemNotification(tx, {
        userId: product.ownerId,
        title: "Listing approved",
        message: `Your listing "${product.title}" has been approved`,
        data: {
          productId: product.id,
          action: "approved",
          reason: bodyData.data.reason ?? null,
        },
      });

      return nextProduct;
    });

    return res.status(200).json({
      success: true,
      message: "Listing approved successfully",
      data: updatedProduct,
    });
  } catch (error) {
    console.error("approveProduct error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to approve listing",
    });
  }
}

async function rejectProduct(req, res) {
  if (!ensureAdmin(req, res)) {
    return;
  }

  const paramsData = z.productIdParamSchema.safeParse(req.params);
  if (!paramsData.success) {
    return res.status(400).json({
      success: false,
      message: paramsData.error.issues[0].message,
    });
  }

  const bodyData = z.adminProductModerationSchema.safeParse(req.body);
  if (!bodyData.success) {
    return res.status(400).json({
      success: false,
      message: bodyData.error.issues[0].message,
    });
  }

  if (!bodyData.data.reason) {
    return res.status(400).json({
      success: false,
      message: "Please include a note so the owner knows what to fix",
    });
  }

  try {
    const product = await db.product.findUnique({
      where: { id: paramsData.data.id },
      select: {
        id: true,
        ownerId: true,
        title: true,
        status: true,
        isApproved: true,
      },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (!product.isApproved && product.status === "suspended") {
      const existingProduct = await db.product.findUnique({
        where: { id: product.id },
        select: ADMIN_PRODUCT_SELECT,
      });

      return res.status(200).json({
        success: true,
        message: "Listing is already rejected",
        data: existingProduct,
      });
    }

    const updatedProduct = await db.$transaction(async (tx) => {
      const nextProduct = await tx.product.update({
        where: { id: product.id },
        data: {
          isApproved: false,
          status: "suspended",
          adminReviewNote: bodyData.data.reason,
          ownerReviewReply: null,
          adminReviewedAt: new Date(),
          ownerRepliedAt: null,
        },
        select: ADMIN_PRODUCT_SELECT,
      });

      await createSystemNotification(tx, {
        userId: product.ownerId,
        title: "Listing needs changes",
        message: `Your listing "${product.title}" needs updates before it can be approved`,
        data: {
          productId: product.id,
          action: "rejected",
          reason: bodyData.data.reason ?? null,
        },
      });

      return nextProduct;
    });

    return res.status(200).json({
      success: true,
      message: "Listing rejected successfully",
      data: updatedProduct,
    });
  } catch (error) {
    console.error("rejectProduct error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reject listing",
    });
  }
}

async function getRentals(req, res) {
  if (!ensureAdmin(req, res)) {
    return;
  }

  const data = z.adminRentalsQuerySchema.safeParse(req.query);
  if (!data.success) {
    return res.status(400).json({
      success: false,
      message: data.error.issues[0].message,
    });
  }

  const page = data.data.page ?? DEFAULT_PAGE;
  const limit = Math.min(data.data.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const offset = (page - 1) * limit;
  const where = {};

  if (data.data.status) {
    where.status = data.data.status;
  }

  if (data.data.ownerId) {
    where.ownerId = data.data.ownerId;
  }

  if (data.data.renterId) {
    where.renterId = data.data.renterId;
  }

  if (data.data.productId) {
    where.productId = data.data.productId;
  }

  if (data.data.search) {
    where.OR = [
      {
        product: {
          is: {
            title: {
              contains: data.data.search,
              mode: "insensitive",
            },
          },
        },
      },
      {
        renter: {
          is: {
            name: {
              contains: data.data.search,
              mode: "insensitive",
            },
          },
        },
      },
      {
        renter: {
          is: {
            email: {
              contains: data.data.search,
              mode: "insensitive",
            },
          },
        },
      },
      {
        owner: {
          is: {
            name: {
              contains: data.data.search,
              mode: "insensitive",
            },
          },
        },
      },
      {
        owner: {
          is: {
            email: {
              contains: data.data.search,
              mode: "insensitive",
            },
          },
        },
      },
    ];
  }

  try {
    const [rentals, totalItems] = await db.$transaction([
      db.rental.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: [{ createdAt: "desc" }],
        select: ADMIN_RENTAL_SELECT,
      }),
      db.rental.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        rentals,
        pagination: buildPagination(page, limit, totalItems),
        filters: {
          search: data.data.search ?? null,
          status: data.data.status ?? null,
          ownerId: data.data.ownerId ?? null,
          renterId: data.data.renterId ?? null,
          productId: data.data.productId ?? null,
        },
      },
    });
  } catch (error) {
    console.error("getRentals error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch rentals",
    });
  }
}

async function getReports(req, res) {
  if (!ensureAdmin(req, res)) {
    return;
  }

  const data = z.adminReportsQuerySchema.safeParse(req.query);
  if (!data.success) {
    return res.status(400).json({
      success: false,
      message: data.error.issues[0].message,
    });
  }

  const now = new Date();
  const days = data.data.days ?? 30;
  const months = data.data.months ?? 6;
  const periodStart = new Date(now);
  periodStart.setUTCDate(periodStart.getUTCDate() - days);
  const monthlySeriesStart = addMonthsUtc(getMonthStartUtc(now), -(months - 1));

  try {
    const [
      bookedRevenueAggregate,
      completedRevenueAggregate,
      rentalRequestCount,
      reviewsAggregate,
      usersByRole,
      usersByStatus,
      productsByStatus,
      productsByApproval,
      rentalsByStatus,
      userRegistrations,
      productSubmissions,
      rentalRequests,
      categories,
      topProducts,
    ] = await db.$transaction([
      db.rental.aggregate({
        where: {
          createdAt: {
            gte: periodStart,
          },
          status: {
            in: BOOKED_RENTAL_STATUSES,
          },
        },
        _sum: {
          totalPrice: true,
          platformFee: true,
        },
      }),
      db.rental.aggregate({
        where: {
          createdAt: {
            gte: periodStart,
          },
          status: "completed",
        },
        _sum: {
          totalPrice: true,
          platformFee: true,
        },
        _count: {
          id: true,
        },
      }),
      db.rental.count({
        where: {
          createdAt: {
            gte: periodStart,
          },
        },
      }),
      db.review.aggregate({
        where: {
          createdAt: {
            gte: periodStart,
          },
        },
        _avg: {
          rating: true,
        },
        _count: {
          id: true,
        },
      }),
      db.user.groupBy({
        by: ["role"],
        _count: {
          _all: true,
        },
      }),
      db.user.groupBy({
        by: ["isActive"],
        _count: {
          _all: true,
        },
      }),
      db.product.groupBy({
        by: ["status"],
        _count: {
          _all: true,
        },
      }),
      db.product.groupBy({
        by: ["isApproved"],
        _count: {
          _all: true,
        },
      }),
      db.rental.groupBy({
        by: ["status"],
        _count: {
          _all: true,
        },
      }),
      db.user.findMany({
        where: {
          createdAt: {
            gte: monthlySeriesStart,
          },
        },
        select: {
          createdAt: true,
        },
      }),
      db.product.findMany({
        where: {
          createdAt: {
            gte: monthlySeriesStart,
          },
        },
        select: {
          createdAt: true,
        },
      }),
      db.rental.findMany({
        where: {
          createdAt: {
            gte: monthlySeriesStart,
          },
        },
        select: {
          createdAt: true,
        },
      }),
      db.category.findMany({
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              products: true,
            },
          },
        },
      }),
      db.product.findMany({
        take: 5,
        orderBy: [
          { totalRentals: "desc" },
          { avgRating: "desc" },
          { createdAt: "desc" },
        ],
        select: {
          id: true,
          title: true,
          totalRentals: true,
          avgRating: true,
          status: true,
          isApproved: true,
          owner: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    const categoriesByListings = [...categories]
      .sort((left, right) => right._count.products - left._count.products)
      .slice(0, 5)
      .map((category) => ({
        id: category.id,
        name: category.name,
        totalProducts: category._count.products,
      }));

    const completionRate =
      rentalRequestCount === 0
        ? 0
        : roundNumber((completedRevenueAggregate._count.id / rentalRequestCount) * 100);

    return res.status(200).json({
      success: true,
      data: {
        period: {
          days,
          months,
          fromDate: periodStart,
          toDate: now,
        },
        revenue: {
          bookedValue: roundNumber(toNumber(bookedRevenueAggregate._sum.totalPrice)),
          bookedPlatformFees: roundNumber(
            toNumber(bookedRevenueAggregate._sum.platformFee),
          ),
          completedValue: roundNumber(
            toNumber(completedRevenueAggregate._sum.totalPrice),
          ),
          completedPlatformFees: roundNumber(
            toNumber(completedRevenueAggregate._sum.platformFee),
          ),
        },
        quality: {
          averageRating: roundNumber(toNumber(reviewsAggregate._avg.rating)),
          totalReviews: reviewsAggregate._count.id,
          completionRate,
        },
        distributions: {
          usersByRole: usersByRole.map((group) => ({
            role: group.role,
            count: group._count._all,
          })),
          usersByStatus: usersByStatus.map((group) => ({
            status: group.isActive ? "active" : "suspended",
            count: group._count._all,
          })),
          productsByStatus: productsByStatus.map((group) => ({
            status: group.status,
            count: group._count._all,
          })),
          productsByApproval: productsByApproval.map((group) => ({
            status: group.isApproved ? "approved" : "unapproved",
            count: group._count._all,
          })),
          rentalsByStatus: rentalsByStatus.map((group) => ({
            status: group.status,
            count: group._count._all,
          })),
        },
        trends: {
          userRegistrations: buildMonthlySeries(userRegistrations, months, now),
          productSubmissions: buildMonthlySeries(productSubmissions, months, now),
          rentalRequests: buildMonthlySeries(rentalRequests, months, now),
        },
        leaderboards: {
          categoriesByListings,
          productsByRentals: topProducts.map((product) => ({
            id: product.id,
            title: product.title,
            totalRentals: product.totalRentals,
            avgRating: product.avgRating,
            status: product.status,
            isApproved: product.isApproved,
            owner: product.owner,
          })),
        },
      },
    });
  } catch (error) {
    console.error("getReports error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch admin reports",
    });
  }
}

export default {
  approveProduct,
  getDashboard,
  getProducts,
  getRentals,
  getReports,
  getUsers,
  rejectProduct,
  updateUserStatus,
};
