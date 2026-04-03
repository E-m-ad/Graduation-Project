class AppConfig {
  const AppConfig({
    required this.baseUrl,
    this.connectTimeout = const Duration(seconds: 20),
    this.receiveTimeout = const Duration(seconds: 20),
    this.sendTimeout = const Duration(seconds: 20),
    this.enableNetworkLogs = true,
  });

  final String baseUrl;
  final Duration connectTimeout;
  final Duration receiveTimeout;
  final Duration sendTimeout;
  final bool enableNetworkLogs;

  factory AppConfig.fromEnvironment() {
    const configuredBaseUrl = String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: 'http://10.0.2.2:3000/api/v1',
    );
    const enableLogs = bool.fromEnvironment(
      'ENABLE_NETWORK_LOGS',
      defaultValue: true,
    );

    return AppConfig(
      baseUrl: configuredBaseUrl,
      enableNetworkLogs: enableLogs,
    );
  }

  String get apiOrigin {
    final apiIndex = baseUrl.indexOf('/api/');
    if (apiIndex == -1) {
      return baseUrl;
    }

    return baseUrl.substring(0, apiIndex);
  }

  String resolveServerPath(String? rawPath) {
    if (rawPath == null || rawPath.isEmpty) {
      return '';
    }

    if (rawPath.startsWith('http://') || rawPath.startsWith('https://')) {
      return rawPath;
    }

    if (rawPath.startsWith('/')) {
      return '$apiOrigin$rawPath';
    }

    return '$apiOrigin/$rawPath';
  }
}
