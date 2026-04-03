import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import db from "../database/db.js";
import { maxProductImageCount } from "../middlewares/product.upload.js";
import { createAdminNotifications } from "../utils/notification.helpers.js";
import z from "../utils/product.zod.js";

const PUBLIC_PRODUCT_STATUSES = ["available", "rented", "unavailable"];
const OWNER_ALLOWED_STATUS_UPDATES = ["available", "unavailable"];
const ADMIN_ALLOWED_STATUS_UPDATES = [
  "available",
  "unavailable",
  "under_review",
  "suspended",
];
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;
const uploadsRootDir = fileURLToPath(new URL("../../uploads", import.meta.url));
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
  createdAt: true,
  updatedAt: true,
  owner: {
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      role: true,
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
      sortOrder: true,
    },
  },
};

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

  if (payload.categoryId !== undefined) updateData.categoryId = payload.categoryId;
  if (payload.title !== undefined) updateData.title = payload.title;
  if (payload.description !== undefined) updateData.description = payload.description;
  if (payload.pricePerHour !== undefined) updateData.pricePerHour = payload.pricePerHour;
  if (payload.pricePerDay !== undefined) updateData.pricePerDay = payload.pricePerDay;
  if (payload.pricePerWeek !== undefined) updateData.pricePerWeek = payload.pricePerWeek;
  if (payload.pricePerMonth !== undefined) updateData.pricePerMonth = payload.pricePerMonth;
  if (payload.securityDeposit !== undefined) updateData.securityDeposit = payload.securityDeposit;
  if (payload.locationAddress !== undefined) updateData.locationAddress = payload.locationAddress;
  if (payload.city !== undefined) updateData.city = payload.city;
  if (payload.latitude !== undefined) updateData.latitude = payload.latitude;
  if (payload.longitude !== undefined) updateData.longitude = payload.longitude;
  if (payload.condition !== undefined) updateData.condition = payload.condition;
  if (payload.minRentalPeriod !== undefined) updateData.minRentalPeriod = payload.minRentalPeriod;
  if (payload.maxRentalPeriod !== undefined) updateData.maxRentalPeriod = payload.maxRentalPeriod;
  if (payload.termsConditions !== undefined) updateData.termsConditions = payload.termsConditions;
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
      in: PUBLIC_PRODUCT_STATUSES,
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
        isApproved: true,
        status: {
          in: PUBLIC_PRODUCT_STATUSES,
        },
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
        isFeatured: true,
        createdAt: true,
        updatedAt: true,
        owner: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            city: true,
            bio: true,
            isVerified: true,
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

    return res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error("getProductDetails error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch product details",
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
        message: "You are not allowed to update this listing status",
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

    const updatedProduct = await db.product.update({
      where: { id },
      data: { status },
      select: MANAGE_PRODUCT_SELECT,
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
  const allowedStatuses = [...PUBLIC_PRODUCT_STATUSES, "under_review", "suspended"];

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
  getMyListings,
  getProductDetails,
  getProducts,
  updateProduct,
  updateProductStatus,
  uploadProductImages,
};
