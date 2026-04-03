class ApiException implements Exception {
  ApiException({
    required this.message,
    this.statusCode,
    this.payload,
  });

  final String message;
  final int? statusCode;
  final Map<String, dynamic>? payload;

  @override
  String toString() {
    if (statusCode == null) {
      return 'ApiException: $message';
    }

    return 'ApiException($statusCode): $message';
  }
}
