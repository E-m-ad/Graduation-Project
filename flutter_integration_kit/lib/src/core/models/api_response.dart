class ApiResponse<T> {
  const ApiResponse({
    required this.success,
    this.message,
    this.data,
    this.error,
  });

  final bool success;
  final String? message;
  final T? data;
  final Map<String, dynamic>? error;

  factory ApiResponse.fromJson(
    Map<String, dynamic> json, {
    T Function(Object? raw)? parser,
  }) {
    final rawData = json['data'];

    return ApiResponse<T>(
      success: json['success'] == true,
      message: json['message'] as String?,
      data: parser == null ? rawData as T? : parser(rawData),
      error: json['error'] is Map<String, dynamic>
          ? json['error'] as Map<String, dynamic>
          : null,
    );
  }
}
