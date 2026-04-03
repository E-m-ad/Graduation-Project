typedef JsonMap = Map<String, dynamic>;

JsonMap? asJsonMap(Object? raw) {
  if (raw is JsonMap) {
    return raw;
  }

  if (raw is Map) {
    return raw.map((key, value) => MapEntry(key.toString(), value));
  }

  return null;
}

List<JsonMap> asJsonList(Object? raw) {
  if (raw is List) {
    return raw
        .map(asJsonMap)
        .whereType<JsonMap>()
        .toList(growable: false);
  }

  return const [];
}

extension JsonMapX on JsonMap {
  JsonMap? json(String key) => asJsonMap(this[key]);

  List<JsonMap> jsonList(String key) => asJsonList(this[key]);

  String string(String key, {String fallback = ''}) {
    final value = this[key];
    return value == null ? fallback : value.toString();
  }

  String? nullableString(String key) {
    final value = this[key];
    if (value == null) {
      return null;
    }

    final stringValue = value.toString().trim();
    return stringValue.isEmpty ? null : stringValue;
  }

  bool boolValue(String key, {bool fallback = false}) {
    final value = this[key];
    if (value is bool) {
      return value;
    }
    if (value is String) {
      return value.toLowerCase() == 'true';
    }
    return fallback;
  }

  int? intValue(String key) {
    final value = this[key];
    if (value is int) {
      return value;
    }
    if (value is num) {
      return value.toInt();
    }
    if (value is String) {
      return int.tryParse(value);
    }
    return null;
  }

  double? doubleValue(String key) {
    final value = this[key];
    if (value is double) {
      return value;
    }
    if (value is num) {
      return value.toDouble();
    }
    if (value is String) {
      return double.tryParse(value);
    }
    return null;
  }

  DateTime? dateTime(String key) {
    final value = this[key];
    if (value == null) {
      return null;
    }
    if (value is DateTime) {
      return value;
    }
    if (value is String) {
      return DateTime.tryParse(value);
    }
    return null;
  }

  List<String> stringList(String key) {
    final value = this[key];
    if (value is List) {
      return value.map((item) => item.toString()).toList(growable: false);
    }
    return const [];
  }
}
