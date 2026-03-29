import z from "../utils/user.zod.js";
import bcrypt from "bcrypt";
import db from "../database/db.js";

const userProfileSelect = {
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
};

async function getProfile(req, res) {
  try {
    const user = await db.user.findUnique({
      where: { id: req.user.id },
      select: userProfileSelect,
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
}

async function updateProfile(req, res) {
  const data = z.updateProfileSchema.safeParse(req.body);
  if (!data.success) {
    return res
      .status(400)
      .json({ success: false, message: data.error.issues[0].message });
  }
  const { name, phone, address, city, bio } = data.data;
  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (phone !== undefined) updateData.phone = phone;
  if (address !== undefined) updateData.address = address;
  if (city !== undefined) updateData.city = city;
  if (bio !== undefined) updateData.bio = bio;

  try {
    const user = await db.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: userProfileSelect,
    });
    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: user,
    });
  } catch (error) {
    console.error("updateProfile error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

async function changePassword(req, res) {
  const data = z.changePasswordSchema.safeParse(req.body);
  if (!data.success) {
    return res
      .status(400)
      .json({ success: false, message: data.error.issues[0].message });
  }
  const { currentPassword, newPassword } = data.data;
  try {
    const user = await db.user.findUnique({
      where: { id: req.user.id },
      select: { password: true },
    });
    if (!user) {
      return res.status(404).json({ success: false, message: "Unauthorized" });
    }
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ success: false, message: "Current password is incorrect" });
    }
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await db.$transaction([
      db.user.update({
        where: { id: req.user.id },
        data: { password: hashedNewPassword },
      }),
      db.refreshToken.updateMany({
        where: { userId: req.user.id },
        data: { isRevoked: true },
      }),
    ]);
    return res
      .status(200)
      .json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("changePassword error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
}

async function uploadAvatar(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Avatar image is required",
      });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const user = await db.user.update({
      where: { id: req.user.id },
      data: { avatarUrl },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Avatar updated successfully",
      data: user,
    });
  } catch (error) {
    console.error("uploadAvatar error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

export default { getProfile, updateProfile, changePassword, uploadAvatar };
