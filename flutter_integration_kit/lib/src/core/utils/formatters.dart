import 'package:intl/intl.dart';

import 'json_utils.dart';

class AppFormatters {
  static final NumberFormat _currency = NumberFormat.currency(
    symbol: 'EGP ',
    decimalDigits: 0,
  );
  static final DateFormat _shortDate = DateFormat('d MMM y');
  static final DateFormat _dateTime = DateFormat('d MMM y, h:mm a');

  static String money(num? value) {
    if (value == null) {
      return 'Flexible';
    }

    return _currency.format(value);
  }

  static String moneyFromMap(JsonMap map, String key) {
    return money(map.doubleValue(key));
  }

  static String role(String rawRole) {
    switch (rawRole) {
      case 'admin':
        return 'Admin';
      case 'owner':
        return 'Owner';
      case 'both':
        return 'Owner & Renter';
      default:
        return 'Renter';
    }
  }

  static String status(String rawStatus) {
    if (rawStatus.isEmpty) {
      return 'Unknown';
    }

    return rawStatus
        .split('_')
        .map((part) => part.isEmpty
            ? part
            : '${part[0].toUpperCase()}${part.substring(1)}')
        .join(' ');
  }

  static String date(DateTime? value) {
    if (value == null) {
      return 'Unknown';
    }

    return _shortDate.format(value.toLocal());
  }

  static String dateTime(DateTime? value) {
    if (value == null) {
      return 'Unknown';
    }

    return _dateTime.format(value.toLocal());
  }

  static String primaryPrice(JsonMap product) {
    final options = <String>[
      if (product.doubleValue('pricePerHour') != null)
        '${money(product.doubleValue('pricePerHour'))} / hour',
      if (product.doubleValue('pricePerDay') != null)
        '${money(product.doubleValue('pricePerDay'))} / day',
      if (product.doubleValue('pricePerWeek') != null)
        '${money(product.doubleValue('pricePerWeek'))} / week',
      if (product.doubleValue('pricePerMonth') != null)
        '${money(product.doubleValue('pricePerMonth'))} / month',
    ];

    return options.isEmpty ? 'Pricing on request' : options.first;
  }

  static String ratingSummary(JsonMap product) {
    final rating = product.doubleValue('avgRating');
    final count = product.intValue('totalReviews') ?? 0;
    if (rating == null || count == 0) {
      return 'No reviews yet';
    }

    return '${rating.toStringAsFixed(1)} ($count reviews)';
  }
}
