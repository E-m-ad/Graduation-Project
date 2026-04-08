import db from "../database/db.js";
import z from "../utils/user.zod.js";
async function getPublicUserProfile(req, res) {
  const data = z.getPublicProfile.safeParse(req.params);
  if (!data.success) {
    return res
      .status(400)
      .json({ success: false, message: data.error.issues[0].message });
  }
  const { id } = data.data;
  try {
    const user = await db.user.findUnique({
      where: { id: id },
      select: {
        name: true,
        avatarUrl: true,
        city: true,
        bio: true,
        isVerified: true,
        isActive: true,
      },
    });
    if (!user || !user.isActive) {
      return res
        .status(404)
        .json({ success: false, message: "User not exist or not active" });
    }
    return res.status(200).json({ success: true, user });
  } catch (error) {
    {
      console.error("Error fetching user profile:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  }
}

async function getPublicUserProducts(req, res) {
  const data = z.getPublicProfile.safeParse(req.params);

  if (!data.success) {
    return res.status(400).json({
      success: false,
      message: data.error.issues[0].message,
    });
  }

  const { id } = data.data;

  try {
    const user = await db.user.findFirst({
      where: {
        id,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const products = await db.product.findMany({
      where: {
        ownerId: id,
        isApproved: true,
        status: {
          in: ["available", "rented", "unavailable"],
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
        city: true,
        status: true,
        condition: true,
        avgRating: true,
        totalReviews: true,
        totalRentals: true,
        viewCount: true,
        createdAt: true,
        images: {
          orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
          select: {
            id: true,
            imageUrl: true,
            thumbnailUrl: true,
            isPrimary: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            iconUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        user,
        products,
      },
    });
  } catch (error) {
    console.error("getPublicUserProducts error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

async function getUserProductReviews(req, res) {
  const data = z.getPublicProfile.safeParse(req.params);

  if (!data.success) {
    return res.status(400).json({
      success: false,
      message: data.error.issues[0].message,
    });
  }

  const { id } = data.data;

  try {
    const user = await db.user.findFirst({
      where: {
        id,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const reviews = await db.review.findMany({
      where: {
        isVisible: true,
        product: {
          ownerId: id,
          isApproved: true,
          status: {
            in: ["available", "rented", "unavailable"],
          },
        },
      },
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
        product: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        user,
        reviews,
      },
    });
  } catch (error) {
    console.error("getUserProductReviews error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

export default {
  getPublicUserProfile,
  getPublicUserProducts,
  getUserProductReviews,
};
