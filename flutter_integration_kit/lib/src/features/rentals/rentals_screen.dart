import 'package:flutter/material.dart';

import '../../config/app_dependencies.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/json_utils.dart';
import '../../core/widgets/app_state_views.dart';
import '../../core/widgets/status_chip.dart';
import '../auth/session_controller.dart';

class RentalsScreen extends StatelessWidget {
  const RentalsScreen({
    super.key,
    required this.dependencies,
    required this.sessionController,
  });

  final AppDependencies dependencies;
  final SessionController sessionController;

  @override
  Widget build(BuildContext context) {
    if (!sessionController.isAuthenticated) {
      return const Scaffold(
        body: AppEmptyState(
          title: 'Track your rentals',
          message:
              'Sign in to view booking requests, rental status, and owner actions in one place.',
          icon: Icons.receipt_long_outlined,
        ),
      );
    }

    return _RentalsContent(
      dependencies: dependencies,
      sessionController: sessionController,
    );
  }
}

class _RentalsContent extends StatefulWidget {
  const _RentalsContent({
    required this.dependencies,
    required this.sessionController,
  });

  final AppDependencies dependencies;
  final SessionController sessionController;

  @override
  State<_RentalsContent> createState() => _RentalsContentState();
}

class _RentalsContentState extends State<_RentalsContent>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  bool _isLoading = true;
  String? _error;
  List<JsonMap> _bookings = const [];
  List<JsonMap> _requests = const [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final bookingsResponse =
          await widget.dependencies.rentals.getMyBookings(limit: 50);
      final requestsResponse =
          await widget.dependencies.rentals.getMyRequests(limit: 50);

      setState(() {
        _bookings =
            asJsonMap(bookingsResponse['data'])?.jsonList('rentals') ?? const [];
        _requests =
            asJsonMap(requestsResponse['data'])?.jsonList('rentals') ?? const [];
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
    return Scaffold(
      appBar: AppBar(
        title: const Text('Rentals'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'My bookings'),
            Tab(text: 'My requests'),
          ],
        ),
      ),
      body: _isLoading
          ? const AppLoadingView(label: 'Loading rentals...')
          : _error != null
              ? AppErrorState(message: _error!, onRetry: _load)
              : TabBarView(
                  controller: _tabController,
                  children: [
                    _buildList(_bookings, isOwnerSide: false),
                    _buildList(_requests, isOwnerSide: true),
                  ],
                ),
    );
  }

  Widget _buildList(List<JsonMap> rentals, {required bool isOwnerSide}) {
    return RefreshIndicator(
      onRefresh: _load,
      child: rentals.isEmpty
          ? ListView(
              children: [
                SizedBox(
                  height: 520,
                  child: AppEmptyState(
                    title: isOwnerSide
                        ? 'No incoming requests'
                        : 'No bookings yet',
                    message: isOwnerSide
                        ? 'Rental requests from customers will show up here.'
                        : 'When you request a rental, it will appear here.',
                    icon: isOwnerSide
                        ? Icons.inventory_2_outlined
                        : Icons.shopping_bag_outlined,
                  ),
                ),
              ],
            )
          : ListView.separated(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              itemCount: rentals.length,
              separatorBuilder: (_, __) => const SizedBox(height: 16),
              itemBuilder: (context, index) {
                final rental = rentals[index];
                return _buildRentalCard(rental, isOwnerSide: isOwnerSide);
              },
            ),
    );
  }

  Widget _buildRentalCard(JsonMap rental, {required bool isOwnerSide}) {
    final product = rental.json('product');
    final counterpart = isOwnerSide ? rental.json('renter') : rental.json('owner');
    final status = rental.string('status');

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    product?.string('title', fallback: 'Listing') ?? 'Listing',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                ),
                StatusChip(label: AppFormatters.status(status)),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              '${isOwnerSide ? 'Renter' : 'Owner'}: ${counterpart?.string('name', fallback: 'Unknown') ?? 'Unknown'}',
            ),
            const SizedBox(height: 6),
            Text(
              '${AppFormatters.dateTime(rental.dateTime('startDate'))} -> ${AppFormatters.dateTime(rental.dateTime('endDate'))}',
            ),
            const SizedBox(height: 6),
            Text(
              'Total: ${AppFormatters.money(rental.doubleValue('totalPrice'))}',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            if ((rental.nullableString('renterNotes') ?? '').isNotEmpty) ...[
              const SizedBox(height: 10),
              Text('Notes: ${rental.string('renterNotes')}'),
            ],
            if ((rental.nullableString('ownerNotes') ?? '').isNotEmpty) ...[
              const SizedBox(height: 10),
              Text('Owner notes: ${rental.string('ownerNotes')}'),
            ],
            const SizedBox(height: 14),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: _buildActions(rental, isOwnerSide: isOwnerSide),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _buildActions(JsonMap rental, {required bool isOwnerSide}) {
    final status = rental.string('status');
    final id = rental.string('id');
    final actions = <Widget>[];

    if (!isOwnerSide && (status == 'pending' || status == 'approved')) {
      actions.add(
        OutlinedButton(
          onPressed: () => _cancelRental(id),
          child: const Text('Cancel'),
        ),
      );
    }

    if (isOwnerSide && status == 'pending') {
      actions.add(
        FilledButton(
          onPressed: () => _approveRental(id),
          child: const Text('Approve'),
        ),
      );
      actions.add(
        OutlinedButton(
          onPressed: () => _rejectRental(id),
          child: const Text('Reject'),
        ),
      );
    }

    if (isOwnerSide && status == 'approved') {
      actions.add(
        FilledButton(
          onPressed: () => _startRental(id),
          child: const Text('Start'),
        ),
      );
      actions.add(
        OutlinedButton(
          onPressed: () => _cancelRental(id),
          child: const Text('Cancel'),
        ),
      );
    }

    if (isOwnerSide && status == 'active') {
      actions.add(
        FilledButton(
          onPressed: () => _completeRental(id),
          child: const Text('Complete'),
        ),
      );
    }

    return actions;
  }

  Future<void> _approveRental(String id) async {
    try {
      await widget.dependencies.rentals.approveRental(id);
      await _load();
      _showSnack('Rental approved.');
    } catch (error) {
      _showSnack(error.toString());
    }
  }

  Future<void> _rejectRental(String id) async {
    final reason = await _promptReason(
      title: 'Reject rental',
      hint: 'Optional reason for the renter',
    );
    if (reason == null) {
      return;
    }

    try {
      await widget.dependencies.rentals.rejectRental(id: id, reason: reason);
      await _load();
      _showSnack('Rental rejected.');
    } catch (error) {
      _showSnack(error.toString());
    }
  }

  Future<void> _cancelRental(String id) async {
    final reason = await _promptReason(
      title: 'Cancel rental',
      hint: 'Optional cancellation reason',
    );
    if (reason == null) {
      return;
    }

    try {
      await widget.dependencies.rentals.cancelRental(id: id, reason: reason);
      await _load();
      _showSnack('Rental cancelled.');
    } catch (error) {
      _showSnack(error.toString());
    }
  }

  Future<void> _startRental(String id) async {
    try {
      await widget.dependencies.rentals.startRental(id);
      await _load();
      _showSnack('Rental started.');
    } catch (error) {
      _showSnack(error.toString());
    }
  }

  Future<void> _completeRental(String id) async {
    try {
      await widget.dependencies.rentals.completeRental(id);
      await _load();
      _showSnack('Rental completed.');
    } catch (error) {
      _showSnack(error.toString());
    }
  }

  Future<String?> _promptReason({
    required String title,
    required String hint,
  }) async {
    final controller = TextEditingController();

    final result = await showDialog<String?>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: controller,
          minLines: 3,
          maxLines: 4,
          decoration: InputDecoration(hintText: hint),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(null),
            child: const Text('Back'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(controller.text.trim()),
            child: const Text('Confirm'),
          ),
        ],
      ),
    );

    controller.dispose();
    return result;
  }

  void _showSnack(String message) {
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }
}
