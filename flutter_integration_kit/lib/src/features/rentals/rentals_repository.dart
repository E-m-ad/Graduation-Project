import '../../core/http/api_client.dart';
import '../../core/http/api_endpoints.dart';

class RentalsRepository {
  RentalsRepository({
    required ApiClient apiClient,
  }) : _apiClient = apiClient;

  final ApiClient _apiClient;

  Future<Map<String, dynamic>> createRental({
    required String productId,
    required DateTime startDate,
    required DateTime endDate,
    required String rentalPeriodType,
    int? quantity,
    String? renterNotes,
  }) {
    return _apiClient.post(
      ApiEndpoints.rentals,
      requiresAuth: true,
      data: {
        'productId': productId,
        'startDate': startDate.toIso8601String(),
        'endDate': endDate.toIso8601String(),
        'rentalPeriodType': rentalPeriodType,
        'quantity': quantity,
        'renterNotes': renterNotes,
      },
    );
  }

  Future<Map<String, dynamic>> getMyBookings({
    int? page,
    int? limit,
    String? status,
  }) {
    return _apiClient.get(
      ApiEndpoints.rentalsMyBookings,
      requiresAuth: true,
      queryParameters: {
        'page': page,
        'limit': limit,
        'status': status,
      },
    );
  }

  Future<Map<String, dynamic>> getMyRequests({
    int? page,
    int? limit,
    String? status,
  }) {
    return _apiClient.get(
      ApiEndpoints.rentalsMyRequests,
      requiresAuth: true,
      queryParameters: {
        'page': page,
        'limit': limit,
        'status': status,
      },
    );
  }

  Future<Map<String, dynamic>> getRentalById(String id) {
    return _apiClient.get(
      ApiEndpoints.rentalById(id),
      requiresAuth: true,
    );
  }

  Future<Map<String, dynamic>> approveRental(String id) {
    return _apiClient.put(
      ApiEndpoints.rentalApprove(id),
      requiresAuth: true,
    );
  }

  Future<Map<String, dynamic>> rejectRental({
    required String id,
    String? reason,
  }) {
    return _apiClient.put(
      ApiEndpoints.rentalReject(id),
      requiresAuth: true,
      data: {
        'reason': reason,
      },
    );
  }

  Future<Map<String, dynamic>> cancelRental({
    required String id,
    String? reason,
  }) {
    return _apiClient.put(
      ApiEndpoints.rentalCancel(id),
      requiresAuth: true,
      data: {
        'reason': reason,
      },
    );
  }

  Future<Map<String, dynamic>> startRental(String id) {
    return _apiClient.put(
      ApiEndpoints.rentalStart(id),
      requiresAuth: true,
    );
  }

  Future<Map<String, dynamic>> completeRental(String id) {
    return _apiClient.put(
      ApiEndpoints.rentalComplete(id),
      requiresAuth: true,
    );
  }

  Future<Map<String, dynamic>> checkAvailability({
    required String productId,
    required DateTime startDate,
    required DateTime endDate,
    String? rentalPeriodType,
    int? quantity,
  }) {
    return _apiClient.get(
      ApiEndpoints.rentalAvailability(productId),
      queryParameters: {
        'startDate': startDate.toIso8601String(),
        'endDate': endDate.toIso8601String(),
        'rentalPeriodType': rentalPeriodType,
        'quantity': quantity,
      },
    );
  }
}
