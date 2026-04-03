import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../config/app_dependencies.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/app_state_views.dart';
import '../admin/admin_dashboard_screen.dart';
import '../auth/auth_screen.dart';
import '../auth/session_controller.dart';
import '../products/create_listing_screen.dart';
import '../products/owner_listings_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({
    super.key,
    required this.dependencies,
    required this.sessionController,
  });

  final AppDependencies dependencies;
  final SessionController sessionController;

  @override
  Widget build(BuildContext context) {
    if (!sessionController.isAuthenticated) {
      return AuthScreen(sessionController: sessionController);
    }

    return _ProfileContent(
      dependencies: dependencies,
      sessionController: sessionController,
    );
  }
}

class _ProfileContent extends StatefulWidget {
  const _ProfileContent({
    required this.dependencies,
    required this.sessionController,
  });

  final AppDependencies dependencies;
  final SessionController sessionController;

  @override
  State<_ProfileContent> createState() => _ProfileContentState();
}

class _ProfileContentState extends State<_ProfileContent> {
  bool _isBusy = false;
  final _imagePicker = ImagePicker();

  @override
  Widget build(BuildContext context) {
    final user = widget.sessionController.currentUser;
    if (user == null) {
      return const Scaffold(
        body: AppLoadingView(label: 'Loading profile...'),
      );
    }

    final avatarUrl = widget.dependencies.config.resolveServerPath(user.avatarUrl);

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 120),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 38,
                    backgroundColor:
                        Theme.of(context).colorScheme.primary.withOpacity(0.12),
                    backgroundImage: user.avatarUrl == null || user.avatarUrl!.isEmpty
                        ? null
                        : NetworkImage(avatarUrl),
                    child: user.avatarUrl == null || user.avatarUrl!.isEmpty
                        ? Text(
                            _initials(user.name),
                            style:
                                Theme.of(context).textTheme.headlineSmall?.copyWith(
                                      fontWeight: FontWeight.w800,
                                    ),
                          )
                        : null,
                  ),
                  const SizedBox(height: 14),
                  Text(
                    user.name,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    user.email,
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                          color: Colors.black.withOpacity(0.65),
                        ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    alignment: WrapAlignment.center,
                    children: [
                      Chip(label: Text(AppFormatters.role(user.role))),
                      if (user.city != null && user.city!.isNotEmpty)
                        Chip(label: Text(user.city!)),
                      if (user.isVerified) const Chip(label: Text('Verified')),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _isBusy ? null : _pickAvatar,
                  icon: const Icon(Icons.photo_camera_back_outlined),
                  label: const Text('Update avatar'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton.icon(
                  onPressed: _isBusy ? null : _editProfile,
                  icon: const Icon(Icons.edit_outlined),
                  label: const Text('Edit profile'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: _isBusy ? null : _changePassword,
            icon: const Icon(Icons.lock_outline),
            label: const Text('Change password'),
          ),
          const SizedBox(height: 24),
          Text(
            'Workspace',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: 12),
          _ActionCard(
            icon: Icons.add_business_outlined,
            title: 'Create listing',
            subtitle: 'Publish a new item and start receiving rental requests.',
            onTap: _openCreateListing,
          ),
          const SizedBox(height: 12),
          _ActionCard(
            icon: Icons.inventory_2_outlined,
            title: 'Manage my listings',
            subtitle: 'Review statuses, edit details, or take listings offline.',
            onTap: _openMyListings,
          ),
          if (user.isAdmin) ...[
            const SizedBox(height: 12),
            _ActionCard(
              icon: Icons.admin_panel_settings_outlined,
              title: 'Admin dashboard',
              subtitle: 'Moderate users, review listings, and inspect rentals.',
              onTap: _openAdminDashboard,
            ),
          ],
          const SizedBox(height: 24),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Profile details',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                  const SizedBox(height: 12),
                  _ProfileRow(label: 'Phone', value: user.phone ?? 'Not set'),
                  _ProfileRow(label: 'Address', value: user.address ?? 'Not set'),
                  _ProfileRow(label: 'Bio', value: user.bio ?? 'Not set'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: _isBusy ? null : _logout,
            icon: const Icon(Icons.logout),
            label: const Text('Log out'),
          ),
        ],
      ),
    );
  }

  Future<void> _pickAvatar() async {
    final image = await _imagePicker.pickImage(source: ImageSource.gallery);
    if (image == null) {
      return;
    }

    setState(() {
      _isBusy = true;
    });

    try {
      await widget.dependencies.users.uploadAvatar(image.path);
      await widget.sessionController.refreshProfile();
      _showSnack('Avatar updated.');
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

  Future<void> _editProfile() async {
    final user = widget.sessionController.currentUser;
    if (user == null) {
      return;
    }

    final nameController = TextEditingController(text: user.name);
    final phoneController = TextEditingController(text: user.phone ?? '');
    final cityController = TextEditingController(text: user.city ?? '');
    final addressController = TextEditingController(text: user.address ?? '');
    final bioController = TextEditingController(text: user.bio ?? '');

    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Edit profile'),
        content: SizedBox(
          width: 420,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: nameController,
                  decoration: const InputDecoration(labelText: 'Name'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: phoneController,
                  decoration: const InputDecoration(labelText: 'Phone'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: cityController,
                  decoration: const InputDecoration(labelText: 'City'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: addressController,
                  decoration: const InputDecoration(labelText: 'Address'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: bioController,
                  minLines: 3,
                  maxLines: 4,
                  decoration: const InputDecoration(labelText: 'Bio'),
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Save'),
          ),
        ],
      ),
    );

    if (saved != true) {
      nameController.dispose();
      phoneController.dispose();
      cityController.dispose();
      addressController.dispose();
      bioController.dispose();
      return;
    }

    setState(() {
      _isBusy = true;
    });

    try {
      await widget.dependencies.users.updateMyProfile(
        name: nameController.text.trim(),
        phone: _nullable(phoneController.text),
        city: _nullable(cityController.text),
        address: _nullable(addressController.text),
        bio: _nullable(bioController.text),
      );
      await widget.sessionController.refreshProfile();
      _showSnack('Profile updated.');
    } catch (error) {
      _showSnack(error.toString());
    } finally {
      nameController.dispose();
      phoneController.dispose();
      cityController.dispose();
      addressController.dispose();
      bioController.dispose();

      if (mounted) {
        setState(() {
          _isBusy = false;
        });
      }
    }
  }

  Future<void> _changePassword() async {
    final currentController = TextEditingController();
    final nextController = TextEditingController();
    final confirmController = TextEditingController();

    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Change password'),
        content: SizedBox(
          width: 420,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: currentController,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Current password'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: nextController,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'New password'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: confirmController,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Confirm new password'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Update'),
          ),
        ],
      ),
    );

    if (saved != true) {
      currentController.dispose();
      nextController.dispose();
      confirmController.dispose();
      return;
    }

    setState(() {
      _isBusy = true;
    });

    try {
      await widget.dependencies.users.changePassword(
        currentPassword: currentController.text,
        newPassword: nextController.text,
        confirmNewPassword: confirmController.text,
      );
      _showSnack('Password changed successfully.');
    } catch (error) {
      _showSnack(error.toString());
    } finally {
      currentController.dispose();
      nextController.dispose();
      confirmController.dispose();

      if (mounted) {
        setState(() {
          _isBusy = false;
        });
      }
    }
  }

  Future<void> _openCreateListing() async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => CreateListingScreen(
          dependencies: widget.dependencies,
          sessionController: widget.sessionController,
        ),
      ),
    );

    if (created == true) {
      await widget.sessionController.refreshProfile();
      _showSnack('Listing submitted successfully.');
    }
  }

  Future<void> _openMyListings() async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => OwnerListingsScreen(
          dependencies: widget.dependencies,
          sessionController: widget.sessionController,
        ),
      ),
    );
    await widget.sessionController.refreshProfile();
  }

  Future<void> _openAdminDashboard() async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => AdminDashboardScreen(
          dependencies: widget.dependencies,
          sessionController: widget.sessionController,
        ),
      ),
    );
  }

  Future<void> _logout() async {
    setState(() {
      _isBusy = true;
    });

    final result = await widget.sessionController.logout();
    if (mounted) {
      setState(() {
        _isBusy = false;
      });
    }

    _showSnack(result ?? 'Logged out successfully.');
  }

  String? _nullable(String value) {
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }

  String _initials(String name) {
    final trimmed = name.trim();
    return trimmed.isEmpty ? '?' : trimmed.substring(0, 1).toUpperCase();
  }

  void _showSnack(String message) {
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }
}

class _ActionCard extends StatelessWidget {
  const _ActionCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(24),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Row(
            children: [
              CircleAvatar(
                radius: 24,
                backgroundColor:
                    Theme.of(context).colorScheme.primary.withOpacity(0.12),
                child: Icon(icon, color: Theme.of(context).colorScheme.primary),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Colors.black.withOpacity(0.64),
                          ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProfileRow extends StatelessWidget {
  const _ProfileRow({
    required this.label,
    required this.value,
  });

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 90,
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Colors.black.withOpacity(0.6),
                  ),
            ),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}
