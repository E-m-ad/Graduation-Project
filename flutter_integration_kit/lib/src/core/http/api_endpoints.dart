class ApiEndpoints {
  static const docsOpenApi = '/docs/openapi.json';

  static const authRegister = '/auth/register';
  static const authLogin = '/auth/login';
  static const authRefreshToken = '/auth/refresh-token';
  static const authLogout = '/auth/logout';
  static const authForgotPassword = '/auth/forgot-password';
  static const authResetPassword = '/auth/reset-password';

  static const usersMe = '/users/me';
  static const usersChangePassword = '/users/change-password';
  static const usersUploadAvatar = '/users/upload-avatar';

  static String publicUser(String userId) => '/public/users/$userId';
  static String publicUserProducts(String userId) => '/public/users/$userId/products';
  static String publicUserReviews(String userId) => '/public/users/$userId/reviews';

  static const categories = '/categories';
  static String categoryById(String id) => '/categories/$id';

  static const products = '/products';
  static const productsMyListings = '/products/my-listings';
  static String productById(String id) => '/products/$id';
  static String productStatus(String id) => '/products/$id/status';
  static String productImages(String id) => '/products/$id/images';
  static String productImageById(String id, String imageId) =>
      '/products/$id/images/$imageId';

  static const rentals = '/rentals';
  static const rentalsMyBookings = '/rentals/my-bookings';
  static const rentalsMyRequests = '/rentals/my-requests';
  static String rentalById(String id) => '/rentals/$id';
  static String rentalApprove(String id) => '/rentals/$id/approve';
  static String rentalReject(String id) => '/rentals/$id/reject';
  static String rentalCancel(String id) => '/rentals/$id/cancel';
  static String rentalStart(String id) => '/rentals/$id/start';
  static String rentalComplete(String id) => '/rentals/$id/complete';
  static String rentalAvailability(String productId) =>
      '/rentals/$productId/availability';

  static const reviews = '/reviews';
  static String reviewsByProduct(String productId) => '/reviews/product/$productId';
  static String reviewById(String id) => '/reviews/$id';
  static String reviewReply(String id) => '/reviews/$id/reply';

  static const wishlist = '/wishlists';
  static String wishlistProduct(String productId) => '/wishlists/$productId';

  static const recommendations = '/recommendations';
  static String similarRecommendations(String productId) =>
      '/recommendations/similar/$productId';

  static const behaviorTrack = '/behavior/track';

  static const notifications = '/notifications';
  static const notificationsReadAll = '/notifications/read-all';
  static const notificationsUnreadCount = '/notifications/unread-count';
  static String notificationRead(String id) => '/notifications/$id/read';

  static const adminDashboard = '/admin/dashboard';
  static const adminUsers = '/admin/users';
  static String adminUserStatus(String id) => '/admin/users/$id/status';
  static const adminProducts = '/admin/products';
  static String adminProductApprove(String id) => '/admin/products/$id/approve';
  static String adminProductReject(String id) => '/admin/products/$id/reject';
  static const adminRentals = '/admin/rentals';
  static const adminReports = '/admin/reports';
}
