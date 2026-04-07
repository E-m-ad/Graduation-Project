import db from "../database/db.js";
import z from "../utils/wishlist.zod.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;
const PUBLIC_PRODUCT_STATUSES = ["available", "rented", "unavailable"];

const WISHLIST_PRODUCT_SELECT = {
  id: true,
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
  createdAt: true,
  owner: {
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      city: true,
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

const WISHLIST_SELECT = {
  id: true,
  userId: true,
  productId: true,
  createdAt: true,
  product: {
    select: WISHLIST_PRODUCT_SELECT,
  },
};

const WISHLIST_USER_SELECT = {
  id: true,
  name: true,
  avatarUrl: true,
  city: true,
  role: true,
  isVerified: true,
};

function createOwnerWishlistSelect(ownerId) {
  return {
    id: true,
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
      },
    },
    wishlists: {
      where: {
        userId: {
          not: ownerId,
        },
      },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        userId: true,
        productId: true,
        createdAt: true,
        user: {
          select: WISHLIST_USER_SELECT,
        },
      },
    },
    _count: {
      select: {
        wishlists: true,
      },
    },
  };
}

function buildSelfWishlistCleanupWhere(userId, productId) {
  return {
    userId,
    ...(productId ? { productId } : {}),
    product: {
      ownerId: userId,
    },
  };
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

async function getMyWishlist(req, res) {
  const data = z.wishlistListQuerySchema.safeParse(req.query);
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
    product: {
      ownerId: {
        not: req.user.id,
      },
      isApproved: true,
      status: {
        in: PUBLIC_PRODUCT_STATUSES,
      },
    },
  };

  try {
    const [, wishlists, totalItems] = await db.$transaction([
      db.wishlist.deleteMany({
        where: buildSelfWishlistCleanupWhere(req.user.id),
      }),
      db.wishlist.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: [{ createdAt: "desc" }],
        select: WISHLIST_SELECT,
      }),
      db.wishlist.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        wishlists,
        pagination: buildPagination(page, limit, totalItems),
      },
    });
  } catch (error) {
    console.error("getMyWishlist error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch your wishlist",
    });
  }
}

async function getWishlistInterest(req, res) {
  const data = z.wishlistListQuerySchema.safeParse(req.query);
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
    wishlists: {
      some: {
        userId: {
          not: req.user.id,
        },
      },
    },
  };

  try {
    const [, products, totalItems] = await db.$transaction([
      db.wishlist.deleteMany({
        where: buildSelfWishlistCleanupWhere(req.user.id),
      }),
      db.product.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        select: createOwnerWishlistSelect(req.user.id),
      }),
      db.product.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        products,
        pagination: buildPagination(page, limit, totalItems),
      },
    });
  } catch (error) {
    console.error("getWishlistInterest error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch wishlist interest for your listings",
    });
  }
}

async function addToWishlist(req, res) {
  const data = z.wishlistProductParamSchema.safeParse(req.params);
  if (!data.success) {
    return res.status(400).json({
      success: false,
      message: data.error.issues[0].message,
    });
  }

  try {
    const product = await db.product.findFirst({
      where: {
        id: data.data.productId,
        isApproved: true,
        status: {
          in: PUBLIC_PRODUCT_STATUSES,
        },
      },
      select: {
        id: true,
        ownerId: true,
        categoryId: true,
      },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (product.ownerId === req.user.id) {
      await db.wishlist.deleteMany({
        where: buildSelfWishlistCleanupWhere(req.user.id, product.id),
      });

      return res.status(409).json({
        success: false,
        message: "You cannot add your own product to the wishlist",
      });
    }

    const existingWishlist = await db.wishlist.findUnique({
      where: {
        userId_productId: {
          userId: req.user.id,
          productId: product.id,
        },
      },
      select: WISHLIST_SELECT,
    });

    if (existingWishlist) {
      return res.status(200).json({
        success: true,
        message: "Product is already in your wishlist",
        data: existingWishlist,
      });
    }

    const wishlist = await db.$transaction(async (tx) => {
      const createdWishlist = await tx.wishlist.create({
        data: {
          userId: req.user.id,
          productId: product.id,
        },
        select: {
          id: true,
        },
      });

      await tx.userBehavior.create({
        data: {
          userId: req.user.id,
          productId: product.id,
          categoryId: product.categoryId,
          actionType: "wishlist",
          metadata: {
            wishlistId: createdWishlist.id,
            productId: product.id,
          },
        },
      });

      return tx.wishlist.findUnique({
        where: { id: createdWishlist.id },
        select: WISHLIST_SELECT,
      });
    });

    return res.status(201).json({
      success: true,
      message: "Product added to wishlist successfully",
      data: wishlist,
    });
  } catch (error) {
    if (error?.code === "P2002") {
      const wishlist = await db.wishlist.findUnique({
        where: {
          userId_productId: {
            userId: req.user.id,
            productId: data.data.productId,
          },
        },
        select: WISHLIST_SELECT,
      });

      return res.status(200).json({
        success: true,
        message: "Product is already in your wishlist",
        data: wishlist,
      });
    }

    console.error("addToWishlist error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add product to wishlist",
    });
  }
}

async function notifyWishlistUser(req, res) {
  const paramsData = z.wishlistOwnerParamSchema.safeParse(req.params);
  if (!paramsData.success) {
    return res.status(400).json({
      success: false,
      message: paramsData.error.issues[0].message,
    });
  }

  const bodyData = z.wishlistNotifyBodySchema.safeParse(req.body ?? {});
  if (!bodyData.success) {
    return res.status(400).json({
      success: false,
      message: bodyData.error.issues[0].message,
    });
  }

  try {
    const wishlist = await db.wishlist.findUnique({
      where: { id: paramsData.data.wishlistId },
      select: {
        id: true,
        userId: true,
        user: {
          select: WISHLIST_USER_SELECT,
        },
        product: {
          select: {
            id: true,
            title: true,
            status: true,
            ownerId: true,
          },
        },
      },
    });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: "Wishlist item not found",
      });
    }

    if (wishlist.product.ownerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to notify this user",
      });
    }

    if (wishlist.userId === req.user.id) {
      await db.wishlist.delete({
        where: { id: wishlist.id },
      });

      return res.status(409).json({
        success: false,
        message: "Owners cannot notify themselves for their own listing",
      });
    }

    const defaultTitle =
      wishlist.product.status === "available"
        ? "Wishlist item available"
        : "Wishlist update";
    const defaultMessage =
      wishlist.product.status === "available"
        ? `${wishlist.product.title} is available again`
        : `${wishlist.product.title} has an update from the owner`;

    const notification = await db.notification.create({
      data: {
        userId: wishlist.userId,
        type: "system",
        title: bodyData.data.title ?? defaultTitle,
        message: bodyData.data.message ?? defaultMessage,
        data: {
          action: "wishlist_owner_notice",
          wishlistId: wishlist.id,
          productId: wishlist.product.id,
          productTitle: wishlist.product.title,
          productStatus: wishlist.product.status,
          ownerId: req.user.id,
        },
      },
      select: {
        id: true,
        title: true,
        message: true,
        createdAt: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: `Notification sent to ${wishlist.user?.name || "the user"}`,
      data: {
        wishlistId: wishlist.id,
        notification,
      },
    });
  } catch (error) {
    console.error("notifyWishlistUser error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to notify the wishlist user",
    });
  }
}

async function removeFromWishlist(req, res) {
  const data = z.wishlistProductParamSchema.safeParse(req.params);
  if (!data.success) {
    return res.status(400).json({
      success: false,
      message: data.error.issues[0].message,
    });
  }

  try {
    const wishlist = await db.wishlist.findUnique({
      where: {
        userId_productId: {
          userId: req.user.id,
          productId: data.data.productId,
        },
      },
      select: {
        id: true,
      },
    });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: "Product is not in your wishlist",
      });
    }

    await db.wishlist.delete({
      where: { id: wishlist.id },
    });

    return res.status(200).json({
      success: true,
      message: "Product removed from wishlist successfully",
    });
  } catch (error) {
    console.error("removeFromWishlist error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to remove product from wishlist",
    });
  }
}

async function removeWishlistInterest(req, res) {
  const data = z.wishlistOwnerParamSchema.safeParse(req.params);
  if (!data.success) {
    return res.status(400).json({
      success: false,
      message: data.error.issues[0].message,
    });
  }

  try {
    const wishlist = await db.wishlist.findUnique({
      where: { id: data.data.wishlistId },
      select: {
        id: true,
        user: {
          select: WISHLIST_USER_SELECT,
        },
        product: {
          select: {
            id: true,
            title: true,
            ownerId: true,
          },
        },
      },
    });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: "Wishlist item not found",
      });
    }

    if (wishlist.product.ownerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to remove this wishlist item",
      });
    }

    await db.wishlist.delete({
      where: { id: wishlist.id },
    });

    return res.status(200).json({
      success: true,
      message: `${
        wishlist.user?.name || "The user"
      } was removed from the wishlist alerts for ${wishlist.product.title}`,
      data: {
        id: wishlist.id,
        productId: wishlist.product.id,
      },
    });
  } catch (error) {
    console.error("removeWishlistInterest error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to remove the wishlist item",
    });
  }
}

export default {
  addToWishlist,
  getMyWishlist,
  getWishlistInterest,
  notifyWishlistUser,
  removeFromWishlist,
  removeWishlistInterest,
};
