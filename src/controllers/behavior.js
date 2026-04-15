import db from "../database/db.js";
import z from "../utils/behavior.zod.js";

const BEHAVIOR_SELECT = {
  id: true,
  userId: true,
  productId: true,
  categoryId: true,
  actionType: true,
  searchQuery: true,
  sessionId: true,
  deviceInfo: true,
  metadata: true,
  createdAt: true,
};

async function trackBehavior(req, res) {
  const data = z.trackBehaviorSchema.safeParse(req.body);
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
    let product = null;
    if (data.data.productId) {
      product = await db.product.findUnique({
        where: { id: data.data.productId },
        select: {
          id: true,
          categoryId: true,
        },
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }
    }

    let category = null;
    if (data.data.categoryId) {
      category = await db.category.findUnique({
        where: { id: data.data.categoryId },
        select: {
          id: true,
        },
      });

      if (!category) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }
    }

    if (
      product &&
      data.data.categoryId !== undefined &&
      product.categoryId !== data.data.categoryId
    ) {
      return res.status(400).json({
        success: false,
        message: "Category id does not match the selected product",
      });
    }

    const resolvedCategoryId = data.data.categoryId ?? product?.categoryId;

    const behavior = await db.$transaction(async (tx) => {
      if (data.data.actionType === "view" && product) {
        await tx.product.update({
          where: { id: product.id },
          data: {
            viewCount: {
              increment: 1,
            },
          },
        });
      }

      return tx.userBehavior.create({
        data: {
          userId: req.user.id,
          productId: product?.id,
          categoryId: resolvedCategoryId,
          actionType: data.data.actionType,
          searchQuery: data.data.searchQuery,
          sessionId: data.data.sessionId,
          deviceInfo: data.data.deviceInfo,
          metadata: data.data.metadata,
        },
        select: BEHAVIOR_SELECT,
      });
    });

    return res.status(201).json({
      success: true,
      message: "Behavior tracked successfully",
      data: behavior,
    });
  } catch (error) {
    console.error("trackBehavior error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to track behavior",
    });
  }
}

export default {
  trackBehavior,
};
