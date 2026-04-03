import 'package:flutter/material.dart';

import '../../config/app_dependencies.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/json_utils.dart';
import '../../core/widgets/app_network_image.dart';
import '../../core/widgets/app_state_views.dart';
import '../../core/widgets/section_header.dart';
import '../../core/widgets/status_chip.dart';
import '../auth/session_controller.dart';

class ProductDetailsScreen extends StatefulWidget {
  const ProductDetailsScreen({
    super.key,
    required this.dependencies,
    required this.sessionController,
    required this.productId,
  });

  final AppDependencies dependencies;
  final SessionController sessionController;
  final String productId;

  @override
  State<ProductDetailsScreen> createState() => _ProductDetailsScreenState();
}

class _ProductDetailsScreenState extends State<ProductDetailsScreen> {
  bool _isLoading = true;
  bool _isWishlistBusy = false;
  bool _isSaved = false;
  String? _error;
  JsonMap? _product;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final productResponse =
          await widget.dependencies.products.getProductById(widget.productId);
      final product = asJsonMap(productResponse['data']);

      bool isSaved = false;
      if (widget.sessionController.isAuthenticated) {
        try {
          final wishlistResponse =
              await widget.dependencies.wishlist.getMyWishlist(limit: 100);
          final wishlists =
              asJsonMap(wishlistResponse['data'])?.jsonList('wishlists') ?? const [];
          isSaved = wishlists.any(
            (entry) => entry.json('product')?.string('id') == widget.productId,
          );
        } catch (_) {
          isSaved = false;
        }
      }

      setState(() {
        _product = product;
        _isSaved = isSaved;
        _isLoading = false;
      });
    } catch (error) {
      setState(() {
        _error = error.toString();
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: AppLoadingView(label: 'Loading product...'),
      );
    }

    if (_error != null || _product == null) {
      return Scaffold(
        appBar: AppBar(),
        body: AppErrorState(
          message: _error ?? 'Product not found.',
          onRetry: _load,
        ),
      );
    }

    final product = _product!;
    final images = product.jsonList('images');
    final owner = product.json('owner');
    final category = product.json('category');
    final reviews = product.jsonList('reviews');
    final ownerAvatarUrl = owner == null
        ? ''
        : widget.dependencies.config.resolveServerPath(
            owner.nullableString('avatarUrl'),
          );

    return Scaffold(
      appBar: AppBar(
        title: const Text('Listing details'),
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(16, 8, 16, 16),
        child: Row(
          children: [
            if (widget.sessionController.isAuthenticated)
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _isWishlistBusy ? null : _toggleWishlist,
                  icon: Icon(_isSaved ? Icons.favorite : Icons.favorite_border),
                  label: Text(_isSaved ? 'Saved' : 'Save'),
                ),
              ),
            if (widget.sessionController.isAuthenticated)
              const SizedBox(width: 12),
            Expanded(
              flex: 2,
              child: FilledButton.icon(
                onPressed: _openBookingSheet,
                icon: const Icon(Icons.shopping_bag_outlined),
                label: Text(
                  widget.sessionController.isAuthenticated
                      ? 'Request rental'
                      : 'Sign in to rent',
                ),
              ),
            ),
          ],
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 120),
          children: [
            SizedBox(
              height: 260,
              child: PageView.builder(
                itemCount: images.isEmpty ? 1 : images.length,
                itemBuilder: (context, index) {
                  final image = images.isEmpty ? null : images[index];
                  return AppNetworkImage(
                    imageUrl: image?.nullableString('imageUrl') ??
                        image?.nullableString('thumbnailUrl'),
                    borderRadius: BorderRadius.circular(28),
                  );
                },
              ),
            ),
            const SizedBox(height: 20),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        product.string('title', fallback: 'Untitled listing'),
                        style:
                            Theme.of(context).textTheme.headlineSmall?.copyWith(
                                  fontWeight: FontWeight.w800,
                                ),
                      ),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          StatusChip(
                            label: AppFormatters.status(product.string('status')),
                          ),
                          StatusChip(
                            label: AppFormatters.status(product.string('condition')),
                            color: Theme.of(context).colorScheme.secondary,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text(
              product.nullableString('city') ?? 'Flexible location',
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: Colors.black.withOpacity(0.66),
                  ),
            ),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Pricing',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: [
                        if (product.doubleValue('pricePerHour') != null)
                          _PricePill(
                            label: 'Per hour',
                            value:
                                AppFormatters.money(product.doubleValue('pricePerHour')),
                          ),
                        if (product.doubleValue('pricePerDay') != null)
                          _PricePill(
                            label: 'Per day',
                            value:
                                AppFormatters.money(product.doubleValue('pricePerDay')),
                          ),
                        if (product.doubleValue('pricePerWeek') != null)
                          _PricePill(
                            label: 'Per week',
                            value:
                                AppFormatters.money(product.doubleValue('pricePerWeek')),
                          ),
                        if (product.doubleValue('pricePerMonth') != null)
                          _PricePill(
                            label: 'Per month',
                            value: AppFormatters.money(
                              product.doubleValue('pricePerMonth'),
                            ),
                          ),
                        if (product.doubleValue('securityDeposit') != null)
                          _PricePill(
                            label: 'Deposit',
                            value: AppFormatters.money(
                              product.doubleValue('securityDeposit'),
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 18),
            SectionHeader(
              title: 'Overview',
              subtitle: category == null
                  ? null
                  : 'Category: ${category.string('name', fallback: 'Unknown')}',
            ),
            const SizedBox(height: 10),
            Text(
              product.nullableString('description') ?? 'No description provided.',
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    height: 1.5,
                  ),
            ),
            if (owner != null) ...[
              const SizedBox(height: 24),
              SectionHeader(
                title: 'Owner',
                subtitle: 'Trusted listing owner information.',
              ),
              const SizedBox(height: 12),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 26,
                        backgroundColor:
                            Theme.of(context).colorScheme.primary.withOpacity(0.12),
                        backgroundImage:
                            (owner?.nullableString('avatarUrl') ?? '').isEmpty
                                ? null
                                : NetworkImage(ownerAvatarUrl),
                        child: owner.nullableString('avatarUrl') == null
                            ? Text(
                                _ownerInitial(owner.string('name', fallback: '?')),
                              )
                            : null,
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              owner.string('name', fallback: 'Owner'),
                              style: Theme.of(context)
                                  .textTheme
                                  .titleMedium
                                  ?.copyWith(fontWeight: FontWeight.w800),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              owner.nullableString('city') ?? 'Location not shared',
                              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                    color: Colors.black.withOpacity(0.62),
                                  ),
                            ),
                            if ((owner.nullableString('bio') ?? '').isNotEmpty) ...[
                              const SizedBox(height: 8),
                              Text(owner.string('bio')),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
            if (product.stringList('tags').isNotEmpty) ...[
              const SizedBox(height: 24),
              SectionHeader(
                title: 'Tags',
                subtitle: 'Helpful search keywords for this listing.',
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: product
                    .stringList('tags')
                    .map((tag) => Chip(label: Text(tag)))
                    .toList(growable: false),
              ),
            ],
            const SizedBox(height: 24),
            SectionHeader(
              title: 'Reviews',
              subtitle: reviews.isEmpty
                  ? 'No reviews yet'
                  : '${reviews.length} recent review(s)',
            ),
            const SizedBox(height: 12),
            if (reviews.isEmpty)
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(18),
                  child: Text(
                    'Reviews will appear here after completed rentals.',
                  ),
                ),
              )
            else
              ...reviews.take(4).map(
                (review) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(18),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                review.json('reviewer')?.string(
                                      'name',
                                      fallback: 'Reviewer',
                                    ) ??
                                    'Reviewer',
                                style: Theme.of(context)
                                    .textTheme
                                    .titleSmall
                                    ?.copyWith(fontWeight: FontWeight.w800),
                              ),
                              const Spacer(),
                              StatusChip(
                                label: '${review.intValue('rating') ?? 0}/5',
                                color: Theme.of(context).colorScheme.secondary,
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Text(review.nullableString('comment') ?? 'No comment.'),
                          if ((review.nullableString('ownerReply') ?? '').isNotEmpty) ...[
                            const SizedBox(height: 12),
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Theme.of(context)
                                    .colorScheme
                                    .primary
                                    .withOpacity(0.08),
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: Text(
                                'Owner reply: ${review.string('ownerReply')}',
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            const SizedBox(height: 24),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Rental terms',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      product.nullableString('termsConditions') ??
                          'No additional terms were provided.',
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _toggleWishlist() async {
    if (!widget.sessionController.isAuthenticated) {
      _showSnack('Sign in from the Profile tab to save listings.');
      return;
    }

    setState(() {
      _isWishlistBusy = true;
    });

    try {
      if (_isSaved) {
        await widget.dependencies.wishlist.removeFromWishlist(widget.productId);
      } else {
        await widget.dependencies.wishlist.addToWishlist(widget.productId);
      }

      setState(() {
        _isSaved = !_isSaved;
      });
      _showSnack(_isSaved ? 'Added to wishlist.' : 'Removed from wishlist.');
    } catch (error) {
      _showSnack(error.toString());
    } finally {
      if (mounted) {
        setState(() {
          _isWishlistBusy = false;
        });
      }
    }
  }

  Future<void> _openBookingSheet() async {
    if (!widget.sessionController.isAuthenticated) {
      _showSnack('Sign in from the Profile tab to request a rental.');
      return;
    }

    if (_product == null) {
      return;
    }

    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => BookingSheet(
        dependencies: widget.dependencies,
        product: _product!,
      ),
    );

    if (created == true) {
      _showSnack('Rental request submitted successfully.');
    }
  }

  void _showSnack(String message) {
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  String _ownerInitial(String name) {
    final trimmed = name.trim();
    return trimmed.isEmpty ? '?' : trimmed.substring(0, 1).toUpperCase();
  }
}

class _PricePill extends StatelessWidget {
  const _PricePill({
    required this.label,
    required this.value,
  });

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.04),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Colors.black.withOpacity(0.6),
                ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
          ),
        ],
      ),
    );
  }
}

class BookingSheet extends StatefulWidget {
  const BookingSheet({
    super.key,
    required this.dependencies,
    required this.product,
  });

  final AppDependencies dependencies;
  final JsonMap product;

  @override
  State<BookingSheet> createState() => _BookingSheetState();
}

class _BookingSheetState extends State<BookingSheet> {
  final _notesController = TextEditingController();

  late String _periodType;
  late DateTime _startDate;
  late DateTime _endDate;
  bool _isBusy = false;
  JsonMap? _availability;

  @override
  void initState() {
    super.initState();
    final periods = _availablePeriods(widget.product);
    _periodType = periods.first;

    final now = DateTime.now();
    _startDate = DateTime(now.year, now.month, now.day + 1, 10);
    _endDate = DateTime(now.year, now.month, now.day + 2, 10);
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final padding = MediaQuery.of(context).viewInsets;

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(20, 8, 20, 20 + padding.bottom),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Request rental',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
              ),
              const SizedBox(height: 8),
              Text(
                'Choose the rental period and dates, then check availability before sending the request.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Colors.black.withOpacity(0.65),
                    ),
              ),
              const SizedBox(height: 20),
              DropdownButtonFormField<String>(
                value: _periodType,
                decoration: const InputDecoration(labelText: 'Rental type'),
                items: _availablePeriods(widget.product)
                    .map(
                      (period) => DropdownMenuItem(
                        value: period,
                        child: Text(AppFormatters.status(period)),
                      ),
                    )
                    .toList(growable: false),
                onChanged: (value) {
                  if (value == null) {
                    return;
                  }
                  setState(() {
                    _periodType = value;
                    _availability = null;
                  });
                },
              ),
              const SizedBox(height: 14),
              _DateField(
                label: 'Start',
                value: _startDate,
                onPick: () => _pickDateTime(isStart: true),
              ),
              const SizedBox(height: 14),
              _DateField(
                label: 'End',
                value: _endDate,
                onPick: () => _pickDateTime(isStart: false),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _notesController,
                minLines: 3,
                maxLines: 4,
                decoration: const InputDecoration(
                  labelText: 'Notes for the owner',
                  hintText: 'Pickup details, timing, or questions',
                ),
              ),
              const SizedBox(height: 18),
              if (_availability != null) _buildAvailabilityPreview(context),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _isBusy ? null : _checkAvailability,
                      child: Text(_isBusy ? 'Checking...' : 'Check availability'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(
                      onPressed: _isBusy ? null : _requestRental,
                      child: Text(_isBusy ? 'Submitting...' : 'Request rental'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAvailabilityPreview(BuildContext context) {
    final availability = _availability!;
    final pricing = availability.json('pricing');
    final isAvailable = availability.boolValue('isAvailable');

    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              StatusChip(
                label: isAvailable ? 'Available' : 'Not available',
                color: isAvailable
                    ? Theme.of(context).colorScheme.primary
                    : Theme.of(context).colorScheme.error,
              ),
              if (pricing != null) ...[
                const SizedBox(height: 12),
                Text(
                  'Estimated total: ${AppFormatters.money(pricing.doubleValue('totalPrice'))}',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Deposit: ${AppFormatters.money(pricing.doubleValue('securityDeposit'))}',
                ),
              ],
              if ((availability.nullableString('notBookableReason') ?? '').isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(availability.string('notBookableReason')),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _pickDateTime({required bool isStart}) async {
    final initial = isStart ? _startDate : _endDate;
    final pickedDate = await showDatePicker(
      context: context,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      initialDate: initial,
    );

    if (pickedDate == null || !mounted) {
      return;
    }

    final pickedTime = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(initial),
    );

    if (pickedTime == null) {
      return;
    }

    final nextDateTime = DateTime(
      pickedDate.year,
      pickedDate.month,
      pickedDate.day,
      pickedTime.hour,
      pickedTime.minute,
    );

    setState(() {
      if (isStart) {
        _startDate = nextDateTime;
        if (!_endDate.isAfter(_startDate)) {
          _endDate = _startDate.add(const Duration(days: 1));
        }
      } else {
        _endDate = nextDateTime;
      }
      _availability = null;
    });
  }

  Future<void> _checkAvailability() async {
    if (!_validateRange()) {
      return;
    }

    setState(() {
      _isBusy = true;
    });

    try {
      final response = await widget.dependencies.rentals.checkAvailability(
        productId: widget.product.string('id'),
        startDate: _startDate,
        endDate: _endDate,
        rentalPeriodType: _periodType,
        quantity: 1,
      );

      setState(() {
        _availability = asJsonMap(response['data']);
      });
    } catch (error) {
      _showSnack(error.toString());
    } finally {
      if (mounted) {
        setState(() {
          _isBusy = false;
        });
      }
    }
  }

  Future<void> _requestRental() async {
    if (!_validateRange()) {
      return;
    }

    setState(() {
      _isBusy = true;
    });

    try {
      await widget.dependencies.rentals.createRental(
        productId: widget.product.string('id'),
        startDate: _startDate,
        endDate: _endDate,
        rentalPeriodType: _periodType,
        quantity: 1,
        renterNotes: _notesController.text.trim().isEmpty
            ? null
            : _notesController.text.trim(),
      );

      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } catch (error) {
      _showSnack(error.toString());
    } finally {
      if (mounted) {
        setState(() {
          _isBusy = false;
        });
      }
    }
  }

  bool _validateRange() {
    if (!_endDate.isAfter(_startDate)) {
      _showSnack('The end date must be after the start date.');
      return false;
    }

    return true;
  }

  List<String> _availablePeriods(JsonMap product) {
    final periods = <String>[];
    if (product.doubleValue('pricePerHour') != null) periods.add('hourly');
    if (product.doubleValue('pricePerDay') != null) periods.add('daily');
    if (product.doubleValue('pricePerWeek') != null) periods.add('weekly');
    if (product.doubleValue('pricePerMonth') != null) periods.add('monthly');
    return periods.isEmpty ? ['daily'] : periods;
  }

  void _showSnack(String message) {
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }
}

class _DateField extends StatelessWidget {
  const _DateField({
    required this.label,
    required this.value,
    required this.onPick,
  });

  final String label;
  final DateTime value;
  final VoidCallback onPick;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(18),
      onTap: onPick,
      child: InputDecorator(
        decoration: InputDecoration(labelText: label),
        child: Row(
          children: [
            const Icon(Icons.event_outlined),
            const SizedBox(width: 10),
            Expanded(child: Text(AppFormatters.dateTime(value))),
            const Icon(Icons.chevron_right),
          ],
        ),
      ),
    );
  }
}
