import db from "../database/db.js";
import z from "../utils/category.zod.js";

const CATEGORY_PARENT_SUMMARY_SELECT = {
  id: true,
  name: true,
  iconUrl: true,
  isActive: true,
};

const CATEGORY_LIST_SELECT = {
  id: true,
  name: true,
  description: true,
  iconUrl: true,
  parentId: true,
  sortOrder: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  parent: {
    select: CATEGORY_PARENT_SUMMARY_SELECT,
  },
  _count: {
    select: {
      children: true,
      products: true,
    },
  },
};

const CATEGORY_DETAIL_SELECT = {
  ...CATEGORY_LIST_SELECT,
  children: {
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      iconUrl: true,
      sortOrder: true,
      isActive: true,
    },
  },
};

function isAdmin(user) {
  return user?.role === "admin";
}

function buildCategoryData(payload) {
  const data = {};

  if (payload.name !== undefined) data.name = payload.name;
  if (payload.description !== undefined) data.description = payload.description;
  if (payload.iconUrl !== undefined) data.iconUrl = payload.iconUrl;
  if (payload.parentId !== undefined) data.parentId = payload.parentId;
  if (payload.sortOrder !== undefined) data.sortOrder = payload.sortOrder;
  if (payload.isActive !== undefined) data.isActive = payload.isActive;

  return data;
}

async function findCategoryParent(parentId) {
  if (!parentId) {
    return null;
  }

  return db.category.findUnique({
    where: { id: parentId },
    select: {
      id: true,
      parentId: true,
    },
  });
}

async function validateParentCategory(parentId, categoryId = null) {
  if (parentId === undefined) {
    return { success: true };
  }

  if (parentId === null) {
    return { success: true };
  }

  if (categoryId && parentId === categoryId) {
    return {
      success: false,
      status: 400,
      message: "A category cannot be its own parent",
    };
  }

  let currentCategory = await findCategoryParent(parentId);
  if (!currentCategory) {
    return {
      success: false,
      status: 404,
      message: "Parent category not found",
    };
  }

  while (currentCategory.parentId) {
    if (currentCategory.parentId === categoryId) {
      return {
        success: false,
        status: 400,
        message: "A category cannot be moved under one of its descendants",
      };
    }

    currentCategory = await findCategoryParent(currentCategory.parentId);
    if (!currentCategory) {
      break;
    }
  }

  return { success: true };
}

function handleCategoryWriteError(error, res, action) {
  if (error?.code === "P2002") {
    return res.status(409).json({
      success: false,
      message: "Category name already exists",
    });
  }

  console.error(`${action} error:`, error);
  return res.status(500).json({
    success: false,
    message: `Failed to ${action} category`,
  });
}

async function getCategories(req, res) {
  try {
    const categories = await db.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: CATEGORY_LIST_SELECT,
    });

    return res.status(200).json({
      success: true,
      data: {
        categories,
      },
    });
  } catch (error) {
    console.error("getCategories error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
    });
  }
}

async function getCategoryDetails(req, res) {
  const data = z.categoryIdParamSchema.safeParse(req.params);
  if (!data.success) {
    return res.status(400).json({
      success: false,
      message: data.error.issues[0].message,
    });
  }

  try {
    const category = await db.category.findUnique({
      where: { id: data.data.id },
      select: CATEGORY_DETAIL_SELECT,
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error("getCategoryDetails error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch category details",
    });
  }
}

async function createCategory(req, res) {
  if (!isAdmin(req.user)) {
    return res.status(403).json({
      success: false,
      message: "Only admins can create categories",
    });
  }

  const data = z.createCategorySchema.safeParse(req.body);
  if (!data.success) {
    return res.status(400).json({
      success: false,
      message: data.error.issues[0].message,
    });
  }

  try {
    const parentValidation = await validateParentCategory(data.data.parentId);
    if (!parentValidation.success) {
      return res.status(parentValidation.status).json({
        success: false,
        message: parentValidation.message,
      });
    }

    const category = await db.category.create({
      data: buildCategoryData(data.data),
      select: CATEGORY_DETAIL_SELECT,
    });

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category,
    });
  } catch (error) {
    return handleCategoryWriteError(error, res, "create");
  }
}

async function updateCategory(req, res) {
  if (!isAdmin(req.user)) {
    return res.status(403).json({
      success: false,
      message: "Only admins can update categories",
    });
  }

  const paramsData = z.categoryIdParamSchema.safeParse(req.params);
  if (!paramsData.success) {
    return res.status(400).json({
      success: false,
      message: paramsData.error.issues[0].message,
    });
  }

  const bodyData = z.updateCategorySchema.safeParse(req.body);
  if (!bodyData.success) {
    return res.status(400).json({
      success: false,
      message: bodyData.error.issues[0].message,
    });
  }

  const { id } = paramsData.data;
  const payload = bodyData.data;

  try {
    const existingCategory = await db.category.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const parentValidation = await validateParentCategory(payload.parentId, id);
    if (!parentValidation.success) {
      return res.status(parentValidation.status).json({
        success: false,
        message: parentValidation.message,
      });
    }

    const category = await db.category.update({
      where: { id },
      data: buildCategoryData(payload),
      select: CATEGORY_DETAIL_SELECT,
    });

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: category,
    });
  } catch (error) {
    return handleCategoryWriteError(error, res, "update");
  }
}

async function deleteCategory(req, res) {
  if (!isAdmin(req.user)) {
    return res.status(403).json({
      success: false,
      message: "Only admins can delete categories",
    });
  }

  const data = z.categoryIdParamSchema.safeParse(req.params);
  if (!data.success) {
    return res.status(400).json({
      success: false,
      message: data.error.issues[0].message,
    });
  }

  try {
    const category = await db.category.findUnique({
      where: { id: data.data.id },
      select: {
        id: true,
        _count: {
          select: {
            children: true,
            products: true,
          },
        },
      },
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    if (category._count.children > 0) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete a category that still has child categories",
      });
    }

    if (category._count.products > 0) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete a category that is still used by products",
      });
    }

    await db.category.delete({
      where: { id: data.data.id },
    });

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("deleteCategory error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete category",
    });
  }
}

export default {
  createCategory,
  deleteCategory,
  getCategories,
  getCategoryDetails,
  updateCategory,
};
