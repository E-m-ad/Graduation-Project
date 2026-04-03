import 'package:flutter/material.dart';

import '../../config/app_dependencies.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/json_utils.dart';
import '../../core/widgets/app_state_views.dart';
import '../../core/widgets/metric_card.dart';
import '../../core/widgets/status_chip.dart';
import '../auth/session_controller.dart';

class AdminDashboardScreen extends StatefulWidget {
  const AdminDashboardScreen({
    super.key,
    required this.dependencies,
    required this.sessionController,
  });

  final AppDependencies dependencies;
  final SessionController sessionController;

  @override
  State<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends State<AdminDashboardScreen> {
  bool _isLoading = true;
  String? _error;
  JsonMap _dashboard = <String, dynamic>{};
  List<JsonMap> _users = const [];
  List<JsonMap> _products = const [];
  List<JsonMap> _rentals = const [];

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
      final dashboardResponse = await widget.dependencies.admin.getDashboard();
      final usersResponse = await widget.dependencies.admin.getUsers(limit: 6);
      final productsResponse = await widget.dependencies.admin.getProducts(
        limit: 6,
        isApproved: false,
      );
      final rentalsResponse = await widget.dependencies.admin.getRentals(limit: 6);

      setState(() {
        _dashboard = asJsonMap(dashboardResponse['data']) ?? <String, dynamic>{};
        _users = asJsonMap(usersResponse['data'])?.jsonList('users') ?? const [];
        _products =
            asJsonMap(productsResponse['data'])?.jsonList('products') ?? const [];
        _rentals =
            asJsonMap(rentalsResponse['data'])?.jsonList('rentals') ?? const [];
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
    if (!widget.sessionController.currentUser!.isAdmin) {
      return const Scaffold(
        body: AppEmptyState(
          title: 'Admin access only',
          message: 'This area is only available to administrator accounts.',
          icon: Icons.lock_outline,
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Admin dashboard')),
      body: _isLoading
          ? const AppLoadingView(label: 'Loading admin dashboard...')
          : _error != null
              ? AppErrorState(message: _error!, onRetry: _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
                    children: [
                      _buildSummaryGrid(),
                      const SizedBox(height: 24),
                      _buildPendingProductsSection(),
                      const SizedBox(height: 24),
                      _buildUsersSection(),
                      const SizedBox(height: 24),
                      _buildRentalsSection(),
                    ],
                  ),
                ),
    );
  }

  Widget _buildSummaryGrid() {
    final summary = _dashboard.json('summary') ?? <String, dynamic>{};
    final users = summary.json('users') ?? <String, dynamic>{};
    final products = summary.json('products') ?? <String, dynamic>{};
    final rentals = summary.json('rentals') ?? <String, dynamic>{};
    final financial = _dashboard.json('financial') ?? <String, dynamic>{};

    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      mainAxisSpacing: 14,
      crossAxisSpacing: 14,
      childAspectRatio: 1.08,
      children: [
        MetricCard(
          label: 'Active users',
          value: '${users.intValue('active') ?? 0}',
          icon: Icons.people_outline,
        ),
        MetricCard(
          label: 'Pending products',
          value: '${products.intValue('pendingReview') ?? 0}',
          icon: Icons.inventory_2_outlined,
          tint: const Color(0xFFBF7B3D),
        ),
        MetricCard(
          label: 'Active rentals',
          value: '${rentals.intValue('active') ?? 0}',
          icon: Icons.local_shipping_outlined,
          tint: const Color(0xFF2C6E49),
        ),
        MetricCard(
          label: 'Booked value',
          value: AppFormatters.money(financial.doubleValue('bookedValue')),
          icon: Icons.payments_outlined,
          tint: const Color(0xFF6D4C41),
        ),
      ],
    );
  }

  Widget _buildPendingProductsSection() {
    return _SectionCard(
      title: 'Pending products',
      subtitle: 'Quick moderation queue for newly submitted listings.',
      child: _products.isEmpty
          ? const Text('No pending listings right now.')
          : Column(
              children: _products
                  .map(
                    (product) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Card(
                        color: Colors.black.withOpacity(0.02),
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      product.string('title'),
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                  ),
                                  StatusChip(
                                    label:
                                        AppFormatters.status(product.string('status')),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'Owner: ${product.json('owner')?.string('name', fallback: 'Unknown') ?? 'Unknown'}',
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'City: ${product.nullableString('city') ?? 'Unknown'}',
                              ),
                              const SizedBox(height: 12),
                              Row(
                                children: [
                                  Expanded(
                                    child: FilledButton(
                                      onPressed: () => _approveProduct(
                                        product.string('id'),
                                      ),
                                      child: const Text('Approve'),
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: OutlinedButton(
                                      onPressed: () => _rejectProduct(
                                        product.string('id'),
                                      ),
                                      child: const Text('Reject'),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  )
                  .toList(growable: false),
            ),
    );
  }

  Widget _buildUsersSection() {
    return _SectionCard(
      title: 'Users',
      subtitle: 'Monitor account health and quickly activate or suspend users.',
      child: _users.isEmpty
          ? const Text('No users found.')
          : Column(
              children: _users
                  .map(
                    (user) => ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(
                        user.string('name'),
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      subtitle: Text(user.string('email')),
                      trailing: TextButton(
                        onPressed: () => _toggleUserStatus(user),
                        child: Text(
                          user.boolValue('isActive') ? 'Suspend' : 'Activate',
                        ),
                      ),
                    ),
                  )
                  .toList(growable: false),
            ),
    );
  }

  Widget _buildRentalsSection() {
    return _SectionCard(
      title: 'Recent rentals',
      subtitle: 'A quick glance at the most recent booking activity.',
      child: _rentals.isEmpty
          ? const Text('No rentals found.')
          : Column(
              children: _rentals
                  .map(
                    (rental) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Card(
                        color: Colors.black.withOpacity(0.02),
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      rental.json('product')?.string(
                                            'title',
                                            fallback: 'Listing',
                                          ) ??
                                          'Listing',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                  ),
                                  StatusChip(
                                    label:
                                        AppFormatters.status(rental.string('status')),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'Renter: ${rental.json('renter')?.string('name', fallback: 'Unknown') ?? 'Unknown'}',
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Owner: ${rental.json('owner')?.string('name', fallback: 'Unknown') ?? 'Unknown'}',
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Total: ${AppFormatters.money(rental.doubleValue('totalPrice'))}',
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  )
                  .toList(growable: false),
            ),
    );
  }

  Future<void> _approveProduct(String id) async {
    try {
      await widget.dependencies.admin.approveProduct(productId: id);
      await _load();
      _showSnack('Listing approved.');
    } catch (error) {
      _showSnack(error.toString());
    }
  }

  Future<void> _rejectProduct(String id) async {
    final reason = await _promptReason(
      title: 'Reject listing',
      hint: 'Optional moderation reason',
    );
    if (reason == null) {
      return;
    }

    try {
      await widget.dependencies.admin.rejectProduct(productId: id, reason: reason);
      await _load();
      _showSnack('Listing rejected.');
    } catch (error) {
      _showSnack(error.toString());
    }
  }

  Future<void> _toggleUserStatus(JsonMap user) async {
    final shouldActivate = !user.boolValue('isActive');
    final reason = await _promptReason(
      title: shouldActivate ? 'Activate user' : 'Suspend user',
      hint: 'Optional reason',
    );
    if (reason == null) {
      return;
    }

    try {
      await widget.dependencies.admin.updateUserStatus(
        userId: user.string('id'),
        isActive: shouldActivate,
        reason: reason,
      );
      await _load();
      _showSnack(shouldActivate ? 'User activated.' : 'User suspended.');
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

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.title,
    required this.subtitle,
    required this.child,
  });

  final String title;
  final String subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
            ),
            const SizedBox(height: 6),
            Text(
              subtitle,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Colors.black.withOpacity(0.62),
                  ),
            ),
            const SizedBox(height: 16),
            child,
          ],
        ),
      ),
    );
  }
}
