import db from "../database/db.js";
import {
  createAdminNotifications,
  createWishlistAvailabilityNotifications,
} from "../utils/notification.helpers.js";
import z from "../utils/rental.zod.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;
const ACTIVE_BOOKING_PRODUCT_STATUSES = ["available", "rented"];
const BLOCKING_RENTAL_STATUSES = ["approved", "active", "overdue"];
const UNAVAILABLE_PRODUCT_STATUSES = ["unavailable", "under_review", "suspended"];

const USER_SUMMARY_SELECT = {
  id: true,
  name: true,
  avatarUrl: true,
  role: true,
  city: true,
  isVerified: true,
};

const REVIEW_SUMMARY_SELECT = {
  id: true,
  rating: true,
  comment: true,
  ownerReply: true,
  ownerReplyAt: true,
  isVisible: true,
  createdAt: true,
  updatedAt: true,
};

const RENTAL_PRODUCT_SELECT = {
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
  locationAddress: true,
  city: true,
  status: true,
  condition: true,
  minRentalPeriod: true,
  maxRentalPeriod: true,
  termsConditions: true,
  isApproved: true,
  createdAt: true,
  updatedAt: true,
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
      sortOrder: true,
    },
  },
};

const RENTAL_LIST_SELECT = {
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
  review: {
    select: REVIEW_SUMMARY_SELECT,
  },
  product: {
    select: RENTAL_PRODUCT_SELECT,
  },
  renter: {
    select: USER_SUMMARY_SELECT,
  },
  owner: {
    select: USER_SUMMARY_SELECT,
  },
};

const RENTAL_DETAIL_SELECT = {
  ...RENTAL_LIST_SELECT,
};

function isAdmin(user) {
  return user?.role === "admin";
}

function canManageRentalAsOwner(user, rental) {
  return isAdmin(user) || rental.ownerId === user.id;
}

function canAccessRental(user, rental) {
  return (
    isAdmin(user) ||
    rental.ownerId === user.id ||
    rental.renterId === user.id
  );
}

function canCancelRental(user, rental) {
  return canAccessRental(user, rental);
}

function roundCurrency(value) {
  return Number(value.toFixed(2));
}

function getRentalUnitMilliseconds(rentalPeriodType) {
  const unitMap = {
    hourly: 60 * 60 * 1000,
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
    monthly: 30 * 24 * 60 * 60 * 1000,
  };

  return unitMap[rentalPeriodType] ?? null;
}

function getRentalUnitLabel(rentalPeriodType, count) {
  const unitMap = {
    hourly: count === 1 ? "hour" : "hours",
    daily: count === 1 ? "day" : "days",
    weekly: count === 1 ? "week" : "weeks",
    monthly: count === 1 ? "month" : "months",
  };

  return unitMap[rentalPeriodType] ?? "units";
}

function getProductUnitPrice(product, rentalPeriodType) {
  const unitPriceMap = {
    hourly: product.pricePerHour,
    daily: product.pricePerDay,
    weekly: product.pricePerWeek,
    monthly: product.pricePerMonth,
  };

  const unitPrice = unitPriceMap[rentalPeriodType];
  return unitPrice == null ? null : Number(unitPrice);
}

function calculateRentalUnits(startDate, endDate, rentalPeriodType) {
  const diffMs = endDate.getTime() - startDate.getTime();
  const unitMs = getRentalUnitMilliseconds(rentalPeriodType);

  if (!unitMs || diffMs <= 0) {
    return 0;
  }

  return Math.ceil(diffMs / unitMs);
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

function getRentalPricingPreview(product, payload) {
  const quantity = payload.quantity ?? 1;
  const durationUnits = calculateRentalUnits(
    payload.startDate,
    payload.endDate,
    payload.rentalPeriodType,
  );

  if (durationUnits <= 0) {
    return {
      success: false,
      status: 400,
      message: "Rental end date must be after the start date",
    };
  }

  const unitPrice = getProductUnitPrice(product, payload.rentalPeriodType);
  if (unitPrice == null) {
    return {
      success: false,
      status: 400,
      message: `This listing does not support ${payload.rentalPeriodType} rentals`,
    };
  }

  if (durationUnits < product.minRentalPeriod) {
    return {
      success: false,
      status: 400,
      message: `Rental duration must be at least ${product.minRentalPeriod} ${getRentalUnitLabel(payload.rentalPeriodType, product.minRentalPeriod)}`,
    };
  }

  if (durationUnits > product.maxRentalPeriod) {
    return {
      success: false,
      status: 400,
      message: `Rental duration cannot exceed ${product.maxRentalPeriod} ${getRentalUnitLabel(payload.rentalPeriodType, product.maxRentalPeriod)}`,
    };
  }

  const securityDeposit =
    product.securityDeposit == null ? 0 : Number(product.securityDeposit);
  const platformFee = 0;

  return {
    success: true,
    data: {
      rentalPeriodType: payload.rentalPeriodType,
      durationUnits,
      quantity,
      unitPrice: roundCurrency(unitPrice),
      totalPrice: roundCurrency(unitPrice * durationUnits * quantity),
      securityDeposit: roundCurrency(securityDeposit),
      platformFee,
    },
  };
}

async function findAvailabilityConflict(
  client,
  productId,
  startDate,
  endDate,
  excludeRentalId = null,
) {
  const rentalWhere = {
    productId,
    status: {
      in: BLOCKING_RENTAL_STATUSES,
    },
    startDate: {
      lt: endDate,
    },
    endDate: {
      gt: startDate,
    },
  };

  if (excludeRentalId) {
    rentalWhere.id = {
      not: excludeRentalId,
    };
  }

  const [overlappingRental, calendarConflict] = await Promise.all([
    client.rental.findFirst({
      where: rentalWhere,
      orderBy: [{ startDate: "asc" }],
      select: {
        id: true,
        startDate: true,
        endDate: true,
        status: true,
      },
    }),
    client.availabilityCalendar.findFirst({
      where: {
        productId,
        unavailableFrom: {
          lt: endDate,
        },
        unavailableTo: {
          gt: startDate,
        },
      },
      orderBy: [{ unavailableFrom: "asc" }],
      select: {
        id: true,
        unavailableFrom: true,
        unavailableTo: true,
        reason: true,
        notes: true,
      },
    }),
  ]);

  return {
    isAvailable: !overlappingRental && !calendarConflict,
    overlappingRental,
    calendarConflict,
  };
}

async function createNotification(tx, input) {
  return tx.notification.create({
    data: {
      userId: input.userId,
      rentalId: input.rentalId,
      type: input.type,
      title: input.title,
      message: input.message,
      data: input.data,
    },
  });
}

async function getRentalDetails(req, res) {
  const data = z.rentalIdParamSchema.safeParse(req.params);
  if (!data.success) {
    return res.status(400).json({
      success: false,
      message: data.error.issues[0].message,
    });
  }

  try {
    const rental = await db.rental.findUnique({
      where: { id: data.data.id },
      select: RENTAL_DETAIL_SELECT,
    });

    if (!rental) {
      return res.status(404).json({
        success: false,
        message: "Rental not found",
      });
    }

    if (!canAccessRental(req.user, rental)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to view this rental",
      });
    }

    return res.status(200).json({
      success: true,
      data: rental,
    });
  } catch (error) {
    console.error("getRentalDetails error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch rental details",
    });
  }
}

async function getMyBookings(req, res) {
  const data = z.rentalListQuerySchema.safeParse(req.query);
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
    renterId: req.user.id,
  };

  if (data.data.status) {
    where.status = data.data.status;
  }

  if (data.data.productId) {
    where.productId = data.data.productId;
  }

  try {
    const [rentals, totalItems] = await db.$transaction([
      db.rental.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: [{ createdAt: "desc" }],
        select: RENTAL_LIST_SELECT,
      }),
      db.rental.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        rentals,
        pagination: buildPagination(page, limit, totalItems),
        filters: {
          status: data.data.status ?? null,
          productId: data.data.productId ?? null,
        },
      },
    });
  } catch (error) {
    console.error("getMyBookings error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch your bookings",
    });
  }
}

async function getMyRequests(req, res) {
  const data = z.rentalListQuerySchema.safeParse(req.query);
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
    ownerId: req.user.id,
  };

  if (data.data.status) {
    where.status = data.data.status;
  }

  if (data.data.productId) {
    where.productId = data.data.productId;
  }

  try {
    const [rentals, totalItems] = await db.$transaction([
      db.rental.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: [{ createdAt: "desc" }],
        select: RENTAL_LIST_SELECT,
      }),
      db.rental.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        rentals,
        pagination: buildPagination(page, limit, totalItems),
        filters: {
          status: data.data.status ?? null,
          productId: data.data.productId ?? null,
        },
      },
    });
  } catch (error) {
    console.error("getMyRequests error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch your rental requests",
    });
  }
}

async function createRental(req, res) {
  const data = z.createRentalSchema.safeParse(req.body);
  if (!data.success) {
    return res.status(400).json({
      success: false,
      message: data.error.issues[0].message,
      error: {
        path: data.error.issues[0].path.join("."),
        message: data.error.issues[0].message,
      },
    });
  }

  const payload = {
    ...data.data,
    quantity: data.data.quantity ?? 1,
  };

  if (payload.startDate <= new Date()) {
    return res.status(400).json({
      success: false,
      message: "Rental start date must be in the future",
    });
  }

  try {
    const product = await db.product.findUnique({
      where: { id: payload.productId },
      select: {
        id: true,
        ownerId: true,
        categoryId: true,
        title: true,
        status: true,
        isApproved: true,
        minRentalPeriod: true,
        maxRentalPeriod: true,
        pricePerHour: true,
        pricePerDay: true,
        pricePerWeek: true,
        pricePerMonth: true,
        securityDeposit: true,
      },
    });

    if (!product || !product.isApproved) {
      return res.status(404).json({
        success: false,
        message: "Listing not found",
      });
    }

    if (product.ownerId === req.user.id) {
      return res.status(409).json({
        success: false,
        message: "You cannot create a rental request for your own listing",
      });
    }

    if (
      !ACTIVE_BOOKING_PRODUCT_STATUSES.includes(product.status) ||
      UNAVAILABLE_PRODUCT_STATUSES.includes(product.status)
    ) {
      return res.status(409).json({
        success: false,
        message: "This listing is not accepting rental requests right now",
      });
    }

    const existingPendingRental = await db.rental.findFirst({
      where: {
        productId: product.id,
        renterId: req.user.id,
        status: "pending",
        endDate: {
          gt: new Date(),
        },
      },
      orderBy: [{ createdAt: "desc" }],
      select: RENTAL_DETAIL_SELECT,
    });

    if (existingPendingRental) {
      return res.status(409).json({
        success: false,
        message:
          "You already have a pending rental request for this listing. Wait for the owner to approve or reject it before sending another request.",
        data: {
          rental: existingPendingRental,
        },
      });
    }

    const pricing = getRentalPricingPreview(product, payload);
    if (!pricing.success) {
      return res.status(pricing.status).json({
        success: false,
        message: pricing.message,
      });
    }

    const conflict = await findAvailabilityConflict(
      db,
      product.id,
      payload.startDate,
      payload.endDate,
    );

    if (!conflict.isAvailable) {
      return res.status(409).json({
        success: false,
        message: "The selected dates are not available for this listing",
        data: {
          overlappingRental: conflict.overlappingRental,
          calendarConflict: conflict.calendarConflict,
        },
      });
    }

    const rental = await db.$transaction(async (tx) => {
      if (req.user.role === "owner") {
        await tx.user.update({
          where: { id: req.user.id },
          data: { role: "both" },
        });
      }

      const createdRental = await tx.rental.create({
        data: {
          productId: product.id,
          renterId: req.user.id,
          ownerId: product.ownerId,
          startDate: payload.startDate,
          endDate: payload.endDate,
          rentalPeriodType: payload.rentalPeriodType,
          quantity: payload.quantity,
          unitPrice: pricing.data.unitPrice,
          totalPrice: pricing.data.totalPrice,
          securityDeposit: pricing.data.securityDeposit,
          platformFee: pricing.data.platformFee,
          renterNotes: payload.renterNotes,
        },
        select: { id: true },
      });

      await Promise.all([
        tx.userBehavior.create({
          data: {
            userId: req.user.id,
            productId: product.id,
            categoryId: product.categoryId,
            actionType: "rent",
            metadata: {
              rentalId: createdRental.id,
              rentalPeriodType: payload.rentalPeriodType,
              startDate: payload.startDate.toISOString(),
              endDate: payload.endDate.toISOString(),
            },
          },
        }),
        createNotification(tx, {
          userId: product.ownerId,
          rentalId: createdRental.id,
          type: "rental_request",
          title: "New rental request",
          message: `${req.user.name} requested to rent ${product.title}`,
          data: {
            productId: product.id,
            renterId: req.user.id,
          },
        }),
        createAdminNotifications(tx, {
          rentalId: createdRental.id,
          title: "New rental request",
          message: `${req.user.name} requested to rent ${product.title}`,
          data: {
            action: "admin_rental_request",
            rentalId: createdRental.id,
            productId: product.id,
            productTitle: product.title,
            renterId: req.user.id,
            ownerId: product.ownerId,
          },
        }),
      ]);

      return tx.rental.findUnique({
        where: { id: createdRental.id },
        select: RENTAL_DETAIL_SELECT,
      });
    });

    return res.status(201).json({
      success: true,
      message: "Rental request created successfully",
      data: rental,
    });
  } catch (error) {
    console.error("createRental error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create rental request",
    });
  }
}

async function approveRental(req, res) {
  const data = z.rentalIdParamSchema.safeParse(req.params);
  if (!data.success) {
    return res.status(400).json({
      success: false,
      message: data.error.issues[0].message,
    });
  }

  try {
    const rental = await db.rental.findUnique({
      where: { id: data.data.id },
      select: {
        id: true,
        productId: true,
        renterId: true,
        ownerId: true,
        startDate: true,
        endDate: true,
        status: true,
        product: {
          select: {
            id: true,
            title: true,
            status: true,
            isApproved: true,
          },
        },
      },
    });

    if (!rental) {
      return res.status(404).json({
        success: false,
        message: "Rental not found",
      });
    }

    if (!canManageRentalAsOwner(req.user, rental)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to approve this rental",
      });
    }

    if (rental.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: "Only pending rentals can be approved",
      });
    }

    if (rental.endDate <= new Date()) {
      return res.status(409).json({
        success: false,
        message: "This rental request has already expired",
      });
    }

    if (
      !rental.product.isApproved ||
      !ACTIVE_BOOKING_PRODUCT_STATUSES.includes(rental.product.status) ||
      UNAVAILABLE_PRODUCT_STATUSES.includes(rental.product.status)
    ) {
      return res.status(409).json({
        success: false,
        message: "This listing is not available for approval right now",
      });
    }

    const conflict = await findAvailabilityConflict(
      db,
      rental.productId,
      rental.startDate,
      rental.endDate,
      rental.id,
    );

    if (!conflict.isAvailable) {
      return res.status(409).json({
        success: false,
        message: "This rental can no longer be approved because the dates are unavailable",
        data: {
          overlappingRental: conflict.overlappingRental,
          calendarConflict: conflict.calendarConflict,
        },
      });
    }

    const updatedRental = await db.$transaction(async (tx) => {
      await tx.rental.update({
        where: { id: rental.id },
        data: {
          status: "approved",
        },
      });

      await createNotification(tx, {
        userId: rental.renterId,
        rentalId: rental.id,
        type: "rental_approved",
        title: "Rental request approved",
        message: `Your booking for ${rental.product.title} has been approved`,
        data: {
          productId: rental.productId,
          ownerId: rental.ownerId,
        },
      });

      return tx.rental.findUnique({
        where: { id: rental.id },
        select: RENTAL_DETAIL_SELECT,
      });
    });

    return res.status(200).json({
      success: true,
      message: "Rental approved successfully",
      data: updatedRental,
    });
  } catch (error) {
    console.error("approveRental error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to approve rental",
    });
  }
}

async function rejectRental(req, res) {
  const paramsData = z.rentalIdParamSchema.safeParse(req.params);
  if (!paramsData.success) {
    return res.status(400).json({
      success: false,
      message: paramsData.error.issues[0].message,
    });
  }

  const bodyData = z.rentalActionReasonSchema.safeParse(req.body ?? {});
  if (!bodyData.success) {
    return res.status(400).json({
      success: false,
      message: bodyData.error.issues[0].message,
    });
  }

  try {
    const rental = await db.rental.findUnique({
      where: { id: paramsData.data.id },
      select: {
        id: true,
        productId: true,
        renterId: true,
        ownerId: true,
        status: true,
        product: {
          select: {
            title: true,
          },
        },
      },
    });

    if (!rental) {
      return res.status(404).json({
        success: false,
        message: "Rental not found",
      });
    }

    if (!canManageRentalAsOwner(req.user, rental)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to reject this rental",
      });
    }

    if (rental.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: "Only pending rentals can be rejected",
      });
    }

    const updatedRental = await db.$transaction(async (tx) => {
      await tx.rental.update({
        where: { id: rental.id },
        data: {
          status: "rejected",
          ownerNotes: bodyData.data.reason,
        },
      });

      await createNotification(tx, {
        userId: rental.renterId,
        rentalId: rental.id,
        type: "rental_rejected",
        title: "Rental request rejected",
        message: `Your booking for ${rental.product.title} was rejected`,
        data: {
          productId: rental.productId,
          ownerId: rental.ownerId,
          reason: bodyData.data.reason ?? null,
        },
      });

      return tx.rental.findUnique({
        where: { id: rental.id },
        select: RENTAL_DETAIL_SELECT,
      });
    });

    return res.status(200).json({
      success: true,
      message: "Rental rejected successfully",
      data: updatedRental,
    });
  } catch (error) {
    console.error("rejectRental error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reject rental",
    });
  }
}

async function cancelRental(req, res) {
  const paramsData = z.rentalIdParamSchema.safeParse(req.params);
  if (!paramsData.success) {
    return res.status(400).json({
      success: false,
      message: paramsData.error.issues[0].message,
    });
  }

  const bodyData = z.rentalActionReasonSchema.safeParse(req.body ?? {});
  if (!bodyData.success) {
    return res.status(400).json({
      success: false,
      message: bodyData.error.issues[0].message,
    });
  }

  try {
    const rental = await db.rental.findUnique({
      where: { id: paramsData.data.id },
      select: {
        id: true,
        productId: true,
        renterId: true,
        ownerId: true,
        status: true,
        product: {
          select: {
            title: true,
          },
        },
      },
    });

    if (!rental) {
      return res.status(404).json({
        success: false,
        message: "Rental not found",
      });
    }

    if (!canCancelRental(req.user, rental)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to cancel this rental",
      });
    }

    if (!["pending", "approved"].includes(rental.status)) {
      return res.status(409).json({
        success: false,
        message: "Only pending or approved rentals can be cancelled",
      });
    }

    const updatedRental = await db.$transaction(async (tx) => {
      await tx.rental.update({
        where: { id: rental.id },
        data: {
          status: "cancelled",
          cancellationReason: bodyData.data.reason,
          cancelledBy: req.user.id,
        },
      });

      const notifications = [];
      const actorLabel = isAdmin(req.user) ? "An admin" : req.user.name;

      if (req.user.id !== rental.renterId || isAdmin(req.user)) {
        notifications.push(
          createNotification(tx, {
            userId: rental.renterId,
            rentalId: rental.id,
            type: "rental_cancelled",
            title: "Rental cancelled",
            message: `${actorLabel} cancelled the rental for ${rental.product.title}`,
            data: {
              productId: rental.productId,
              cancelledBy: req.user.id,
              reason: bodyData.data.reason ?? null,
            },
          }),
        );
      }

      if (req.user.id !== rental.ownerId || isAdmin(req.user)) {
        notifications.push(
          createNotification(tx, {
            userId: rental.ownerId,
            rentalId: rental.id,
            type: "rental_cancelled",
            title: "Rental cancelled",
            message: `${actorLabel} cancelled the rental for ${rental.product.title}`,
            data: {
              productId: rental.productId,
              cancelledBy: req.user.id,
              reason: bodyData.data.reason ?? null,
            },
          }),
        );
      }

      await Promise.all(notifications);

      return tx.rental.findUnique({
        where: { id: rental.id },
        select: RENTAL_DETAIL_SELECT,
      });
    });

    return res.status(200).json({
      success: true,
      message: "Rental cancelled successfully",
      data: updatedRental,
    });
  } catch (error) {
    console.error("cancelRental error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to cancel rental",
    });
  }
}

async function startRental(req, res) {
  const data = z.rentalIdParamSchema.safeParse(req.params);
  if (!data.success) {
    return res.status(400).json({
      success: false,
      message: data.error.issues[0].message,
    });
  }

  try {
    const rental = await db.rental.findUnique({
      where: { id: data.data.id },
      select: {
        id: true,
        productId: true,
        renterId: true,
        ownerId: true,
        startDate: true,
        endDate: true,
        status: true,
        product: {
          select: {
            title: true,
          },
        },
      },
    });

    if (!rental) {
      return res.status(404).json({
        success: false,
        message: "Rental not found",
      });
    }

    if (!canManageRentalAsOwner(req.user, rental)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to start this rental",
      });
    }

    if (rental.status !== "approved") {
      return res.status(409).json({
        success: false,
        message: "Only approved rentals can be started",
      });
    }

    if (new Date() < rental.startDate) {
      return res.status(409).json({
        success: false,
        message: "This rental cannot be started before its start date",
      });
    }

    if (new Date() > rental.endDate) {
      return res.status(409).json({
        success: false,
        message: "This rental can no longer be started because it has already ended",
      });
    }

    const updatedRental = await db.$transaction(async (tx) => {
      await Promise.all([
        tx.rental.update({
          where: { id: rental.id },
          data: {
            status: "active",
          },
        }),
        tx.product.update({
          where: { id: rental.productId },
          data: {
            status: "rented",
          },
        }),
      ]);

      await createNotification(tx, {
        userId: rental.renterId,
        rentalId: rental.id,
        type: "rental_started",
        title: "Rental started",
        message: `Your rental for ${rental.product.title} is now active`,
        data: {
          productId: rental.productId,
          ownerId: rental.ownerId,
          renterId: rental.renterId,
          startDate: rental.startDate.toISOString(),
          endDate: rental.endDate.toISOString(),
        },
      });

      return tx.rental.findUnique({
        where: { id: rental.id },
        select: RENTAL_DETAIL_SELECT,
      });
    });

    return res.status(200).json({
      success: true,
      message: "Rental marked as active successfully",
      data: updatedRental,
    });
  } catch (error) {
    console.error("startRental error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to start rental",
    });
  }
}

async function completeRental(req, res) {
  const data = z.rentalIdParamSchema.safeParse(req.params);
  if (!data.success) {
    return res.status(400).json({
      success: false,
      message: data.error.issues[0].message,
    });
  }

  try {
    const rental = await db.rental.findUnique({
      where: { id: data.data.id },
      select: {
        id: true,
        productId: true,
        renterId: true,
        ownerId: true,
        status: true,
        endDate: true,
        product: {
          select: {
            title: true,
            status: true,
          },
        },
      },
    });

    if (!rental) {
      return res.status(404).json({
        success: false,
        message: "Rental not found",
      });
    }

    if (!canManageRentalAsOwner(req.user, rental)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to complete this rental",
      });
    }

    if (rental.status !== "active") {
      return res.status(409).json({
        success: false,
        message: "Only active rentals can be completed",
      });
    }

    const actualReturnDate = new Date();

    const updatedRental = await db.$transaction(async (tx) => {
      await Promise.all([
        tx.rental.update({
          where: { id: rental.id },
          data: {
            status: "completed",
            actualReturnDate,
          },
        }),
        tx.product.update({
          where: { id: rental.productId },
          data: {
            totalRentals: {
              increment: 1,
            },
            ...(rental.product.status === "rented"
              ? { status: "available" }
              : {}),
          },
        }),
      ]);

      await createNotification(tx, {
        userId: rental.renterId,
        rentalId: rental.id,
        type: "rental_completed",
        title: "Rental completed",
        message: `Your rental for ${rental.product.title} has been marked as completed`,
        data: {
          productId: rental.productId,
          ownerId: rental.ownerId,
          renterId: rental.renterId,
          endDate: rental.endDate.toISOString(),
          actualReturnDate: actualReturnDate.toISOString(),
        },
      });

      await createNotification(tx, {
        userId: rental.ownerId,
        rentalId: rental.id,
        type: "rental_completed",
        title: "Rental completed",
        message: `You marked ${rental.product.title} as completed`,
        data: {
          productId: rental.productId,
          renterId: rental.renterId,
          endDate: rental.endDate.toISOString(),
          actualReturnDate: actualReturnDate.toISOString(),
        },
      });

      if (rental.product.status === "rented") {
        await createWishlistAvailabilityNotifications(tx, {
          productId: rental.productId,
          ownerId: rental.ownerId,
          productTitle: rental.product.title,
          data: {
            trigger: "rental_completed",
            rentalId: rental.id,
            actualReturnDate: actualReturnDate.toISOString(),
          },
        });
      }

      return tx.rental.findUnique({
        where: { id: rental.id },
        select: RENTAL_DETAIL_SELECT,
      });
    });

    return res.status(200).json({
      success: true,
      message: "Rental completed successfully",
      data: updatedRental,
    });
  } catch (error) {
    console.error("completeRental error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to complete rental",
    });
  }
}

async function checkRentalAvailability(req, res) {
  const paramsData = z.productAvailabilityParamSchema.safeParse(req.params);
  if (!paramsData.success) {
    return res.status(400).json({
      success: false,
      message: paramsData.error.issues[0].message,
    });
  }

  const queryData = z.availabilityQuerySchema.safeParse(req.query);
  if (!queryData.success) {
    return res.status(400).json({
      success: false,
      message: queryData.error.issues[0].message,
    });
  }

  try {
    const product = await db.product.findUnique({
      where: { id: paramsData.data.id },
      select: {
        id: true,
        title: true,
        status: true,
        isApproved: true,
        minRentalPeriod: true,
        maxRentalPeriod: true,
        pricePerHour: true,
        pricePerDay: true,
        pricePerWeek: true,
        pricePerMonth: true,
        securityDeposit: true,
      },
    });

    if (!product || !product.isApproved) {
      return res.status(404).json({
        success: false,
        message: "Listing not found",
      });
    }

    const payload = {
      ...queryData.data,
      quantity: queryData.data.quantity ?? 1,
    };
    if (payload.startDate <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Rental start date must be in the future",
      });
    }

    const acceptsRequests =
      ACTIVE_BOOKING_PRODUCT_STATUSES.includes(product.status) &&
      !UNAVAILABLE_PRODUCT_STATUSES.includes(product.status);

    const conflict = acceptsRequests
      ? await findAvailabilityConflict(
          db,
          product.id,
          payload.startDate,
          payload.endDate,
        )
      : {
          isAvailable: false,
          overlappingRental: null,
          calendarConflict: null,
        };

    let pricing = null;
    if (payload.rentalPeriodType) {
      const pricingResult = getRentalPricingPreview(product, payload);
      pricing = pricingResult.success
        ? pricingResult.data
        : {
            error: pricingResult.message,
          };
    }

    return res.status(200).json({
      success: true,
      data: {
        productId: product.id,
        isAvailable: acceptsRequests && conflict.isAvailable,
        range: {
          startDate: payload.startDate,
          endDate: payload.endDate,
        },
        pricing,
        notBookableReason: acceptsRequests
          ? null
          : "This listing is not accepting rental requests right now",
        overlappingRental: conflict.overlappingRental,
        calendarConflict: conflict.calendarConflict,
      },
    });
  } catch (error) {
    console.error("checkRentalAvailability error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to check rental availability",
    });
  }
}

export default {
  approveRental,
  cancelRental,
  checkRentalAvailability,
  completeRental,
  createRental,
  getMyBookings,
  getMyRequests,
  getRentalDetails,
  rejectRental,
  startRental,
};
