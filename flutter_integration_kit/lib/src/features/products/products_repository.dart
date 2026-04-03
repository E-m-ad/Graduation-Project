import 'package:dio/dio.dart';

import '../../core/http/api_client.dart';
import '../../core/http/api_endpoints.dart';

class ProductsRepository {
  ProductsRepository({
    required ApiClient apiClient,
  }) : _apiClient = apiClient;

  final ApiClient _apiClient;

  Future<Map<String, dynamic>> listProducts({
    int? page,
    int? limit,
    String? search,
    String? city,
    String? categoryId,
  }) {
    return _apiClient.get(
      ApiEndpoints.products,
      queryParameters: {
        'page': page,
        'limit': limit,
        'search': search,
        'city': city,
        'categoryId': categoryId,
      },
    );
  }

  Future<Map<String, dynamic>> listMyListings({
    int? page,
    int? limit,
    String? status,
  }) {
    return _apiClient.get(
      ApiEndpoints.productsMyListings,
      requiresAuth: true,
      queryParameters: {
        'page': page,
        'limit': limit,
        'status': status,
      },
    );
  }

  Future<Map<String, dynamic>> getProductById(String id) {
    return _apiClient.get(ApiEndpoints.productById(id));
  }

  Future<Map<String, dynamic>> createProduct({
    required String categoryId,
    required String title,
    required String description,
    double? pricePerHour,
    double? pricePerDay,
    double? pricePerWeek,
    double? pricePerMonth,
    double? securityDeposit,
    String? locationAddress,
    String? city,
    double? latitude,
    double? longitude,
    String? condition,
    int? minRentalPeriod,
    int? maxRentalPeriod,
    String? termsConditions,
    List<String>? tags,
  }) {
    return _apiClient.post(
      ApiEndpoints.products,
      requiresAuth: true,
      data: {
        'categoryId': categoryId,
        'title': title,
        'description': description,
        'pricePerHour': pricePerHour,
        'pricePerDay': pricePerDay,
        'pricePerWeek': pricePerWeek,
        'pricePerMonth': pricePerMonth,
        'securityDeposit': securityDeposit,
        'locationAddress': locationAddress,
        'city': city,
        'latitude': latitude,
        'longitude': longitude,
        'condition': condition,
        'minRentalPeriod': minRentalPeriod,
        'maxRentalPeriod': maxRentalPeriod,
        'termsConditions': termsConditions,
        'tags': tags,
      },
    );
  }

  Future<Map<String, dynamic>> updateProduct({
    required String id,
    String? categoryId,
    String? title,
    String? description,
    double? pricePerHour,
    double? pricePerDay,
    double? pricePerWeek,
    double? pricePerMonth,
    double? securityDeposit,
    String? locationAddress,
    String? city,
    double? latitude,
    double? longitude,
    String? condition,
    int? minRentalPeriod,
    int? maxRentalPeriod,
    String? termsConditions,
    List<String>? tags,
  }) {
    return _apiClient.put(
      ApiEndpoints.productById(id),
      requiresAuth: true,
      data: {
        'categoryId': categoryId,
        'title': title,
        'description': description,
        'pricePerHour': pricePerHour,
        'pricePerDay': pricePerDay,
        'pricePerWeek': pricePerWeek,
        'pricePerMonth': pricePerMonth,
        'securityDeposit': securityDeposit,
        'locationAddress': locationAddress,
        'city': city,
        'latitude': latitude,
        'longitude': longitude,
        'condition': condition,
        'minRentalPeriod': minRentalPeriod,
        'maxRentalPeriod': maxRentalPeriod,
        'termsConditions': termsConditions,
        'tags': tags,
      },
    );
  }

  Future<Map<String, dynamic>> updateProductStatus({
    required String id,
    required String status,
  }) {
    return _apiClient.put(
      ApiEndpoints.productStatus(id),
      requiresAuth: true,
      data: {
        'status': status,
      },
    );
  }

  Future<Map<String, dynamic>> uploadProductImages({
    required String productId,
    required List<String> filePaths,
  }) {
    final files = filePaths
        .map((filePath) => MultipartFile.fromFileSync(filePath))
        .toList();

    final formData = FormData.fromMap({
      'images': files,
    });

    return _apiClient.postFormData(
      ApiEndpoints.productImages(productId),
      data: formData,
      requiresAuth: true,
    );
  }

  Future<Map<String, dynamic>> deleteProductImage({
    required String productId,
    required String imageId,
  }) {
    return _apiClient.delete(
      ApiEndpoints.productImageById(productId, imageId),
      requiresAuth: true,
    );
  }

  Future<Map<String, dynamic>> deleteProduct(String id) {
    return _apiClient.delete(
      ApiEndpoints.productById(id),
      requiresAuth: true,
    );
  }
}
