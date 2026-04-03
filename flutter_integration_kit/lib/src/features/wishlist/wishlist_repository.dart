import '../../core/http/api_client.dart';
import '../../core/http/api_endpoints.dart';

class WishlistRepository {
  WishlistRepository({
    required ApiClient apiClient,
  }) : _apiClient = apiClient;

  final ApiClient _apiClient;

  Future<Map<String, dynamic>> getMyWishlist({
    int? page,
    int? limit,
  }) {
    return _apiClient.get(
      ApiEndpoints.wishlist,
      requiresAuth: true,
      queryParameters: {
        'page': page,
        'limit': limit,
      },
    );
  }

  Future<Map<String, dynamic>> addToWishlist(String productId) {
    return _apiClient.post(
      ApiEndpoints.wishlistProduct(productId),
      requiresAuth: true,
    );
  }

  Future<Map<String, dynamic>> removeFromWishlist(String productId) {
    return _apiClient.delete(
      ApiEndpoints.wishlistProduct(productId),
      requiresAuth: true,
    );
  }
}
