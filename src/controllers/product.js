import fs from "node:fs/promises";
import path from "node:path";
import db from "../database/db.js";
import { maxProductImageCount } from "../middlewares/product.upload.js";
import { getUploadsRootDir } from "../utils/runtime-config.js";
import {
  createAdminNotifications,
  createWishlistAvailabilityNotifications,
} from "../utils/notification.helpers.js";
import z from "../utils/product.zod.js";

const PUBLIC_DISCOVERY_PRODUCT_STATUSES = ["available", "rented"];
const APPROVED_PRODUCT_STATUSES = ["available", "rented", "unavailable"];
const OWNER_ALLOWED_STATUS_UPDATES = ["available", "unavailable"];
const OWNER_UNAVAILABLE_LOCK_RENTAL_STATUSES = [
  "approved",
  "active",
  "overdue",
];
const ADMIN_ALLOWED_STATUS_UPDATES = [
  "available",
  "unavailable",
  "under_review",
  "suspended",
];
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;
const CHAT_PREVIEW_MAX_LENGTH = 160;
const uploadsRootDir = getUploadsRootDir();
const MANAGE_PRODUCT_SELECT = {
  id: true,
  title: true,
  description: true,
  pricePerHour: true,
  pricePerDay: true,
  pricePerWeek: true,
  pricePerMonth: true,
  securityDeposit: true,
  locationAddress: true,
  city: true,
  latitude: true,
  longitude: true,
  status: true,
  condition: true,
  minRentalPeriod: true,
  maxRentalPeriod: true,
  termsConditions: true,
  tags: true,
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
      avatarUrl: true,
      role: true,
      city: true,
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
      sortOrder: true,
    },
  },
};
const PRODUCT_CHAT_USER_SELECT = {
  id: true,
  name: true,
  avatarUrl: true,
  role: true,
  city: true,
};

const PRODUCT_CHAT_PRODUCT_SELECT = {
  id: true,
  ownerId: true,
  title: true,
  status: true,
  isApproved: true,
  owner: {
    select: PRODUCT_CHAT_USER_SELECT,
  },
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
};

const PRODUCT_CONVERSATION_SELECT = {
  id: true,
  productId: true,
  ownerId: true,
  participantId: true,
  lastMessageSenderId: true,
  lastMessagePreview: true,
  lastMessageAt: true,
  ownerUnreadCount: true,
  participantUnreadCount: true,
  ownerLastReadAt: true,
  participantLastReadAt: true,
  createdAt: true,
  updatedAt: true,
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
  owner: {
    select: PRODUCT_CHAT_USER_SELECT,
  },
  participant: {
    select: PRODUCT_CHAT_USER_SELECT,
  },
};

const PRODUCT_CONVERSATION_MESSAGE_SELECT = {
  id: true,
  conversationId: true,
  senderId: true,
  message: true,
  createdAt: true,
  updatedAt: true,
  sender: {
    select: PRODUCT_CHAT_USER_SELECT,
  },
};

function buildProductVisibilityFilter(user) {
  const isAdmin = user?.role === "admin";
  const canViewOwnUnpublishedListings = Boolean(user?.id);

  return isAdmin
    ? {}
    : {
        OR: [
          {
            isApproved: true,
            status: {
              in: PUBLIC_DISCOVERY_PRODUCT_STATUSES,
            },
            owner: {
              is: {
                isActive: true,
              },
            },
          },
          ...(canViewOwnUnpublishedListings
            ? [
                {
                  ownerId: user.id,
                },
              ]
            : []),
        ],
      };
}

function canUseProductChat(user) {
  return Boolean(user && user.role !== "admin");
}

function canAccessProductConversation(user, conversation) {
  return (
    conversation?.ownerId === user?.id || conversation?.participantId === user?.id
  );
}

function truncateChatPreview(message, maxLength = CHAT_PREVIEW_MAX_LENGTH) {
  const normalizedMessage =
    typeof message === "string" ? message.trim() : "";

  if (normalizedMessage.length <= maxLength) {
    return normalizedMessage;
  }

  return `${normalizedMessage.slice(0, maxLength - 3)}...`;
}

function getProductConversationParticipantRole(userId, conversation) {
  if (!userId || !conversation) {
    return null;
  }

  if (conversation.ownerId === userId) {
    return "owner";
  }

  if (conversation.participantId === userId) {
    return "participant";
  }

  return null;
}

function getProductConversationCounterpart(conversation, userId) {
  const participantRole = getProductConversationParticipantRole(
    userId,
    conversation,
  );

  if (participantRole === "owner") {
    return conversation.participant ?? null;
  }

  if (participantRole === "participant") {
    return conversation.owner ?? null;
  }

  return null;
}

function buildProductConversationSummary(conversation, userId) {
  const participantRole = getProductConversationParticipantRole(
    userId,
    conversation,
  );
  const unreadCount =
    participantRole === "owner"
      ? Number(conversation?.ownerUnreadCount || 0)
      : participantRole === "participant"
        ? Number(conversation?.participantUnreadCount || 0)
        : 0;
  const lastReadAt =
    participantRole === "owner"
      ? conversation?.ownerLastReadAt ?? null
      : participantRole === "participant"
        ? conversation?.participantLastReadAt ?? null
        : null;
  const counterpart = getProductConversationCounterpart(conversation, userId);

  return {
    isAvailable: Boolean(participantRole),
    participantRole,
    counterpartId: counterpart?.id ?? null,
    counterpartName: counterpart?.name ?? null,
    counterpartAvatarUrl: counterpart?.avatarUrl ?? null,
    lastMessageSenderId: conversation?.lastMessageSenderId ?? null,
    lastMessagePreview: conversation?.lastMessagePreview ?? "",
    lastMessageAt: conversation?.lastMessageAt ?? null,
    lastReadAt,
    unreadCount,
    hasUnread: unreadCount > 0,
    hasMessages: Boolean(conversation?.lastMessageAt),
  };
}

function decorateProductConversation(conversation, userId) {
  if (!conversation) {
    return conversation;
  }

  return {
    ...conversation,
    chat: buildProductConversationSummary(conversation, userId),
  };
}

function buildEmptyProductConversation(product, user) {
  return {
    id: null,
    productId: product.id,
    ownerId: product.ownerId,
    participantId: user.id,
    lastMessageSenderId: null,
    lastMessagePreview: "",
    lastMessageAt: null,
    ownerUnreadCount: 0,
    participantUnreadCount: 0,
    ownerLastReadAt: null,
    participantLastReadAt: null,
    createdAt: null,
    updatedAt: null,
    product: {
      id: product.id,
      title: product.title,
      images: product.images || [],
    },
    owner: product.owner,
    participant: {
      id: user.id,
      name: user.name || "You",
      avatarUrl: user.avatarUrl || null,
      role: user.role || "renter",
      city: user.city || null,
    },
  };
}

async function findChatProductForUser(productId, user, prismaClient = db) {
  return prismaClient.product.findFirst({
    where: {
      id: productId,
      ...buildProductVisibilityFilter(user),
    },
    select: PRODUCT_CHAT_PRODUCT_SELECT,
  });
}

async function ensureProductConversation(client, product, participantId) {
  return client.productConversation.upsert({
    where: {
      productId_participantId: {
        productId: product.id,
        participantId,
      },
    },
    create: {
      productId: product.id,
      ownerId: product.ownerId,
      participantId,
    },
    update: {},
    select: PRODUCT_CONVERSATION_SELECT,
  });
}

async function markProductConversationNotificationsAsRead(
  client,
  conversationId,
  userId,
  readAt,
) {
  return client.$executeRaw`
    UPDATE "Notification"
    SET "isRead" = TRUE,
        "readAt" = ${readAt}
    WHERE "userId" = ${userId}
      AND "isRead" = FALSE
      AND "type"::text = 'system'
      AND COALESCE("data"->>'action', '') = 'product_chat_message'
      AND COALESCE("data"->>'conversationId', '') = ${conversationId}
  `;
}

async function markProductConversationAsRead(
  client,
  conversation,
  userId,
  readAt = new Date(),
) {
  const participantRole = getProductConversationParticipantRole(
    userId,
    conversation,
  );

  if (!participantRole || !conversation?.id) {
    return conversation;
  }

  return client.productConversation.update({
    where: {
      id: conversation.id,
    },
    data:
      participantRole === "owner"
        ? {
            ownerUnreadCount: 0,
            ownerLastReadAt: readAt,
          }
        : {
            participantUnreadCount: 0,
            participantLastReadAt: readAt,
          },
    select: PRODUCT_CONVERSATION_SELECT,
  });
}

async function updateProductConversationAfterMessage(
  client,
  conversation,
  senderId,
  message,
  createdAt,
) {
  const senderRole = getProductConversationParticipantRole(
    senderId,
    conversation,
  );

  if (!senderRole) {
    return conversation;
  }

  const isOwnerMessage = senderRole === "owner";
  const preview = truncateChatPreview(message);

  return client.productConversation.update({
    where: {
      id: conversation.id,
    },
    data: {
      lastMessageSenderId: senderId,
      lastMessagePreview: preview,
      lastMessageAt: createdAt,
      ...(isOwnerMessage
        ? {
            ownerUnreadCount: 0,
            ownerLastReadAt: createdAt,
            participantUnreadCount: {
              increment: 1,
            },
          }
        : {
            participantUnreadCount: 0,
            participantLastReadAt: createdAt,
            ownerUnreadCount: {
              increment: 1,
            },
          }),
    },
    select: PRODUCT_CONVERSATION_SELECT,
  });
}

async function findOwnerUnavailableStatusLock(productId, prismaClient = db) {
  const activeRental = await prismaClient.rental.findFirst({
    where: {
      productId,
      status: {
        in: OWNER_UNAVAILABLE_LOCK_RENTAL_STATUSES,
      },
    },
    orderBy: [{ updatedAt: "desc" }, { endDate: "asc" }],
    select: {
      id: true,
      status: true,
      startDate: true,
      endDate: true,
      renterId: true,
      renter: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!activeRental) {
    return null;
  }

  return {
    reason: "open_rental_lock",
    rentalId: activeRental.id,
    rentalStatus: activeRental.status,
    renterId: activeRental.renterId,
    renterName: activeRental.renter?.name || null,
    startDate: activeRental.startDate,
    endDate: activeRental.endDate,
    message:
      "This listing cannot be updated while there is still an approved, active, or overdue rental that has not been cancelled or completed.",
  };
}

function buildCreateProductData(ownerId, payload) {
  const createData = {
    ownerId,
    categoryId: payload.categoryId,
    title: payload.title,
    description: payload.description,
  };

  if (payload.pricePerHour !== undefined)
    createData.pricePerHour = payload.pricePerHour;
  if (payload.pricePerDay !== undefined)
    createData.pricePerDay = payload.pricePerDay;
  if (payload.pricePerWeek !== undefined)
    createData.pricePerWeek = payload.pricePerWeek;
  if (payload.pricePerMonth !== undefined)
    createData.pricePerMonth = payload.pricePerMonth;
  if (payload.securityDeposit !== undefined)
    createData.securityDeposit = payload.securityDeposit;
  if (payload.locationAddress !== undefined)
    createData.locationAddress = payload.locationAddress;
  if (payload.city !== undefined) createData.city = payload.city;
  if (payload.latitude !== undefined) createData.latitude = payload.latitude;
  if (payload.longitude !== undefined) createData.longitude = payload.longitude;
  if (payload.condition !== undefined) createData.condition = payload.condition;
  if (payload.minRentalPeriod !== undefined)
    createData.minRentalPeriod = payload.minRentalPeriod;
  if (payload.maxRentalPeriod !== undefined)
    createData.maxRentalPeriod = payload.maxRentalPeriod;
  if (payload.termsConditions !== undefined)
    createData.termsConditions = payload.termsConditions;
  if (payload.tags !== undefined) createData.tags = payload.tags;

  return createData;
}

function buildUpdateProductData(payload) {
  const updateData = {};

  if (payload.categoryId !== undefined)
    updateData.categoryId = payload.categoryId;
  if (payload.title !== undefined) updateData.title = payload.title;
  if (payload.description !== undefined)
    updateData.description = payload.description;
  if (payload.pricePerHour !== undefined)
    updateData.pricePerHour = payload.pricePerHour;
  if (payload.pricePerDay !== undefined)
    updateData.pricePerDay = payload.pricePerDay;
  if (payload.pricePerWeek !== undefined)
    updateData.pricePerWeek = payload.pricePerWeek;
  if (payload.pricePerMonth !== undefined)
    updateData.pricePerMonth = payload.pricePerMonth;
  if (payload.securityDeposit !== undefined)
    updateData.securityDeposit = payload.securityDeposit;
  if (payload.locationAddress !== undefined)
    updateData.locationAddress = payload.locationAddress;
  if (payload.city !== undefined) updateData.city = payload.city;
  if (payload.latitude !== undefined) updateData.latitude = payload.latitude;
  if (payload.longitude !== undefined) updateData.longitude = payload.longitude;
  if (payload.condition !== undefined) updateData.condition = payload.condition;
  if (payload.minRentalPeriod !== undefined)
    updateData.minRentalPeriod = payload.minRentalPeriod;
  if (payload.maxRentalPeriod !== undefined)
    updateData.maxRentalPeriod = payload.maxRentalPeriod;
  if (payload.termsConditions !== undefined)
    updateData.termsConditions = payload.termsConditions;
  if (payload.tags !== undefined) updateData.tags = payload.tags;

  return updateData;
}

function canManageProduct(user, ownerId) {
  return user.role === "admin" || ownerId === user.id;
}

function buildProductImageUrl(filename) {
  return `/uploads/products/${filename}`;
}

function resolveUploadPath(uploadUrl) {
  if (!uploadUrl || !uploadUrl.startsWith("/uploads/")) {
    return null;
  }

  const relativePath = uploadUrl.replace("/uploads/", "");
  const resolvedPath = path.resolve(uploadsRootDir, relativePath);

  if (!resolvedPath.startsWith(uploadsRootDir)) {
    return null;
  }

  return resolvedPath;
}

async function removeStoredUpload(uploadUrl) {
  const filePath = resolveUploadPath(uploadUrl);
  if (!filePath) {
    return;
  }

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("removeStoredUpload error:", error);
    }
  }
}

async function cleanupUploadedFiles(files) {
  if (!Array.isArray(files) || files.length === 0) {
    return;
  }

  await Promise.all(
    files.map(async (file) => {
      try {
        await fs.unlink(file.path);
      } catch (error) {
        if (error.code !== "ENOENT") {
          console.error("cleanupUploadedFiles error:", error);
        }
      }
    }),
  );
}

async function getProducts(req, res) {
  const page = Number.parseInt(req.query.page, 10) || DEFAULT_PAGE;
  const requestedLimit = Number.parseInt(req.query.limit, 10) || DEFAULT_LIMIT;
  const limit = Math.min(requestedLimit, MAX_LIMIT);

  if (page < 1 || limit < 1) {
    return res.status(400).json({
      success: false,
      message: "page and limit must be positive numbers",
    });
  }

  const search = req.query.search?.trim();
  const city = req.query.city?.trim();
  const categoryId = req.query.categoryId?.trim();
  const offset = (page - 1) * limit;

  const where = {
    isApproved: true,
    status: {
      in: PUBLIC_DISCOVERY_PRODUCT_STATUSES,
    },
    owner: {
      is: {
        isActive: true,
      },
    },
  };

  if (search) {
    where.OR = [
      {
        title: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        description: {
          contains: search,
          mode: "insensitive",
        },
      },
    ];
  }

  if (city) {
    where.city = {
      contains: city,
      mode: "insensitive",
    };
  }

  if (categoryId) {
    where.categoryId = categoryId;
  }

  try {
    const [products, totalItems] = await db.$transaction([
      db.product.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
        select: {
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
        },
      }),
      db.product.count({ where }),
    ]);

    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);

    return res.status(200).json({
      success: true,
      data: {
        products,
        pagination: {
          page,
          limit,
          totalItems,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
        filters: {
          search: search ?? null,
          city: city ?? null,
          categoryId: categoryId ?? null,
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

async function getProductDetails(req, res) {
  const { id } = req.params;

  if (!id?.trim()) {
    return res.status(400).json({
      success: false,
      message: "Product id is required",
    });
  }

  try {
    const product = await db.product.findFirst({
      where: {
        id: id.trim(),
        ...buildProductVisibilityFilter(req.user),
      },
      select: {
        id: true,
        title: true,
        description: true,
        pricePerHour: true,
        pricePerDay: true,
        pricePerWeek: true,
        pricePerMonth: true,
        securityDeposit: true,
        locationAddress: true,
        city: true,
        latitude: true,
        longitude: true,
        status: true,
        condition: true,
        minRentalPeriod: true,
        maxRentalPeriod: true,
        termsConditions: true,
        tags: true,
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
            avatarUrl: true,
            city: true,
            bio: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            description: true,
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
        availability: {
          orderBy: [{ unavailableFrom: "asc" }],
          select: {
            id: true,
            unavailableFrom: true,
            unavailableTo: true,
            reason: true,
            notes: true,
          },
        },
        reviews: {
          where: {
            isVisible: true,
          },
          orderBy: [{ createdAt: "desc" }],
          select: {
            id: true,
            rating: true,
            comment: true,
            ownerReply: true,
            ownerReplyAt: true,
            createdAt: true,
            reviewer: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const isOwnerViewingProduct = Boolean(
      req.user?.role !== "admin" && req.user?.id === product.owner?.id,
    );
    const availabilityLock = isOwnerViewingProduct
      ? await findOwnerUnavailableStatusLock(product.id)
      : null;

    return res.status(200).json({
      success: true,
      data: {
        ...product,
        availabilityLock,
      },
    });
  } catch (error) {
    console.error("getProductDetails error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch product details",
    });
  }
}

async function getProductChat(req, res) {
  const paramsData = z.productIdParamSchema.safeParse(req.params);
  if (!paramsData.success) {
    return res.status(400).json({
      success: false,
      message: paramsData.error.issues[0].message,
    });
  }

  const queryData = z.productChatQuerySchema.safeParse(req.query);
  if (!queryData.success) {
    return res.status(400).json({
      success: false,
      message: queryData.error.issues[0].message,
    });
  }

  if (!canUseProductChat(req.user)) {
    return res.status(403).json({
      success: false,
      message: "Product chat is available only for signed-in owners and renters",
    });
  }

  try {
    const product = await findChatProductForUser(paramsData.data.id, req.user);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const requestedConversationId = queryData.data.conversationId || null;
    const isOwner = product.ownerId === req.user.id;
    let conversation = null;

    if (requestedConversationId) {
      conversation = await db.productConversation.findFirst({
        where: {
          id: requestedConversationId,
          productId: product.id,
        },
        select: PRODUCT_CONVERSATION_SELECT,
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: "Conversation not found",
        });
      }

      if (!canAccessProductConversation(req.user, conversation)) {
        return res.status(403).json({
          success: false,
          message: "You are not allowed to view this conversation",
        });
      }
    } else if (!isOwner) {
      conversation = await db.productConversation.findUnique({
        where: {
          productId_participantId: {
            productId: product.id,
            participantId: req.user.id,
          },
        },
        select: PRODUCT_CONVERSATION_SELECT,
      });
    } else {
      return res.status(400).json({
        success: false,
        message:
          "A conversation id is required to open a listing chat from the owner side",
      });
    }

    if (!conversation) {
      const emptyConversation = decorateProductConversation(
        buildEmptyProductConversation(product, req.user),
        req.user.id,
      );

      return res.status(200).json({
        success: true,
        data: {
          conversation: emptyConversation,
          messages: [],
          chat: emptyConversation.chat,
        },
      });
    }

    const readAt = new Date();
    const { messages, conversation: nextConversation } = await db.$transaction(
      async (tx) => {
        const nextMessages = await tx.productConversationMessage.findMany({
          where: {
            conversationId: conversation.id,
          },
          orderBy: [{ createdAt: "asc" }],
          select: PRODUCT_CONVERSATION_MESSAGE_SELECT,
        });
        const updatedConversation = await markProductConversationAsRead(
          tx,
          conversation,
          req.user.id,
          readAt,
        );

        await markProductConversationNotificationsAsRead(
          tx,
          conversation.id,
          req.user.id,
          readAt,
        );

        return {
          messages: nextMessages,
          conversation: updatedConversation,
        };
      },
    );

    const decoratedConversation = decorateProductConversation(
      nextConversation,
      req.user.id,
    );

    return res.status(200).json({
      success: true,
      data: {
        conversation: decoratedConversation,
        messages,
        chat: decoratedConversation.chat,
      },
    });
  } catch (error) {
    console.error("getProductChat error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch product chat",
    });
  }
}

async function sendProductChatMessage(req, res) {
  const paramsData = z.productIdParamSchema.safeParse(req.params);
  if (!paramsData.success) {
    return res.status(400).json({
      success: false,
      message: paramsData.error.issues[0].message,
    });
  }

  const bodyData = z.productChatMessageCreateSchema.safeParse(req.body);
  if (!bodyData.success) {
    return res.status(400).json({
      success: false,
      message: bodyData.error.issues[0].message,
    });
  }

  if (!canUseProductChat(req.user)) {
    return res.status(403).json({
      success: false,
      message: "Product chat is available only for signed-in owners and renters",
    });
  }

  try {
    const product = await findChatProductForUser(paramsData.data.id, req.user);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const isOwner = product.ownerId === req.user.id;
    const requestedConversationId = bodyData.data.conversationId || null;
    let conversation = null;

    if (requestedConversationId) {
      conversation = await db.productConversation.findFirst({
        where: {
          id: requestedConversationId,
          productId: product.id,
        },
        select: PRODUCT_CONVERSATION_SELECT,
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: "Conversation not found",
        });
      }

      if (!canAccessProductConversation(req.user, conversation)) {
        return res.status(403).json({
          success: false,
          message: "You are not allowed to send messages in this conversation",
        });
      }
    }

    if (isOwner && !conversation) {
      return res.status(400).json({
        success: false,
        message: "Choose a conversation before sending a message from this listing",
      });
    }

    const { message, conversation: nextConversation } = await db.$transaction(
      async (tx) => {
        const ensuredConversation =
          conversation ||
          (await ensureProductConversation(tx, product, req.user.id));
        const createdMessage = await tx.productConversationMessage.create({
          data: {
            conversationId: ensuredConversation.id,
            senderId: req.user.id,
            message: bodyData.data.message,
          },
          select: PRODUCT_CONVERSATION_MESSAGE_SELECT,
        });
        const updatedConversation = await updateProductConversationAfterMessage(
          tx,
          ensuredConversation,
          req.user.id,
          bodyData.data.message,
          createdMessage.createdAt,
        );
        const senderIsOwner = ensuredConversation.ownerId === req.user.id;
        const recipientId = senderIsOwner
          ? ensuredConversation.participantId
          : ensuredConversation.ownerId;
        const senderName =
          createdMessage.sender?.name ||
          (senderIsOwner ? product.owner?.name : req.user.name) ||
          "User";

        if (recipientId && recipientId !== req.user.id) {
          await tx.notification.create({
            data: {
              userId: recipientId,
              type: "system",
              title: `New message from ${senderName}`,
              message: `${product.title}: ${truncateChatPreview(
                bodyData.data.message,
              )}`,
              data: {
                action: "product_chat_message",
                productId: product.id,
                productTitle: product.title,
                conversationId: ensuredConversation.id,
                senderId: req.user.id,
                senderName,
              },
            },
          });
        }

        return {
          message: createdMessage,
          conversation: updatedConversation,
        };
      },
    );

    const decoratedConversation = decorateProductConversation(
      nextConversation,
      req.user.id,
    );

    return res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: {
        conversation: decoratedConversation,
        message,
        chat: decoratedConversation.chat,
      },
    });
  } catch (error) {
    console.error("sendProductChatMessage error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send product chat message",
    });
  }
}

async function createProduct(req, res) {
  const data = z.createProductSchema.safeParse(req.body);

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

  const payload = data.data;

  try {
    const category = await db.category.findFirst({
      where: {
        id: payload.categoryId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found or inactive",
      });
    }

    const createdProduct = await db.$transaction(async (tx) => {
      if (req.user.role === "renter") {
        await tx.user.update({
          where: { id: req.user.id },
          data: { role: "both" },
        });
      }

      const nextProduct = await tx.product.create({
        data: buildCreateProductData(req.user.id, payload),
        select: MANAGE_PRODUCT_SELECT,
      });

      await createAdminNotifications(tx, {
        title: "New listing submitted",
        message: `${req.user.name} submitted "${nextProduct.title}" for review`,
        data: {
          action: "product_submitted_for_review",
          productId: nextProduct.id,
          productTitle: nextProduct.title,
          ownerId: req.user.id,
          categoryId: nextProduct.category?.id ?? payload.categoryId,
        },
      });

      return nextProduct;
    });

    return res.status(201).json({
      success: true,
      message: "Listing created successfully and sent for review",
      data: createdProduct,
    });
  } catch (error) {
    console.error("createProduct error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create listing",
    });
  }
}

async function updateProduct(req, res) {
  const productId = req.params.id?.trim();
  if (!productId) {
    return res.status(400).json({
      success: false,
      message: "Product id is required",
    });
  }

  const data = z.updateProductSchema.safeParse(req.body);
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

  const payload = data.data;

  try {
    const existingProduct = await db.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        ownerId: true,
        pricePerHour: true,
        pricePerDay: true,
        pricePerWeek: true,
        pricePerMonth: true,
        minRentalPeriod: true,
        maxRentalPeriod: true,
      },
    });

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (req.user.role !== "admin" && existingProduct.ownerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to update this listing",
      });
    }

    if (payload.categoryId !== undefined) {
      const category = await db.category.findFirst({
        where: {
          id: payload.categoryId,
          isActive: true,
        },
        select: {
          id: true,
        },
      });

      if (!category) {
        return res.status(404).json({
          success: false,
          message: "Category not found or inactive",
        });
      }
    }

    const nextPricePerHour =
      payload.pricePerHour !== undefined
        ? payload.pricePerHour
        : existingProduct.pricePerHour;
    const nextPricePerDay =
      payload.pricePerDay !== undefined
        ? payload.pricePerDay
        : existingProduct.pricePerDay;
    const nextPricePerWeek =
      payload.pricePerWeek !== undefined
        ? payload.pricePerWeek
        : existingProduct.pricePerWeek;
    const nextPricePerMonth =
      payload.pricePerMonth !== undefined
        ? payload.pricePerMonth
        : existingProduct.pricePerMonth;

    if (
      nextPricePerHour == null &&
      nextPricePerDay == null &&
      nextPricePerWeek == null &&
      nextPricePerMonth == null
    ) {
      return res.status(400).json({
        success: false,
        message: "At least one rental price must remain on the listing",
      });
    }

    const nextMinRentalPeriod =
      payload.minRentalPeriod !== undefined
        ? payload.minRentalPeriod
        : existingProduct.minRentalPeriod;
    const nextMaxRentalPeriod =
      payload.maxRentalPeriod !== undefined
        ? payload.maxRentalPeriod
        : existingProduct.maxRentalPeriod;

    if (nextMinRentalPeriod > nextMaxRentalPeriod) {
      return res.status(400).json({
        success: false,
        message:
          "Minimum rental period cannot be greater than maximum rental period",
      });
    }

    const updatedProduct = await db.product.update({
      where: { id: productId },
      data: buildUpdateProductData(payload),
      select: MANAGE_PRODUCT_SELECT,
    });

    return res.status(200).json({
      success: true,
      message: "Listing updated successfully",
      data: updatedProduct,
    });
  } catch (error) {
    console.error("updateProduct error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update listing",
    });
  }
}

async function deleteProduct(req, res) {
  const data = z.productIdParamSchema.safeParse(req.params);
  if (!data.success) {
    return res.status(400).json({
      success: false,
      message: data.error.issues[0].message,
    });
  }

  const { id } = data.data;

  try {
    const product = await db.product.findUnique({
      where: { id },
      select: {
        id: true,
        ownerId: true,
        images: {
          select: {
            imageUrl: true,
            thumbnailUrl: true,
          },
        },
      },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (!canManageProduct(req.user, product.ownerId)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to delete this listing",
      });
    }

    if (req.user.role !== "admin") {
      const availabilityLock = await findOwnerUnavailableStatusLock(product.id);

      if (availabilityLock) {
        return res.status(409).json({
          success: false,
          message:
            "This listing cannot be deleted until the open rental is cancelled or completed.",
          data: {
            availabilityLock,
          },
        });
      }
    }

    const rentalsCount = await db.rental.count({
      where: { productId: id },
    });

    if (rentalsCount > 0) {
      return res.status(409).json({
        success: false,
        message: "This listing cannot be deleted because it has rental records",
      });
    }

    await db.product.delete({
      where: { id },
    });

    await Promise.all(
      product.images.flatMap((image) =>
        [image.imageUrl, image.thumbnailUrl]
          .filter(Boolean)
          .map((uploadUrl) => removeStoredUpload(uploadUrl)),
      ),
    );

    return res.status(200).json({
      success: true,
      message: "Listing deleted successfully",
    });
  } catch (error) {
    console.error("deleteProduct error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete listing",
    });
  }
}

async function updateProductStatus(req, res) {
  const paramsData = z.productIdParamSchema.safeParse(req.params);
  if (!paramsData.success) {
    return res.status(400).json({
      success: false,
      message: paramsData.error.issues[0].message,
    });
  }

  const bodyData = z.updateProductStatusSchema.safeParse(req.body);
  if (!bodyData.success) {
    return res.status(400).json({
      success: false,
      message: bodyData.error.issues[0].message,
    });
  }

  const { id } = paramsData.data;
  const { status } = bodyData.data;

  try {
    const product = await db.product.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        ownerId: true,
        isApproved: true,
        status: true,
      },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (!canManageProduct(req.user, product.ownerId)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to update this listing status",
      });
    }

    if (
      req.user.role !== "admin" &&
      (!product.isApproved ||
        !APPROVED_PRODUCT_STATUSES.includes(product.status))
    ) {
      return res.status(409).json({
        success: false,
        message: "Only approved live listings can change availability status",
      });
    }

    const allowedStatuses =
      req.user.role === "admin"
        ? ADMIN_ALLOWED_STATUS_UPDATES
        : OWNER_ALLOWED_STATUS_UPDATES;

    if (!allowedStatuses.includes(status)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to set this listing status",
      });
    }

    if (req.user.role !== "admin") {
      const availabilityLock = await findOwnerUnavailableStatusLock(product.id);

      if (availabilityLock) {
        return res.status(409).json({
          success: false,
          message:
            "This listing availability cannot be changed until the open rental is cancelled or completed.",
          data: {
            availabilityLock,
          },
        });
      }
    }

    const updatedProduct = await db.$transaction(async (tx) => {
      const nextProduct = await tx.product.update({
        where: { id },
        data: { status },
        select: MANAGE_PRODUCT_SELECT,
      });

      if (product.status !== "available" && status === "available") {
        await createWishlistAvailabilityNotifications(tx, {
          productId: product.id,
          ownerId: product.ownerId,
          productTitle: product.title,
          data: {
            trigger:
              req.user.role === "admin"
                ? "admin_status_update"
                : "owner_status_update",
          },
        });
      }

      return nextProduct;
    });

    return res.status(200).json({
      success: true,
      message: "Listing status updated successfully",
      data: updatedProduct,
    });
  } catch (error) {
    console.error("updateProductStatus error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update listing status",
    });
  }
}

async function getMyListings(req, res) {
  const page = Number.parseInt(req.query.page, 10) || DEFAULT_PAGE;
  const requestedLimit = Number.parseInt(req.query.limit, 10) || DEFAULT_LIMIT;
  const limit = Math.min(requestedLimit, MAX_LIMIT);

  if (page < 1 || limit < 1) {
    return res.status(400).json({
      success: false,
      message: "page and limit must be positive numbers",
    });
  }

  const status = req.query.status?.trim();
  const allowedStatuses = [
    ...APPROVED_PRODUCT_STATUSES,
    "under_review",
    "suspended",
  ];

  if (status && !allowedStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Invalid listing status filter",
    });
  }

  const offset = (page - 1) * limit;
  const where = {
    ownerId: req.user.id,
  };

  if (status) {
    where.status = status;
  }

  try {
    const [products, totalItems] = await db.$transaction([
      db.product.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
        select: MANAGE_PRODUCT_SELECT,
      }),
      db.product.count({ where }),
    ]);

    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);

    return res.status(200).json({
      success: true,
      data: {
        products,
        pagination: {
          page,
          limit,
          totalItems,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
        filters: {
          status: status ?? null,
        },
      },
    });
  } catch (error) {
    console.error("getMyListings error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch your listings",
    });
  }
}

async function replyToModeration(req, res) {
  const paramsData = z.productIdParamSchema.safeParse(req.params);
  if (!paramsData.success) {
    return res.status(400).json({
      success: false,
      message: paramsData.error.issues[0].message,
    });
  }

  const bodyData = z.moderationReplySchema.safeParse(req.body);
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
    const product = await db.product.findUnique({
      where: { id: paramsData.data.id },
      select: {
        id: true,
        ownerId: true,
        title: true,
        status: true,
        isApproved: true,
        adminReviewNote: true,
      },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (product.ownerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to reply for this listing",
      });
    }

    if (
      product.isApproved &&
      APPROVED_PRODUCT_STATUSES.includes(product.status)
    ) {
      return res.status(409).json({
        success: false,
        message: "This listing is already approved",
      });
    }

    if (!product.adminReviewNote) {
      return res.status(409).json({
        success: false,
        message: "There is no admin feedback to reply to yet",
      });
    }

    const updatedProduct = await db.$transaction(async (tx) => {
      const nextProduct = await tx.product.update({
        where: { id: product.id },
        data: {
          isApproved: false,
          status: "under_review",
          ownerReviewReply: bodyData.data.reply,
          ownerRepliedAt: new Date(),
        },
        select: MANAGE_PRODUCT_SELECT,
      });

      await createAdminNotifications(tx, {
        title: "Listing updated after feedback",
        message: `${req.user.name} replied to the review note for "${product.title}"`,
        data: {
          action: "owner_moderation_reply",
          productId: product.id,
          productTitle: product.title,
          ownerId: req.user.id,
          adminReviewNote: product.adminReviewNote,
          reply: bodyData.data.reply,
        },
      });

      return nextProduct;
    });

    return res.status(200).json({
      success: true,
      message: "Reply sent to the admin team and listing returned to review",
      data: updatedProduct,
    });
  } catch (error) {
    console.error("replyToModeration error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send your reply",
    });
  }
}

async function uploadProductImages(req, res) {
  const paramsData = z.productIdParamSchema.safeParse(req.params);
  if (!paramsData.success) {
    await cleanupUploadedFiles(req.files);
    return res.status(400).json({
      success: false,
      message: paramsData.error.issues[0].message,
    });
  }

  const files = Array.isArray(req.files) ? req.files : [];
  if (files.length === 0) {
    return res.status(400).json({
      success: false,
      message: "At least one image is required",
    });
  }

  const { id } = paramsData.data;

  try {
    const product = await db.product.findUnique({
      where: { id },
      select: {
        id: true,
        ownerId: true,
        images: {
          select: {
            id: true,
            isPrimary: true,
            sortOrder: true,
          },
        },
      },
    });

    if (!product) {
      await cleanupUploadedFiles(files);
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (!canManageProduct(req.user, product.ownerId)) {
      await cleanupUploadedFiles(files);
      return res.status(403).json({
        success: false,
        message: "You are not allowed to upload images for this listing",
      });
    }

    const totalImages = product.images.length + files.length;
    if (totalImages > maxProductImageCount) {
      await cleanupUploadedFiles(files);
      return res.status(400).json({
        success: false,
        message: `A listing can have up to ${maxProductImageCount} images`,
      });
    }

    const hasPrimary = product.images.some((image) => image.isPrimary);
    const maxSortOrder = product.images.reduce(
      (maxValue, image) => Math.max(maxValue, image.sortOrder),
      -1,
    );

    const createdImages = await db.$transaction(
      files.map((file, index) =>
        db.productImage.create({
          data: {
            productId: id,
            imageUrl: buildProductImageUrl(file.filename),
            isPrimary: !hasPrimary && index === 0,
            sortOrder: maxSortOrder + index + 1,
          },
          select: {
            id: true,
            imageUrl: true,
            thumbnailUrl: true,
            isPrimary: true,
            sortOrder: true,
            createdAt: true,
          },
        }),
      ),
    );

    return res.status(201).json({
      success: true,
      message: "Listing images uploaded successfully",
      data: {
        images: createdImages,
      },
    });
  } catch (error) {
    await cleanupUploadedFiles(files);
    console.error("uploadProductImages error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to upload listing images",
    });
  }
}

async function deleteProductImage(req, res) {
  const data = z.productImageParamSchema.safeParse(req.params);
  if (!data.success) {
    return res.status(400).json({
      success: false,
      message: data.error.issues[0].message,
    });
  }

  const { id, imgId } = data.data;

  try {
    const product = await db.product.findUnique({
      where: { id },
      select: {
        id: true,
        ownerId: true,
      },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (!canManageProduct(req.user, product.ownerId)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to delete images from this listing",
      });
    }

    const image = await db.productImage.findFirst({
      where: {
        id: imgId,
        productId: id,
      },
      select: {
        id: true,
        imageUrl: true,
        thumbnailUrl: true,
        isPrimary: true,
      },
    });

    if (!image) {
      return res.status(404).json({
        success: false,
        message: "Product image not found",
      });
    }

    await db.$transaction(async (tx) => {
      await tx.productImage.delete({
        where: { id: image.id },
      });

      if (image.isPrimary) {
        const replacementImage = await tx.productImage.findFirst({
          where: { productId: id },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: { id: true },
        });

        if (replacementImage) {
          await tx.productImage.update({
            where: { id: replacementImage.id },
            data: { isPrimary: true },
          });
        }
      }
    });

    await Promise.all([
      removeStoredUpload(image.imageUrl),
      removeStoredUpload(image.thumbnailUrl),
    ]);

    return res.status(200).json({
      success: true,
      message: "Listing image deleted successfully",
    });
  } catch (error) {
    console.error("deleteProductImage error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete listing image",
    });
  }
}

export default {
  createProduct,
  deleteProduct,
  deleteProductImage,
  getProductChat,
  getMyListings,
  getProductDetails,
  getProducts,
  replyToModeration,
  sendProductChatMessage,
  updateProduct,
  updateProductStatus,
  uploadProductImages,
};
