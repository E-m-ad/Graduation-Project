import db from "../database/db.js";
import { createAdminNotifications } from "../utils/notification.helpers.js";
import z from "../utils/review.zod.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;
const PUBLIC_PRODUCT_STATUSES = ["available", "rented", "unavailable"];

const USER_SUMMARY_SELECT = {
  id: true,
  name: true,
  avatarUrl: true,
  isVerified: true,
};

const REVIEW_DETAIL_SELECT = {
  id: true,
  rentalId: true,
  reviewerId: true,
  productId: true,
  rating: true,
  comment: true,
  ownerReply: true,
  ownerReplyAt: true,
  isVisible: true,
  createdAt: true,
  updatedAt: true,
  reviewer: {
    select: USER_SUMMARY_SELECT,
  },
  product: {
    select: {
      id: true,
      title: true,
      ownerId: true,
      avgRating: true,
      totalReviews: true,
    },
  },
  rental: {
    select: {
      id: true,
      status: true,
      startDate: true,
      endDate: true,
      actualReturnDate: true,
    },
  },
};

const PRODUCT_REVIEW_LIST_SELECT = {
  id: true,
  rentalId: true,
  reviewerId: true,
  productId: true,
  rating: true,
  comment: true,
  ownerReply: true,
  ownerReplyAt: true,
  createdAt: true,
  updatedAt: true,
  reviewer: {
    select: USER_SUMMARY_SELECT,
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

function roundRating(value) {
  return Number(value.toFixed(2));
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

async function syncProductReviewStats(client, productId) {
  const aggregate = await client.review.aggregate({
    where: {
      productId,
      isVisible: true,
    },
    _avg: {
      rating: true,
    },
    _count: {
      id: true,
    },
  });

  return client.product.update({
    where: { id: productId },
    data: {
      avgRating: roundRating(Number(aggregate._avg.rating ?? 0)),
      totalReviews: aggregate._count.id,
    },
    select: {
      id: true,
      avgRating: true,
      totalReviews: true,
    },
  });
}

async function getProductReviews(req, res) {
  const paramsData = z.productReviewParamSchema.safeParse(req.params);
  if (!paramsData.success) {
    return res.status(400).json({
      success: false,
      message: paramsData.error.issues[0].message,
    });
  }

  const queryData = z.reviewListQuerySchema.safeParse(req.query);
  if (!queryData.success) {
    return res.status(400).json({
      success: false,
      message: queryData.error.issues[0].message,
    });
  }

  const page = queryData.data.page ?? DEFAULT_PAGE;
  const limit = Math.min(queryData.data.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const offset = (page - 1) * limit;

  try {
    const product = await db.product.findFirst({
      where: {
        id: paramsData.data.id,
        isApproved: true,
        status: {
          in: PUBLIC_PRODUCT_STATUSES,
        },
      },
      select: {
        id: true,
        title: true,
        avgRating: true,
        totalReviews: true,
      },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const where = {
      productId: product.id,
      isVisible: true,
    };

    const [reviews, totalItems] = await db.$transaction([
      db.review.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: [{ createdAt: "desc" }],
        select: PRODUCT_REVIEW_LIST_SELECT,
      }),
      db.review.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        product,
        reviews,
        pagination: buildPagination(page, limit, totalItems),
      },
    });
  } catch (error) {
    console.error("getProductReviews error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch product reviews",
    });
  }
}

async function createReview(req, res) {
  const data = z.createReviewSchema.safeParse(req.body);
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

  try {
    const rental = await db.rental.findUnique({
      where: { id: data.data.rentalId },
      select: {
        id: true,
        renterId: true,
        ownerId: true,
        status: true,
        productId: true,
        product: {
          select: {
            id: true,
            title: true,
            categoryId: true,
          },
        },
        review: {
          select: {
            id: true,
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

    if (rental.renterId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You can only review your own completed rentals",
      });
    }

    if (rental.ownerId === req.user.id) {
      return res.status(409).json({
        success: false,
        message: "You cannot review or rate your own product",
      });
    }

    if (rental.status !== "completed") {
      return res.status(409).json({
        success: false,
        message: "You can only review rentals that have been completed",
      });
    }

    if (rental.review) {
      return res.status(409).json({
        success: false,
        message: "A review already exists for this rental",
      });
    }

    const review = await db.$transaction(async (tx) => {
      const createdReview = await tx.review.create({
        data: {
          rentalId: rental.id,
          reviewerId: req.user.id,
          productId: rental.productId,
          rating: data.data.rating,
          comment: data.data.comment,
        },
        select: {
          id: true,
        },
      });

      await Promise.all([
        tx.userBehavior.create({
          data: {
            userId: req.user.id,
            productId: rental.productId,
            categoryId: rental.product.categoryId,
            actionType: "review",
            metadata: {
              reviewId: createdReview.id,
              rentalId: rental.id,
              rating: data.data.rating,
            },
          },
        }),
        createNotification(tx, {
          userId: rental.ownerId,
          rentalId: rental.id,
          type: "new_review",
          title: "New review received",
          message: `${req.user.name} reviewed ${rental.product.title}`,
          data: {
            reviewId: createdReview.id,
            productId: rental.productId,
            reviewerId: req.user.id,
          },
        }),
        createAdminNotifications(tx, {
          rentalId: rental.id,
          title: "New review submitted",
          message: `${req.user.name} reviewed ${rental.product.title}`,
          data: {
            action: "admin_new_review",
            reviewId: createdReview.id,
            rentalId: rental.id,
            productId: rental.productId,
            productTitle: rental.product.title,
            reviewerId: req.user.id,
            ownerId: rental.ownerId,
          },
        }),
        syncProductReviewStats(tx, rental.productId),
      ]);

      return tx.review.findUnique({
        where: { id: createdReview.id },
        select: REVIEW_DETAIL_SELECT,
      });
    });

    return res.status(201).json({
      success: true,
      message: "Review created successfully",
      data: review,
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "A review already exists for this rental",
      });
    }

    console.error("createReview error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create review",
    });
  }
}

async function updateOwnReview(req, res) {
  const paramsData = z.reviewIdParamSchema.safeParse(req.params);
  if (!paramsData.success) {
    return res.status(400).json({
      success: false,
      message: paramsData.error.issues[0].message,
    });
  }

  const bodyData = z.updateReviewSchema.safeParse(req.body);
  if (!bodyData.success) {
    return res.status(400).json({
      success: false,
      message: bodyData.error.issues[0].message,
      error: {
        path: bodyData.error.issues[0].path.join("."),
        message: bodyData.error.issues[0].message,
      },
    });
  }

  try {
    const review = await db.review.findUnique({
      where: { id: paramsData.data.id },
      select: {
        id: true,
        reviewerId: true,
        productId: true,
        product: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    if (review.reviewerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own review",
      });
    }

    if (review.product.ownerId === req.user.id) {
      return res.status(409).json({
        success: false,
        message: "You cannot review or rate your own product",
      });
    }

    const updateData = {};
    if (bodyData.data.rating !== undefined) updateData.rating = bodyData.data.rating;
    if (bodyData.data.comment !== undefined) updateData.comment = bodyData.data.comment;

    const updatedReview = await db.$transaction(async (tx) => {
      await tx.review.update({
        where: { id: review.id },
        data: updateData,
      });

      await syncProductReviewStats(tx, review.productId);

      return tx.review.findUnique({
        where: { id: review.id },
        select: REVIEW_DETAIL_SELECT,
      });
    });

    return res.status(200).json({
      success: true,
      message: "Review updated successfully",
      data: updatedReview,
    });
  } catch (error) {
    console.error("updateOwnReview error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update review",
    });
  }
}

async function replyToReview(req, res) {
  const paramsData = z.reviewIdParamSchema.safeParse(req.params);
  if (!paramsData.success) {
    return res.status(400).json({
      success: false,
      message: paramsData.error.issues[0].message,
    });
  }

  const bodyData = z.replyToReviewSchema.safeParse(req.body);
  if (!bodyData.success) {
    return res.status(400).json({
      success: false,
      message: bodyData.error.issues[0].message,
      error: {
        path: bodyData.error.issues[0].path.join("."),
        message: bodyData.error.issues[0].message,
      },
    });
  }

  try {
    const review = await db.review.findUnique({
      where: { id: paramsData.data.id },
      select: {
        id: true,
        rentalId: true,
        reviewerId: true,
        productId: true,
        product: {
          select: {
            ownerId: true,
            title: true,
          },
        },
      },
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    if (review.product.ownerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Only the product owner can reply to this review",
      });
    }

    const ownerReplyAt = new Date();

    const updatedReview = await db.$transaction(async (tx) => {
      await tx.review.update({
        where: { id: review.id },
        data: {
          ownerReply: bodyData.data.ownerReply,
          ownerReplyAt,
        },
      });

      await createNotification(tx, {
        userId: review.reviewerId,
        rentalId: review.rentalId,
        type: "review_reply",
        title: "Owner replied to your review",
        message: `The owner replied to your review for ${review.product.title}`,
        data: {
          reviewId: review.id,
          productId: review.productId,
          ownerId: req.user.id,
        },
      });

      return tx.review.findUnique({
        where: { id: review.id },
        select: REVIEW_DETAIL_SELECT,
      });
    });

    return res.status(200).json({
      success: true,
      message: "Reply added successfully",
      data: updatedReview,
    });
  } catch (error) {
    console.error("replyToReview error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reply to review",
    });
  }
}

async function deleteOwnReview(req, res) {
  const paramsData = z.reviewIdParamSchema.safeParse(req.params);
  if (!paramsData.success) {
    return res.status(400).json({
      success: false,
      message: paramsData.error.issues[0].message,
    });
  }

  try {
    const review = await db.review.findUnique({
      where: { id: paramsData.data.id },
      select: {
        id: true,
        reviewerId: true,
        productId: true,
      },
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    if (review.reviewerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own review",
      });
    }

    const deletedReview = await db.$transaction(async (tx) => {
      await tx.review.delete({
        where: { id: review.id },
      });

      const nextProduct = await syncProductReviewStats(tx, review.productId);

      return {
        id: review.id,
        product: nextProduct,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Review deleted successfully",
      data: deletedReview,
    });
  } catch (error) {
    console.error("deleteOwnReview error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete review",
    });
  }
}

export default {
  createReview,
  deleteOwnReview,
  getProductReviews,
  replyToReview,
  updateOwnReview,
};
