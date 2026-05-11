import {
  PASSWORDS,
  assert,
  createTestContext,
  extractResetLink,
  extractVerificationLink,
  expectStatus,
  verifyEmailToken,
  withTestServer,
  makeImageForm,
  db,
} from "./testing/test-harness.mjs";
import {
  createCategory,
  createDefaultActors,
  createProduct,
  createRentalWindow,
  uploadProductImages,
} from "./testing/scenario-helpers.mjs";

async function runAuthAndProfileTests(context, actors) {
  context.log("Running auth and profile integration checks");

  const invalidRegister = await actors.guest.request("POST", "/auth/register", {
    json: {
      name: "A",
      email: "not-an-email",
      password: "short",
      confirmPassword: "different",
    },
    useCookies: false,
    useAccessToken: false,
  });
  expectStatus(invalidRegister, 400, "Reject invalid register payload");

  const unverifiedEmail = `${context.runPrefix}-mailbox@example.com`;
  const registerUnverified = await actors.guest.request("POST", "/auth/register", {
    json: {
      name: `${context.runPrefix} Mailbox User`,
      email: unverifiedEmail,
      password: PASSWORDS.primary,
      confirmPassword: PASSWORDS.primary,
    },
    useCookies: false,
    useAccessToken: false,
  });
  expectStatus(registerUnverified, 201, "Register unverified mailbox user");

  if (context.emailVerificationEnabled) {
    const registrationEmail = await context.emailInbox.waitForMessage(
      (message) => message.envelope.to.includes(unverifiedEmail),
    );
    assert(
      registrationEmail,
      "Registering a new user should deliver a verification email to the mailbox",
      context.emailInbox.messages,
    );
    const registrationVerificationLink = extractVerificationLink(
      registrationEmail.raw,
    );
    assert(
      registrationVerificationLink,
      "The delivered verification email should contain a verification link",
      registrationEmail,
    );

    const blockedLoginResult = await actors.guest.request("POST", "/auth/login", {
      json: {
        email: unverifiedEmail,
        password: PASSWORDS.primary,
      },
      useCookies: false,
      useAccessToken: false,
    });
    expectStatus(blockedLoginResult, 403, "Block login for unverified user");
    assert(
      blockedLoginResult.body?.code === "EMAIL_NOT_VERIFIED",
      "Blocked login should return the email-verification error code",
      blockedLoginResult.body,
    );

    const resendVerificationResult = await actors.guest.request(
      "POST",
      "/auth/request-email-verification",
      {
        json: { email: unverifiedEmail },
        useCookies: false,
        useAccessToken: false,
      },
    );
    expectStatus(
      resendVerificationResult,
      200,
      "Resend verification email publicly",
    );

    const latestVerificationEmail = await context.emailInbox.waitForMessage(
      (message) =>
        message.envelope.to.includes(unverifiedEmail) &&
        context.emailInbox.messages.filter((entry) =>
          entry.envelope.to.includes(unverifiedEmail),
        ).length >= 3,
    );
    assert(
      latestVerificationEmail,
      "The resend flow should deliver another verification email",
      context.emailInbox.messages,
    );

    const allVerificationEmails = context.emailInbox.messages.filter((message) =>
      message.envelope.to.includes(unverifiedEmail),
    );
    const resendEmail = allVerificationEmails[allVerificationEmails.length - 1];
    const resendVerificationLink = extractVerificationLink(resendEmail.raw);
    assert(
      resendVerificationLink,
      "The resent verification email should include a verification link",
      resendEmail,
    );
    const verificationToken = new URL(resendVerificationLink).searchParams.get(
      "token",
    );
    assert(
      verificationToken,
      "The resent verification link should include a token",
      resendVerificationLink,
    );

    await verifyEmailToken(
      actors.guest,
      verificationToken,
      "Verify email from delivered mailbox link",
    );
  } else {
    const resendVerificationResult = await actors.guest.request(
      "POST",
      "/auth/request-email-verification",
      {
        json: { email: unverifiedEmail },
        useCookies: false,
        useAccessToken: false,
      },
    );
    expectStatus(
      resendVerificationResult,
      200,
      "Verification request should succeed while verification is paused",
    );
    assert(
      resendVerificationResult.body?.emailVerificationRequired === false,
      "Paused verification flow should declare that verification is not required",
      resendVerificationResult.body,
    );
  }

  const verifiedLoginResult = await actors.guest.request("POST", "/auth/login", {
    json: {
      email: unverifiedEmail,
      password: PASSWORDS.primary,
    },
    useCookies: false,
    useAccessToken: false,
  });
  expectStatus(verifiedLoginResult, 200, "Login after email verification");

  const refreshResult = await actors.authUser.request("POST", "/auth/refresh-token", {
    useAccessToken: false,
  });
  expectStatus(refreshResult, 200, "Refresh access token");
  assert(
    refreshResult.body?.accessToken,
    "Refresh token response must include an access token",
    refreshResult.body,
  );
  actors.authUser.setAccessToken(refreshResult.body.accessToken);

  const revokedCookieHeader = actors.authUser.getCookieHeader();
  const logoutResult = await actors.authUser.request("POST", "/auth/logout", {
    useAccessToken: false,
  });
  expectStatus(logoutResult, 200, "Logout");

  const revokedRefreshResult = await actors.authUser.request("POST", "/auth/refresh-token", {
    useAccessToken: false,
    useCookies: false,
    cookieHeader: revokedCookieHeader,
  });
  assert(
    [400, 401].includes(revokedRefreshResult.response.status),
    "Refresh with a revoked cookie should fail",
    revokedRefreshResult.body,
  );

  const reloginResult = await actors.authUser.request("POST", "/auth/login", {
    json: {
      email: actors.authEmail,
      password: PASSWORDS.primary,
    },
    useCookies: true,
    useAccessToken: false,
  });
  expectStatus(reloginResult, 200, "Login auth-user after logout");
  actors.authUser.setAccessToken(reloginResult.body?.accessToken);

  const meResult = await actors.authUser.request("GET", "/users/me");
  expectStatus(meResult, 200, "Get own profile");
  assert(
    meResult.body?.data?.isVerified === true,
    "Verified users should remain verified in their profile response",
    meResult.body,
  );

  const requestVerificationResult = await actors.authUser.request(
    "POST",
    "/auth/request-email-verification",
  );
  if (context.emailVerificationEnabled) {
    expectStatus(
      requestVerificationResult,
      409,
      "Verified user should not request another verification email",
    );
    assert(
      requestVerificationResult.body?.message === "Your email is already verified",
      "Verified users should be told their email is already verified",
      requestVerificationResult.body,
    );
  } else {
    expectStatus(
      requestVerificationResult,
      200,
      "Verification request should stay successful while verification is paused",
    );
    assert(
      requestVerificationResult.body?.emailVerificationRequired === false,
      "Paused verification flow should keep reporting that verification is not required",
      requestVerificationResult.body,
    );
  }

  const updateProfileResult = await actors.authUser.request("PUT", "/users/me", {
    json: {
      name: `${context.runPrefix} Profile Updated`,
      phone: "01012345678",
      city: "Nasr City Cairo",
      address: "123 Example Street, Cairo",
      bio: "QA user profile for integration coverage",
    },
  });
  expectStatus(updateProfileResult, 200, "Update profile");
  assert(
    updateProfileResult.body?.data?.name?.includes("Profile Updated"),
    "Profile update should persist the new name",
    updateProfileResult.body,
  );

  const changePasswordResult = await actors.authUser.request(
    "PUT",
    "/users/change-password",
    {
      json: {
        currentPassword: PASSWORDS.primary,
        newPassword: PASSWORDS.secondary,
        confirmNewPassword: PASSWORDS.secondary,
      },
    },
  );
  expectStatus(changePasswordResult, 200, "Change password");

  const oldPasswordLogin = await actors.guest.request("POST", "/auth/login", {
    json: {
      email: actors.authEmail,
      password: PASSWORDS.primary,
    },
    useCookies: false,
    useAccessToken: false,
  });
  expectStatus(oldPasswordLogin, 401, "Login with old password should fail");

  const newPasswordLogin = await actors.authUser.request("POST", "/auth/login", {
    json: {
      email: actors.authEmail,
      password: PASSWORDS.secondary,
    },
    useCookies: true,
    useAccessToken: false,
  });
  expectStatus(newPasswordLogin, 200, "Login with updated password");
  actors.authUser.setAccessToken(newPasswordLogin.body?.accessToken);

  const uploadAvatarResult = await actors.authUser.request("POST", "/users/upload-avatar", {
    form: makeImageForm("avatar", `${context.runPrefix}-avatar.png`),
  });
  expectStatus(uploadAvatarResult, 200, "Upload avatar");
  assert(
    uploadAvatarResult.body?.data?.avatarUrl,
    "Avatar upload should return an avatar URL",
    uploadAvatarResult.body,
  );

  const forgotPasswordResult = await actors.guest.request("POST", "/auth/forgot-password", {
    json: { email: actors.authEmail },
    useCookies: false,
    useAccessToken: false,
  });
  expectStatus(forgotPasswordResult, 200, "Forgot password");

  const resetPasswordEmail = await context.emailInbox.waitForMessage(
    (message) =>
      message.envelope.to.includes(actors.authEmail) &&
      Boolean(extractResetLink(message.raw)),
  );
  assert(
    resetPasswordEmail,
    "Forgot-password should deliver a reset email",
    context.emailInbox?.messages,
  );

  const resetLink = extractResetLink(resetPasswordEmail.raw);
  assert(
    resetLink,
    "The delivered reset email should contain a reset link",
    resetPasswordEmail,
  );
  const resetToken = new URL(resetLink).searchParams.get("token");
  assert(
    resetToken,
    "The delivered reset link should include a token",
    resetLink,
  );

  const resetPasswordResult = await actors.guest.request("POST", "/auth/reset-password", {
    json: {
      token: resetToken,
      password: PASSWORDS.reset,
      confirmPassword: PASSWORDS.reset,
    },
    useCookies: false,
    useAccessToken: false,
  });
  expectStatus(resetPasswordResult, 200, "Reset password");

  const resetPasswordLogin = await actors.authUser.request("POST", "/auth/login", {
    json: {
      email: actors.authEmail,
      password: PASSWORDS.reset,
    },
    useCookies: true,
    useAccessToken: false,
  });
  expectStatus(resetPasswordLogin, 200, "Login with reset password");
  actors.authUser.setAccessToken(resetPasswordLogin.body?.accessToken);

  return {
    authUserId: meResult.body?.data?.id,
  };
}

async function runCatalogAndModerationTests(context, actors) {
  context.log("Running catalog and moderation integration checks");

  const categoriesResult = await actors.guest.request("GET", "/categories", {
    useCookies: false,
    useAccessToken: false,
  });
  expectStatus(categoriesResult, 200, "List categories");
  assert(
    Array.isArray(categoriesResult.body?.data?.categories),
    "Categories endpoint should return a categories array",
    categoriesResult.body,
  );

  const usedCategory = await createCategory(
    actors.adminUser,
    {
      name: `${context.runPrefix} Used Category`,
      description: "Category used for product and rental integration tests",
      iconUrl: "https://example.com/icon-used.png",
      sortOrder: 1,
      isActive: true,
    },
    "Create used category",
  );

  const tempCategory = await createCategory(
    actors.adminUser,
    {
      name: `${context.runPrefix} Temp Category`,
      description: "Category that should be updated then deleted",
      iconUrl: "https://example.com/icon-temp.png",
      sortOrder: 2,
      isActive: true,
    },
    "Create temporary category",
  );

  const tempCategoryDetails = await actors.guest.request("GET", `/categories/${tempCategory.id}`, {
    useCookies: false,
    useAccessToken: false,
  });
  expectStatus(tempCategoryDetails, 200, "Get category details");

  const updateCategoryResult = await actors.adminUser.request("PUT", `/categories/${tempCategory.id}`, {
    json: {
      description: "Updated temporary category description for QA",
      sortOrder: 5,
    },
  });
  expectStatus(updateCategoryResult, 200, "Update category");

  const deleteTempCategory = await actors.adminUser.request(
    "DELETE",
    `/categories/${tempCategory.id}`,
  );
  expectStatus(deleteTempCategory, 200, "Delete temporary category");

  const flowProduct = await createProduct(
    actors.ownerUser,
    {
      categoryId: usedCategory.id,
      title: `${context.runPrefix} Flow Product`,
      description: "QA flow product for broad integration coverage",
      pricePerDay: 250,
      securityDeposit: 300,
      city: "Cairo",
      locationAddress: "45 QA Street, Cairo",
      condition: "excellent",
      minRentalPeriod: 1,
      maxRentalPeriod: 30,
      termsConditions: "Return the item in the same condition.",
      tags: ["qa", "camera", "integration"],
    },
    "Create flow product",
  );
  assert(
    flowProduct?.isApproved === true && flowProduct?.status === "available",
    "Created products should be published immediately",
    flowProduct,
  );

  const ownerRecord = await db.user.findUnique({
    where: { email: actors.ownerEmail },
    select: { id: true, role: true },
  });
  assert(
    ownerRecord?.role === "both",
    "Owner should be promoted to both after creating a listing",
    ownerRecord,
  );

  const myListingsResult = await actors.ownerUser.request("GET", "/products/my-listings");
  expectStatus(myListingsResult, 200, "Get my listings");
  assert(
    myListingsResult.body?.data?.products?.some((product) => product.id === flowProduct.id),
    "My listings should include the created product",
    myListingsResult.body,
  );

  const flowProductUpdate = await actors.ownerUser.request("PUT", `/products/${flowProduct.id}`, {
    json: {
      title: `${context.runPrefix} Flow Product Updated`,
      description:
        "Updated QA flow product description for the integration lifecycle",
      city: "New Cairo",
      pricePerDay: 275,
      tags: ["qa", "updated", "integration"],
    },
  });
  expectStatus(flowProductUpdate, 200, "Update flow product");

  const uploadedImages = await uploadProductImages(
    actors.ownerUser,
    flowProduct.id,
    [
      `${context.runPrefix}-product-1.png`,
      `${context.runPrefix}-product-2.png`,
    ],
    "Upload product images",
  );

  const deleteImageResult = await actors.ownerUser.request(
    "DELETE",
    `/products/${flowProduct.id}/images/${uploadedImages.images[0].id}`,
  );
  expectStatus(deleteImageResult, 200, "Delete product image");

  const rejectProduct = await createProduct(
    actors.ownerUser,
    {
      categoryId: usedCategory.id,
      title: `${context.runPrefix} Reject Product`,
      description: "QA product that will be rejected by admin moderation",
      pricePerDay: 150,
      securityDeposit: 100,
      city: "Giza",
      locationAddress: "55 Rejection Street, Giza",
      condition: "good",
      minRentalPeriod: 1,
      maxRentalPeriod: 10,
      tags: ["qa", "reject"],
    },
    "Create reject product",
  );

  const deleteProduct = await createProduct(
    actors.ownerUser,
    {
      categoryId: usedCategory.id,
      title: `${context.runPrefix} Delete Product`,
      description: "QA product that should be deleted after validation",
      pricePerDay: 95,
      securityDeposit: 50,
      city: "Giza",
      locationAddress: "21 Delete Street, Giza",
      condition: "good",
      minRentalPeriod: 1,
      maxRentalPeriod: 7,
      tags: ["qa", "delete"],
    },
    "Create delete product",
  );

  const adminUnlistResult = await actors.adminUser.request(
    "PUT",
    `/products/${flowProduct.id}/status`,
    {
      json: { status: "suspended" },
    },
  );
  expectStatus(adminUnlistResult, 200, "Admin deactivate published product");
  assert(
    adminUnlistResult.body?.data?.status === "suspended",
    "Admin deactivate should suspend the product",
    adminUnlistResult.body,
  );
  assert(
    adminUnlistResult.body?.data?.isApproved === true,
    "Admin deactivate should keep approval state so it can be reactivated",
    adminUnlistResult.body,
  );

  const unlistedPublicDetail = await actors.guest.request("GET", `/products/${flowProduct.id}`, {
    useCookies: false,
    useAccessToken: false,
  });
  expectStatus(unlistedPublicDetail, 404, "Deactivated product should be hidden publicly");

  const adminRelistResult = await actors.adminUser.request(
    "PUT",
    `/products/${flowProduct.id}/status`,
    {
      json: { status: "available" },
    },
  );
  expectStatus(adminRelistResult, 200, "Admin reactivate published product");
  assert(
    adminRelistResult.body?.data?.status === "available",
    "Admin reactivate should restore availability",
    adminRelistResult.body,
  );

  const adminRejectResult = await actors.adminUser.request(
    "PUT",
    `/admin/products/${rejectProduct.id}/reject`,
    {
      json: {
        reason: "QA rejection path verification",
      },
    },
  );
  expectStatus(adminRejectResult, 200, "Reject product");
  assert(
    adminRejectResult.body?.data?.status === "suspended",
    "Rejected product should be suspended",
    adminRejectResult.body,
  );
  assert(
    adminRejectResult.body?.data?.adminReviewNote === "QA rejection path verification",
    "Rejected product should store the admin review note",
    adminRejectResult.body,
  );

  const rejectedListingView = await actors.ownerUser.request(
    "GET",
    `/products/${rejectProduct.id}`,
  );
  expectStatus(rejectedListingView, 200, "Owner should be able to view rejected product");
  assert(
    rejectedListingView.body?.data?.adminReviewNote === "QA rejection path verification",
    "Owner view should expose the admin review note",
    rejectedListingView.body,
  );

  const ownerModerationReply = await actors.ownerUser.request(
    "POST",
    `/products/${rejectProduct.id}/moderation-reply`,
    {
      json: {
        reply: "Updated the listing details and fixed the requested issues.",
      },
    },
  );
  expectStatus(ownerModerationReply, 200, "Owner moderation reply");
  assert(
    ownerModerationReply.body?.data?.status === "under_review",
    "Owner moderation reply should return the listing to review",
    ownerModerationReply.body,
  );
  assert(
    ownerModerationReply.body?.data?.ownerReviewReply ===
      "Updated the listing details and fixed the requested issues.",
    "Owner moderation reply should be stored on the product",
    ownerModerationReply.body,
  );

  const ownerSetUnavailable = await actors.ownerUser.request(
    "PUT",
    `/products/${flowProduct.id}/status`,
    {
      json: { status: "unavailable" },
    },
  );
  expectStatus(ownerSetUnavailable, 200, "Set product unavailable");

  const ownerSetAvailable = await actors.ownerUser.request(
    "PUT",
    `/products/${flowProduct.id}/status`,
    {
      json: { status: "available" },
    },
  );
  expectStatus(ownerSetAvailable, 200, "Set product available");

  const publicProducts = await actors.guest.request("GET", "/products", {
    useCookies: false,
    useAccessToken: false,
  });
  expectStatus(publicProducts, 200, "List public products");
  assert(
    publicProducts.body?.data?.products?.some((product) => product.id === flowProduct.id),
    "Public products should include the published flow product",
    publicProducts.body,
  );

  const publicProductDetail = await actors.guest.request("GET", `/products/${flowProduct.id}`, {
    useCookies: false,
    useAccessToken: false,
  });
  expectStatus(publicProductDetail, 200, "Get public product detail");

  const rejectedPublicDetail = await actors.guest.request("GET", `/products/${rejectProduct.id}`, {
    useCookies: false,
    useAccessToken: false,
  });
  expectStatus(rejectedPublicDetail, 404, "Rejected product should be hidden publicly");

  const ownerPublicProfile = await actors.guest.request("GET", `/public/users/${ownerRecord.id}`, {
    useCookies: false,
    useAccessToken: false,
  });
  expectStatus(ownerPublicProfile, 200, "Get public owner profile");

  const ownerPublicProducts = await actors.guest.request(
    "GET",
    `/public/users/${ownerRecord.id}/products`,
    {
      useCookies: false,
      useAccessToken: false,
    },
  );
  expectStatus(ownerPublicProducts, 200, "Get public owner products");

  await db.wishlist.create({
    data: {
      userId: ownerRecord.id,
      productId: flowProduct.id,
    },
  });

  const ownerSelfWishlistAttempt = await actors.ownerUser.request(
    "POST",
    `/wishlists/${flowProduct.id}`,
  );
  expectStatus(ownerSelfWishlistAttempt, 409, "Owner cannot wishlist own product");

  const ownerSelfWishlistRow = await db.wishlist.findUnique({
    where: {
      userId_productId: {
        userId: ownerRecord.id,
        productId: flowProduct.id,
      },
    },
    select: {
      id: true,
    },
  });
  assert(
    !ownerSelfWishlistRow,
    "Self-wishlist rows should be removed when the owner tries to save their own product",
    ownerSelfWishlistRow,
  );

  const ownerWishlistAfterCleanup = await actors.ownerUser.request("GET", "/wishlists");
  expectStatus(ownerWishlistAfterCleanup, 200, "Owner wishlist after self cleanup");
  assert(
    !ownerWishlistAfterCleanup.body?.data?.wishlists?.some(
      (wishlist) => wishlist.productId === flowProduct.id,
    ),
    "Owner wishlist should not include the owner's own product",
    ownerWishlistAfterCleanup.body,
  );

  const ownerInterestAfterCleanup = await actors.ownerUser.request(
    "GET",
    "/wishlists/owner",
  );
  expectStatus(ownerInterestAfterCleanup, 200, "Owner interest after self cleanup");
  assert(
    !ownerInterestAfterCleanup.body?.data?.products?.some(
      (product) => product.id === flowProduct.id,
    ),
    "Owner interest should not include self-wishlist rows",
    ownerInterestAfterCleanup.body,
  );

  const ownerSelfRentalWindow = createRentalWindow(16, 18);
  const ownerSelfRentalAttempt = await actors.ownerUser.request("POST", "/rentals", {
    json: {
      productId: flowProduct.id,
      startDate: ownerSelfRentalWindow.startDate.toISOString(),
      endDate: ownerSelfRentalWindow.endDate.toISOString(),
      rentalPeriodType: "daily",
      quantity: 1,
      renterNotes: "Owner should not be able to rent own listing",
    },
  });
  expectStatus(ownerSelfRentalAttempt, 409, "Owner cannot rent own product");

  return {
    usedCategoryId: usedCategory.id,
    flowProductId: flowProduct.id,
    rejectProductId: rejectProduct.id,
    deleteProductId: deleteProduct.id,
    ownerId: ownerRecord.id,
  };
}

async function runTransactionalFeatureTests(context, actors, fixtures) {
  context.log("Running transactional feature integration checks");

  const availabilityWindow = createRentalWindow(10, 12);
  const availabilityResult = await actors.guest.request(
    "GET",
    `/rentals/${fixtures.flowProductId}/availability?startDate=${encodeURIComponent(
      availabilityWindow.startDate.toISOString(),
    )}&endDate=${encodeURIComponent(
      availabilityWindow.endDate.toISOString(),
    )}&rentalPeriodType=daily&quantity=1`,
    {
      useCookies: false,
      useAccessToken: false,
    },
  );
  expectStatus(availabilityResult, 200, "Check rental availability");
  assert(
    availabilityResult.body?.data?.isAvailable === true,
    "Published product should be available for the initial booking dates",
    availabilityResult.body,
  );

  const createRental1 = await actors.renterUser.request("POST", "/rentals", {
    json: {
      productId: fixtures.flowProductId,
      startDate: availabilityWindow.startDate.toISOString(),
      endDate: availabilityWindow.endDate.toISOString(),
      rentalPeriodType: "daily",
      quantity: 1,
      renterNotes: "QA rental request for approval/start/complete flow",
    },
  });
  expectStatus(createRental1, 201, "Create rental request");
  const rental1Id = createRental1.body?.data?.id;

  const duplicatePendingRentalAttempt = await actors.renterUser.request("POST", "/rentals", {
    json: {
      productId: fixtures.flowProductId,
      startDate: availabilityWindow.startDate.toISOString(),
      endDate: availabilityWindow.endDate.toISOString(),
      rentalPeriodType: "daily",
      quantity: 1,
      renterNotes: "Duplicate pending request should be rejected",
    },
  });
  expectStatus(
    duplicatePendingRentalAttempt,
    409,
    "Reject duplicate pending rental request",
  );
  assert(
    duplicatePendingRentalAttempt.body?.data?.rental?.id === rental1Id,
    "Duplicate pending rental response should point to the existing pending request",
    duplicatePendingRentalAttempt.body,
  );

  const myBookingsResult = await actors.renterUser.request("GET", "/rentals/my-bookings");
  expectStatus(myBookingsResult, 200, "Get my bookings");
  assert(
    myBookingsResult.body?.data?.rentals?.some((rental) => rental.id === rental1Id),
    "Bookings should include the created rental request",
    myBookingsResult.body,
  );

  const myRequestsResult = await actors.ownerUser.request("GET", "/rentals/my-requests");
  expectStatus(myRequestsResult, 200, "Get owner rental requests");
  assert(
    myRequestsResult.body?.data?.rentals?.some((rental) => rental.id === rental1Id),
    "Owner requests should include the created rental",
    myRequestsResult.body,
  );

  const rentalDetailOwner = await actors.ownerUser.request("GET", `/rentals/${rental1Id}`);
  expectStatus(rentalDetailOwner, 200, "Get rental details as owner");

  const approveRental1 = await actors.ownerUser.request("PUT", `/rentals/${rental1Id}/approve`);
  expectStatus(approveRental1, 200, "Approve rental");

  await db.rental.update({
    where: { id: rental1Id },
    data: {
      startDate: new Date(Date.now() - 2 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const startRental1 = await actors.ownerUser.request("PUT", `/rentals/${rental1Id}/start`);
  expectStatus(startRental1, 200, "Start rental");

  const completeRental1 = await actors.ownerUser.request("PUT", `/rentals/${rental1Id}/complete`);
  expectStatus(completeRental1, 200, "Complete rental");

  const rental1DetailRenter = await actors.renterUser.request("GET", `/rentals/${rental1Id}`);
  expectStatus(rental1DetailRenter, 200, "Get completed rental details");
  assert(
    rental1DetailRenter.body?.data?.status === "completed",
    "Completed rental should be returned with completed status",
    rental1DetailRenter.body,
  );

  const rejectWindow = createRentalWindow(20, 22);
  const createRental2 = await actors.renterUser.request("POST", "/rentals", {
    json: {
      productId: fixtures.flowProductId,
      startDate: rejectWindow.startDate.toISOString(),
      endDate: rejectWindow.endDate.toISOString(),
      rentalPeriodType: "daily",
      renterNotes: "QA rental request for rejection flow",
    },
  });
  expectStatus(createRental2, 201, "Create rental to reject");
  const rental2Id = createRental2.body?.data?.id;

  const rejectRental2 = await actors.ownerUser.request("PUT", `/rentals/${rental2Id}/reject`, {
    json: {
      reason: "QA rejection verification",
    },
  });
  expectStatus(rejectRental2, 200, "Reject rental");

  const cancelWindow = createRentalWindow(30, 32);
  const createRental3 = await actors.renterUser.request("POST", "/rentals", {
    json: {
      productId: fixtures.flowProductId,
      startDate: cancelWindow.startDate.toISOString(),
      endDate: cancelWindow.endDate.toISOString(),
      rentalPeriodType: "daily",
      renterNotes: "QA rental request for cancellation flow",
    },
  });
  expectStatus(createRental3, 201, "Create rental to cancel");
  const rental3Id = createRental3.body?.data?.id;

  const cancelRental3 = await actors.renterUser.request("PUT", `/rentals/${rental3Id}/cancel`, {
    json: {
      reason: "QA renter cancellation verification",
    },
  });
  expectStatus(cancelRental3, 200, "Cancel rental");

  const createReviewResult = await actors.renterUser.request("POST", "/reviews", {
    json: {
      rentalId: rental1Id,
      rating: 5,
      comment: "Great rental experience from the QA integration suite",
    },
  });
  expectStatus(createReviewResult, 201, "Create review");
  const reviewId = createReviewResult.body?.data?.id;

  const ownerNotificationsAfterReview = await actors.ownerUser.request(
    "GET",
    "/notifications?type=new_review",
  );
  expectStatus(ownerNotificationsAfterReview, 200, "Get owner new-review notifications");
  assert(
    ownerNotificationsAfterReview.body?.data?.notifications?.some(
      (notification) =>
        notification.type === "new_review" &&
        notification.data?.reviewId === reviewId &&
        notification.data?.productId === fixtures.flowProductId,
    ),
    "Owner notifications should include the new review with product context",
    ownerNotificationsAfterReview.body,
  );

  const productAfterReview = await actors.guest.request("GET", `/products/${fixtures.flowProductId}`, {
    useCookies: false,
    useAccessToken: false,
  });
  expectStatus(productAfterReview, 200, "Get product after review");
  assert(
    productAfterReview.body?.data?.totalReviews === 1,
    "Product totalReviews should increment after review creation",
    productAfterReview.body,
  );

  const productReviewsResult = await actors.guest.request(
    "GET",
    `/reviews/product/${fixtures.flowProductId}`,
    {
      useCookies: false,
      useAccessToken: false,
    },
  );
  expectStatus(productReviewsResult, 200, "Get product reviews");
  assert(
    productReviewsResult.body?.data?.reviews?.some((review) => review.id === reviewId),
    "Product reviews should include the new review",
    productReviewsResult.body,
  );

  const updateReviewResult = await actors.renterUser.request("PUT", `/reviews/${reviewId}`, {
    json: {
      rating: 4,
      comment: "Updated QA review after completing the integration flow",
    },
  });
  expectStatus(updateReviewResult, 200, "Update review");

  const replyReviewResult = await actors.ownerUser.request(
    "PUT",
    `/reviews/${reviewId}/reply`,
    {
      json: {
        ownerReply: "Thanks for the detailed QA feedback.",
      },
    },
  );
  expectStatus(replyReviewResult, 200, "Reply to review");

  const renterNotificationsAfterReviewReply = await actors.renterUser.request(
    "GET",
    "/notifications?type=review_reply",
  );
  expectStatus(
    renterNotificationsAfterReviewReply,
    200,
    "Get renter review-reply notifications",
  );
  assert(
    renterNotificationsAfterReviewReply.body?.data?.notifications?.some(
      (notification) =>
        notification.type === "review_reply" &&
        notification.data?.reviewId === reviewId &&
        notification.data?.productId === fixtures.flowProductId,
    ),
    "Renter notifications should include the owner reply with product context",
    renterNotificationsAfterReviewReply.body,
  );

  const renterRecord = await db.user.findUnique({
    where: {
      email: actors.renterEmail,
    },
    select: {
      id: true,
    },
  });
  assert(renterRecord?.id, "Renter record should exist for invalid self-review guard test");

  const ownerSelfReviewGuardRental = await db.rental.create({
    data: {
      productId: fixtures.flowProductId,
      renterId: renterRecord.id,
      ownerId: fixtures.ownerId,
      startDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      actualReturnDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
      rentalPeriodType: "daily",
      quantity: 1,
      unitPrice: 25,
      totalPrice: 25,
      securityDeposit: 0,
      platformFee: 0,
      status: "completed",
      renterNotes: "Synthetic invalid review guard verification",
    },
    select: {
      id: true,
    },
  });

  const invalidOwnerReview = await db.review.create({
    data: {
      rentalId: ownerSelfReviewGuardRental.id,
      reviewerId: fixtures.ownerId,
      productId: fixtures.flowProductId,
      rating: 2,
      comment: "Synthetic invalid owner review",
      isVisible: false,
    },
    select: {
      id: true,
    },
  });

  const ownerSelfReviewUpdateAttempt = await actors.ownerUser.request(
    "PUT",
    `/reviews/${invalidOwnerReview.id}`,
    {
      json: {
        rating: 1,
        comment: "Owners must not be able to rate their own listing",
      },
    },
  );
  expectStatus(ownerSelfReviewUpdateAttempt, 409, "Owner cannot rate own product");

  const ownerPublicReviews = await actors.guest.request(
    "GET",
    `/public/users/${fixtures.ownerId}/reviews`,
    {
      useCookies: false,
      useAccessToken: false,
    },
  );
  expectStatus(ownerPublicReviews, 200, "Get owner public reviews");
  assert(
    ownerPublicReviews.body?.data?.reviews?.some((review) => review.id === reviewId),
    "Owner public reviews should include the new review",
    ownerPublicReviews.body,
  );

  const addWishlistResult = await actors.renterUser.request(
    "POST",
    `/wishlists/${fixtures.flowProductId}`,
  );
  expectStatus(addWishlistResult, 201, "Add wishlist item");

  const getWishlistResult = await actors.renterUser.request("GET", "/wishlists");
  expectStatus(getWishlistResult, 200, "Get wishlist");
  assert(
    getWishlistResult.body?.data?.wishlists?.some(
      (wishlist) => wishlist.productId === fixtures.flowProductId,
    ),
    "Wishlist should include the published product",
    getWishlistResult.body,
  );

  const ownerWishlistInterest = await actors.ownerUser.request("GET", "/wishlists/owner");
  expectStatus(ownerWishlistInterest, 200, "Get owner wishlist interest");
  const ownerWishlistProduct = ownerWishlistInterest.body?.data?.products?.find(
    (product) => product.id === fixtures.flowProductId,
  );
  assert(
    ownerWishlistProduct,
    "Owner wishlist interest should include the saved product",
    ownerWishlistInterest.body,
  );
  const ownerWishlistEntry = ownerWishlistProduct?.wishlists?.[0];
  assert(
    ownerWishlistEntry?.id,
    "Owner wishlist interest should expose the saved user entry",
    ownerWishlistProduct,
  );

  const notifyWishlistUserResult = await actors.ownerUser.request(
    "POST",
    `/wishlists/owner/${ownerWishlistEntry.id}/notify`,
    {
      json: {
        message: "Your saved item is available and ready for rent again.",
      },
    },
  );
  expectStatus(notifyWishlistUserResult, 201, "Notify wishlist user");

  const renterNotificationsAfterOwnerNotice = await actors.renterUser.request(
    "GET",
    "/notifications",
  );
  expectStatus(
    renterNotificationsAfterOwnerNotice,
    200,
    "Get renter notifications after owner wishlist notice",
  );
  assert(
    renterNotificationsAfterOwnerNotice.body?.data?.notifications?.some(
      (notification) => notification.data?.action === "wishlist_owner_notice",
    ),
    "Renter notifications should include the owner wishlist notice",
    renterNotificationsAfterOwnerNotice.body,
  );

  const ownerSetUnavailableForWishlist = await actors.ownerUser.request(
    "PUT",
    `/products/${fixtures.flowProductId}/status`,
    {
      json: { status: "unavailable" },
    },
  );
  expectStatus(
    ownerSetUnavailableForWishlist,
    200,
    "Set wishlist product unavailable",
  );

  const ownerSetAvailableForWishlist = await actors.ownerUser.request(
    "PUT",
    `/products/${fixtures.flowProductId}/status`,
    {
      json: { status: "available" },
    },
  );
  expectStatus(
    ownerSetAvailableForWishlist,
    200,
    "Set wishlist product available after wishlist toggle",
  );

  const renterNotificationsAfterAvailability = await actors.renterUser.request(
    "GET",
    "/notifications",
  );
  expectStatus(
    renterNotificationsAfterAvailability,
    200,
    "Get renter notifications after wishlist availability update",
  );
  assert(
    renterNotificationsAfterAvailability.body?.data?.notifications?.some(
      (notification) => notification.data?.action === "wishlist_item_available",
    ),
    "Renter notifications should include the automatic wishlist availability alert",
    renterNotificationsAfterAvailability.body,
  );

  const ownerRemoveWishlistInterestResult = await actors.ownerUser.request(
    "DELETE",
    `/wishlists/owner/${ownerWishlistEntry.id}`,
  );
  expectStatus(
    ownerRemoveWishlistInterestResult,
    200,
    "Remove wishlist interest from owner side",
  );

  const reAddWishlistResult = await actors.renterUser.request(
    "POST",
    `/wishlists/${fixtures.flowProductId}`,
  );
  expectStatus(reAddWishlistResult, 201, "Re-add wishlist item after owner removal");

  const flowProductRecord = await db.product.findUnique({
    where: { id: fixtures.flowProductId },
    select: { categoryId: true, viewCount: true },
  });

  const searchBehavior = await actors.renterUser.request("POST", "/behavior/track", {
    json: {
      actionType: "search",
      searchQuery: "camera qa integration",
      sessionId: `${context.runPrefix}-session`,
      deviceInfo: "node-integration-suite",
    },
  });
  expectStatus(searchBehavior, 201, "Track search behavior");

  const viewBehavior = await actors.renterUser.request("POST", "/behavior/track", {
    json: {
      actionType: "view",
      productId: fixtures.flowProductId,
      categoryId: flowProductRecord.categoryId,
    },
  });
  expectStatus(viewBehavior, 201, "Track view behavior");

  const clickBehavior = await actors.renterUser.request("POST", "/behavior/track", {
    json: {
      actionType: "click_recommendation",
      productId: fixtures.flowProductId,
      categoryId: flowProductRecord.categoryId,
      metadata: {
        placement: "home_feed",
      },
    },
  });
  expectStatus(clickBehavior, 201, "Track recommendation click behavior");

  const updatedViewCount = await db.product.findUnique({
    where: { id: fixtures.flowProductId },
    select: { viewCount: true },
  });
  assert(
    updatedViewCount.viewCount === flowProductRecord.viewCount + 1,
    "View tracking should increment product viewCount",
    updatedViewCount,
  );

  const recommendationsResult = await actors.renterUser.request(
    "GET",
    "/recommendations?limit=5",
  );
  expectStatus(recommendationsResult, 200, "Get personalized recommendations");
  assert(
    Array.isArray(recommendationsResult.body?.data?.recommendations),
    "Recommendations response should contain an array",
    recommendationsResult.body,
  );

  const similarProductsResult = await actors.guest.request(
    "GET",
    `/recommendations/similar/${fixtures.flowProductId}?limit=5`,
    {
      useCookies: false,
      useAccessToken: false,
    },
  );
  expectStatus(similarProductsResult, 200, "Get similar products");

  const renterChatMessage = await actors.renterUser.request(
    "POST",
    `/rentals/${rental1Id}/messages`,
    {
      json: {
        message: "Hello owner, I would like to confirm the pickup details.",
      },
    },
  );
  expectStatus(renterChatMessage, 201, "Send renter chat message");

  const ownerRequestsWithUnreadChat = await actors.ownerUser.request(
    "GET",
    "/rentals/my-requests",
  );
  expectStatus(
    ownerRequestsWithUnreadChat,
    200,
    "Owner requests should include rental chat summary",
  );
  const ownerChatSummary = ownerRequestsWithUnreadChat.body?.data?.rentals?.find(
    (rental) => rental.id === rental1Id,
  )?.chat;
  assert(
    ownerChatSummary?.unreadCount === 1,
    "Owner rental list should show one unread chat message after the renter writes first",
    ownerRequestsWithUnreadChat.body,
  );
  assert(
    ownerChatSummary?.lastMessagePreview?.includes("pickup details"),
    "Owner rental list should include the last chat preview",
    ownerRequestsWithUnreadChat.body,
  );

  const ownerChatThread = await actors.ownerUser.request(
    "GET",
    `/rentals/${rental1Id}/messages`,
  );
  expectStatus(ownerChatThread, 200, "Owner should load rental chat messages");
  assert(
    ownerChatThread.body?.data?.chat?.unreadCount === 0,
    "Opening the owner chat thread should clear the owner's unread count",
    ownerChatThread.body,
  );
  assert(
    ownerChatThread.body?.data?.messages?.some(
      (message) =>
        message.message ===
        "Hello owner, I would like to confirm the pickup details.",
    ),
    "Owner chat thread should include the renter message",
    ownerChatThread.body,
  );

  const ownerChatReply = await actors.ownerUser.request(
    "POST",
    `/rentals/${rental1Id}/messages`,
    {
      json: {
        message: "Thanks, the item will be ready at the agreed start time.",
      },
    },
  );
  expectStatus(ownerChatReply, 201, "Send owner chat reply");

  const renterBookingsWithUnreadChat = await actors.renterUser.request(
    "GET",
    "/rentals/my-bookings",
  );
  expectStatus(
    renterBookingsWithUnreadChat,
    200,
    "Renter bookings should include rental chat summary",
  );
  const renterChatSummary =
    renterBookingsWithUnreadChat.body?.data?.rentals?.find(
      (rental) => rental.id === rental1Id,
    )?.chat;
  assert(
    renterChatSummary?.unreadCount === 1,
    "Renter bookings should show one unread chat message after the owner replies",
    renterBookingsWithUnreadChat.body,
  );
  assert(
    renterChatSummary?.lastMessagePreview?.includes("agreed start time"),
    "Renter bookings should surface the owner's latest chat preview",
    renterBookingsWithUnreadChat.body,
  );

  const renterChatThread = await actors.renterUser.request(
    "GET",
    `/rentals/${rental1Id}/messages`,
  );
  expectStatus(renterChatThread, 200, "Renter should load rental chat messages");
  assert(
    renterChatThread.body?.data?.chat?.unreadCount === 0,
    "Opening the renter chat thread should clear the renter's unread count",
    renterChatThread.body,
  );
  assert(
    renterChatThread.body?.data?.messages?.length >= 2,
    "Rental chat should contain both sent messages",
    renterChatThread.body,
  );

  const ownerNotifications = await actors.ownerUser.request("GET", "/notifications");
  expectStatus(ownerNotifications, 200, "Get owner notifications");
  const firstOwnerNotification = ownerNotifications.body?.data?.notifications?.[0];
  assert(firstOwnerNotification, "Owner should have at least one notification");

  const ownerUnreadCount = await actors.ownerUser.request("GET", "/notifications/unread-count");
  expectStatus(ownerUnreadCount, 200, "Get owner unread count");
  assert(
    ownerUnreadCount.body?.data?.unreadCount >= 1,
    "Owner unread count should be at least one before marking notifications read",
    ownerUnreadCount.body,
  );

  const markOneNotification = await actors.ownerUser.request(
    "PUT",
    `/notifications/${firstOwnerNotification.id}/read`,
  );
  expectStatus(markOneNotification, 200, "Mark notification as read");

  const markAllNotifications = await actors.ownerUser.request(
    "PUT",
    "/notifications/read-all",
  );
  expectStatus(markAllNotifications, 200, "Mark all notifications as read");

  const unreadAfterReadAll = await actors.ownerUser.request(
    "GET",
    "/notifications/unread-count",
  );
  expectStatus(unreadAfterReadAll, 200, "Unread count after read-all");
  assert(
    unreadAfterReadAll.body?.data?.unreadCount === 0,
    "Unread notification count should be zero after read-all",
    unreadAfterReadAll.body,
  );

  return {
    rental1Id,
    reviewId,
  };
}

async function runAdminGovernanceTests(context, actors, fixtures, flowState) {
  context.log("Running admin integration checks");

  const adminDashboard = await actors.adminUser.request("GET", "/admin/dashboard");
  expectStatus(adminDashboard, 200, "Admin dashboard");

  const adminUsers = await actors.adminUser.request("GET", "/admin/users");
  expectStatus(adminUsers, 200, "Admin list users");
  assert(
    adminUsers.body?.data?.users?.some((user) => user.email === actors.authEmail),
    "Admin users list should include the QA auth user",
    adminUsers.body,
  );

  const adminProducts = await actors.adminUser.request("GET", "/admin/products");
  expectStatus(adminProducts, 200, "Admin list products");
  assert(
    adminProducts.body?.data?.products?.some((product) => product.id === fixtures.rejectProductId),
    "Admin products list should include rejected products",
    adminProducts.body,
  );

  const adminRentals = await actors.adminUser.request("GET", "/admin/rentals");
  expectStatus(adminRentals, 200, "Admin list rentals");
  assert(
    adminRentals.body?.data?.rentals?.some((rental) => rental.id === flowState.rental1Id),
    "Admin rentals list should include integration rentals",
    adminRentals.body,
  );

  const adminReports = await actors.adminUser.request("GET", "/admin/reports");
  expectStatus(adminReports, 200, "Admin reports");

  const suspendAuthUser = await actors.adminUser.request(
    "PUT",
    `/admin/users/${flowState.authUserId}/status`,
    {
      json: {
        status: "suspended",
        reason: "QA suspension verification",
      },
    },
  );
  expectStatus(suspendAuthUser, 200, "Suspend user");

  const suspendedUserAccess = await actors.authUser.request("GET", "/users/me");
  expectStatus(suspendedUserAccess, 403, "Suspended user should be blocked");

  const reactivateAuthUser = await actors.adminUser.request(
    "PUT",
    `/admin/users/${flowState.authUserId}/status`,
    {
      json: {
        isActive: true,
        reason: "QA reactivation verification",
      },
    },
  );
  expectStatus(reactivateAuthUser, 200, "Reactivate user");

  const reloginResult = await actors.authUser.request("POST", "/auth/login", {
    json: {
      email: actors.authEmail,
      password: PASSWORDS.reset,
    },
    useCookies: true,
    useAccessToken: false,
  });
  expectStatus(reloginResult, 200, "Login reactivated user");
  actors.authUser.setAccessToken(reloginResult.body?.accessToken);

  const usedCategoryDeleteAttempt = await actors.adminUser.request(
    "DELETE",
    `/categories/${fixtures.usedCategoryId}`,
  );
  expectStatus(
    usedCategoryDeleteAttempt,
    409,
    "Deleting a used category should fail",
  );

  const deleteWishlistResult = await actors.renterUser.request(
    "DELETE",
    `/wishlists/${fixtures.flowProductId}`,
  );
  expectStatus(deleteWishlistResult, 200, "Remove wishlist item");

  const deleteReviewResult = await actors.renterUser.request(
    "DELETE",
    `/reviews/${flowState.reviewId}`,
  );
  expectStatus(deleteReviewResult, 200, "Delete review");

  const productAfterReviewDelete = await actors.guest.request(
    "GET",
    `/products/${fixtures.flowProductId}`,
    {
      useCookies: false,
      useAccessToken: false,
    },
  );
  expectStatus(productAfterReviewDelete, 200, "Get product after review delete");
  assert(
    productAfterReviewDelete.body?.data?.totalReviews === 0,
    "Deleting the review should recalculate totalReviews",
    productAfterReviewDelete.body,
  );

  const deleteProductResult = await actors.ownerUser.request(
    "DELETE",
    `/products/${fixtures.deleteProductId}`,
  );
  expectStatus(deleteProductResult, 200, "Delete product without rentals");
}

async function run() {
  const context = createTestContext("integration");

  await withTestServer(context, async (runtime) => {
    const actors = await createDefaultActors(runtime);
    const authState = await runAuthAndProfileTests(runtime, actors);
    const fixtures = await runCatalogAndModerationTests(runtime, actors);
    const transactionalState = await runTransactionalFeatureTests(
      runtime,
      actors,
      fixtures,
    );

    await runAdminGovernanceTests(runtime, actors, fixtures, {
      ...authState,
      ...transactionalState,
    });

    runtime.log("Integration suite completed successfully");
  });
}

let exitCode = 0;

try {
  await run();
} catch (error) {
  exitCode = 1;
  console.error("[integration] FAILURE");
  console.error(error);
} finally {
  await db.$disconnect();
}

process.exit(exitCode);
