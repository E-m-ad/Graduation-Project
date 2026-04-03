import '../../core/http/api_client.dart';
import '../../core/http/api_endpoints.dart';

class CategoriesRepository {
  CategoriesRepository({
    required ApiClient apiClient,
  }) : _apiClient = apiClient;

  final ApiClient _apiClient;

  Future<Map<String, dynamic>> listCategories() {
    return _apiClient.get(ApiEndpoints.categories);
  }

  Future<Map<String, dynamic>> getCategoryById(String id) {
    return _apiClient.get(ApiEndpoints.categoryById(id));
  }

  Future<Map<String, dynamic>> createCategory({
    required String name,
    String? description,
    String? iconUrl,
    String? parentId,
    int? sortOrder,
    bool? isActive,
  }) {
    return _apiClient.post(
      ApiEndpoints.categories,
      requiresAuth: true,
      data: {
        'name': name,
        'description': description,
        'iconUrl': iconUrl,
        'parentId': parentId,
        'sortOrder': sortOrder,
        'isActive': isActive,
      },
    );
  }

  Future<Map<String, dynamic>> updateCategory({
    required String id,
    String? name,
    String? description,
    String? iconUrl,
    String? parentId,
    int? sortOrder,
    bool? isActive,
  }) {
    return _apiClient.put(
      ApiEndpoints.categoryById(id),
      requiresAuth: true,
      data: {
        'name': name,
        'description': description,
        'iconUrl': iconUrl,
        'parentId': parentId,
        'sortOrder': sortOrder,
        'isActive': isActive,
      },
    );
  }

  Future<Map<String, dynamic>> deleteCategory(String id) {
    return _apiClient.delete(
      ApiEndpoints.categoryById(id),
      requiresAuth: true,
    );
  }
}
